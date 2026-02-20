import { Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { inboxFollowupQueue } from '../../lib/queue.js';
import { notificationService } from '../notifications/notifications.service.js';
import {
    detectObjection,
    ObjectionDetectionResult,
} from './objection-detector.js';

type LeadTemperature = 'HOT' | 'WARM' | 'COLD';
type MessageChannel = 'EMAIL' | 'WHATSAPP';
type FollowUpAction = 'ALERT_SDR' | 'AUTO_FOLLOWUP' | 'NURTURE' | 'NONE';

interface ReplySuggestion {
    id: string;
    label: string;
    content: string;
}

interface FollowUpRecommendation {
    action: FollowUpAction;
    delayHours: number;
    reason: string;
}

function channelLabel(channel: MessageChannel) {
    return channel === 'WHATSAPP' ? 'WhatsApp' : 'email';
}

function buildFallbackSuggestions(params: {
    leadName: string;
    objection: ObjectionDetectionResult | null;
}): ReplySuggestion[] {
    const firstName = params.leadName.split(' ')[0] || 'Oi';

    if (params.objection?.type === 'PRICE') {
        return [
            {
                id: 'price_1',
                label: 'Negociar valor',
                content: `Oi ${firstName}, entendo seu ponto sobre preco. Posso te mostrar um plano de entrada com menor investimento e ROI esperado nos primeiros 30 dias.`,
            },
            {
                id: 'price_2',
                label: 'Oferecer plano basico',
                content: `Perfeito, ${firstName}. Podemos comecar por um escopo mais enxuto para validar resultado rapido antes de ampliar.`,
            },
            {
                id: 'price_3',
                label: 'Chamar para call',
                content: `Faz sentido, ${firstName}. Quer que eu te mostre em 15 minutos como outras empresas reduziram custo com esse modelo?`,
            },
        ];
    }

    if (params.objection?.type === 'TIMING') {
        return [
            {
                id: 'timing_1',
                label: 'Follow-up suave',
                content: `Sem problema, ${firstName}. Qual janela faz mais sentido para retomarmos esse assunto?`,
            },
            {
                id: 'timing_2',
                label: 'Deixar valor rapido',
                content: `Entendido. Posso te enviar um resumo de 3 pontos para voce avaliar quando tiver disponibilidade?`,
            },
            {
                id: 'timing_3',
                label: 'Agenda futura',
                content: `Combinado, ${firstName}. Posso te procurar novamente em algumas semanas para atualizar esse contexto?`,
            },
        ];
    }

    if (params.objection?.type === 'AUTHORITY') {
        return [
            {
                id: 'authority_1',
                label: 'Mapear decisor',
                content: `Perfeito, ${firstName}. Quem alem de voce participa dessa decisao para eu envolver da forma certa?`,
            },
            {
                id: 'authority_2',
                label: 'Material para encaminhar',
                content: `Posso te enviar um resumo executivo curto para voce compartilhar com a diretoria?`,
            },
            {
                id: 'authority_3',
                label: 'Reuniao conjunta',
                content: `Se fizer sentido, marcamos uma conversa rapida com quem aprova para tirar duvidas direto.`,
            },
        ];
    }

    return [
        {
            id: 'generic_1',
            label: 'Responder consultivo',
            content: `Obrigado pelo retorno, ${firstName}. Pelo que voce trouxe, posso te sugerir um proximo passo simples para validar aderencia sem friccao.`,
        },
        {
            id: 'generic_2',
            label: 'Pergunta de qualificacao',
            content: `Para eu te ajudar melhor, qual e hoje o principal objetivo comercial que voce quer destravar nas proximas semanas?`,
        },
        {
            id: 'generic_3',
            label: 'Propor call curta',
            content: `Se fizer sentido, te mostro em 15 minutos como isso funcionaria no seu contexto especifico.`,
        },
    ];
}

function uniqueSuggestions(items: ReplySuggestion[]) {
    const seen = new Set<string>();
    return items.filter((item) => {
        const key = item.content.toLowerCase().trim();
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

function followUpRuleForTemperature(temperature: LeadTemperature): FollowUpRecommendation {
    if (temperature === 'HOT') {
        return {
            action: 'ALERT_SDR',
            delayHours: 24,
            reason: 'Lead HOT sem resposta apos 24h',
        };
    }
    if (temperature === 'WARM') {
        return {
            action: 'AUTO_FOLLOWUP',
            delayHours: 72,
            reason: 'Lead WARM sem resposta apos 3 dias',
        };
    }
    return {
        action: 'NURTURE',
        delayHours: 168,
        reason: 'Lead COLD sem resposta apos 7 dias',
    };
}

function buildWarmFollowUpTemplate(fullName: string | null) {
    const firstName = (fullName || '').split(' ')[0] || 'Oi';
    return `Oi ${firstName}, passando para retomar nossa conversa. Quer que eu te envie um resumo objetivo com os proximos passos recomendados?`;
}

async function callAiSuggest(params: {
    message: string;
    organizationId: string;
}): Promise<ReplySuggestion[]> {
    type FetchResponse = {
        ok: boolean;
        status: number;
        text: () => Promise<string>;
        json: () => Promise<unknown>;
    };
    type FetchLike = (
        input: string,
        init?: { method?: string; headers?: Record<string, string>; body?: string }
    ) => Promise<FetchResponse>;

    const fetchFn = (globalThis as { fetch?: FetchLike }).fetch;
    if (!fetchFn) {
        return [];
    }

    try {
        const response = await fetchFn(`${env.AI_SERVICE_URL}/analyze/suggest`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                message: params.message,
                language: 'pt-BR',
                tone: 'consultivo',
                org_id: params.organizationId,
            }),
        });

        if (!response.ok) {
            return [];
        }

        const payload = (await response.json()) as Record<string, unknown>;
        const data = (payload['data'] as Record<string, unknown>) || payload;
        const suggestionsRaw = data['suggestions'] || data['responses'] || data['response'];

        const list =
            typeof suggestionsRaw === 'string'
                ? [suggestionsRaw]
                : Array.isArray(suggestionsRaw)
                ? suggestionsRaw.filter(
                      (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0
                  )
                : [];

        return list.slice(0, 3).map((entry, index) => ({
            id: `ai_${index + 1}`,
            label: `Sugestao IA ${index + 1}`,
            content: entry,
        }));
    } catch {
        return [];
    }
}

export class InboxIntelligenceService {
    async getThreadIntelligence(organizationId: string, leadId: string) {
        const lead = await prisma.lead.findFirst({
            where: { id: leadId, organizationId },
            select: {
                id: true,
                fullName: true,
                temperature: true,
                assignedToUserId: true,
                lastInteraction: true,
            },
        });

        if (!lead) {
            throw new Error('Lead not found');
        }

        const [latestInbound, latestOutbound] = await Promise.all([
            prisma.message.findFirst({
                where: { leadId, direction: 'INBOUND' },
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    content: true,
                    type: true,
                    createdAt: true,
                },
            }),
            prisma.message.findFirst({
                where: { leadId, direction: 'OUTBOUND' },
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    type: true,
                    createdAt: true,
                },
            }),
        ]);

        const objection = latestInbound ? detectObjection(latestInbound.content) : null;
        const followupRule = followUpRuleForTemperature((lead.temperature || 'COLD') as LeadTemperature);
        const baseSuggestions = buildFallbackSuggestions({
            leadName: lead.fullName || 'Lead',
            objection,
        });
        const aiSuggestions = latestInbound
            ? await callAiSuggest({
                  message: latestInbound.content,
                  organizationId,
              })
            : [];
        const suggestions = uniqueSuggestions([...aiSuggestions, ...baseSuggestions]).slice(0, 3);

        const hoursSinceLastOutbound = latestOutbound
            ? (Date.now() - latestOutbound.createdAt.getTime()) / (1000 * 60 * 60)
            : null;

        return {
            leadId: lead.id,
            temperature: lead.temperature || 'COLD',
            hotLead: (lead.temperature || 'COLD') === 'HOT',
            objection,
            suggestions,
            followup: {
                ...followupRule,
                overdue:
                    typeof hoursSinceLastOutbound === 'number'
                        ? hoursSinceLastOutbound >= followupRule.delayHours
                        : false,
                hoursSinceLastOutbound:
                    typeof hoursSinceLastOutbound === 'number'
                        ? Number(hoursSinceLastOutbound.toFixed(1))
                        : null,
            },
            latestInbound: latestInbound
                ? {
                      id: latestInbound.id,
                      content: latestInbound.content,
                      channel: latestInbound.type,
                      createdAt: latestInbound.createdAt,
                  }
                : null,
        };
    }

    async handleInboundLeadReply(params: {
        organizationId: string;
        leadId: string;
        content: string;
        channel: MessageChannel;
    }) {
        const lead = await prisma.lead.findFirst({
            where: { id: params.leadId, organizationId: params.organizationId },
            select: {
                id: true,
                fullName: true,
                temperature: true,
                assignedToUserId: true,
            },
        });

        if (!lead) {
            return null;
        }

        const objection = detectObjection(params.content);
        const notificationsCreated: string[] = [];

        if ((lead.temperature || 'COLD') === 'HOT') {
            await notificationService.create({
                organizationId: params.organizationId,
                userId: lead.assignedToUserId || undefined,
                title: 'Lead quente respondeu',
                message: `${lead.fullName || 'Lead'} respondeu no ${channelLabel(params.channel)}.`,
                type: 'WARNING',
                link: `/inbox?leadId=${lead.id}`,
            });
            notificationsCreated.push('hot_reply');
        }

        if (objection && objection.confidence >= 0.6) {
            await notificationService.create({
                organizationId: params.organizationId,
                userId: lead.assignedToUserId || undefined,
                title: `Objecao detectada: ${objection.type}`,
                message: `${lead.fullName || 'Lead'} apresentou objecao de ${objection.type.toLowerCase()}.`,
                type: 'INFO',
                link: `/inbox?leadId=${lead.id}`,
            });
            notificationsCreated.push('objection_detected');
        }

        return {
            leadId: lead.id,
            objection,
            notificationsCreated,
        };
    }

    async enqueueFollowUpScan() {
        const job = await inboxFollowupQueue.add('scan_followups', {});
        return { jobId: String(job.id) };
    }

    async processFollowUpScan() {
        const now = new Date();
        const leads = await prisma.lead.findMany({
            where: {
                status: {
                    notIn: ['CONVERTED', 'NOT_INTERESTED', 'BOUNCED', 'UNSUBSCRIBED'],
                },
                messages: {
                    some: { direction: 'OUTBOUND' },
                },
            },
            select: {
                id: true,
                fullName: true,
                temperature: true,
                tags: true,
                organizationId: true,
                assignedToUserId: true,
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 30,
                    select: {
                        id: true,
                        type: true,
                        direction: true,
                        content: true,
                        createdAt: true,
                        metadata: true,
                    },
                },
            },
        });

        let hotAlerts = 0;
        let warmFollowups = 0;
        let coldNurtures = 0;

        for (const lead of leads) {
            const lastOutbound = lead.messages.find((item) => item.direction === 'OUTBOUND');
            if (!lastOutbound) {
                continue;
            }

            const hasInboundAfterOutbound = lead.messages.some(
                (item) =>
                    item.direction === 'INBOUND' &&
                    item.createdAt.getTime() > lastOutbound.createdAt.getTime()
            );
            if (hasInboundAfterOutbound) {
                continue;
            }

            const temperature = (lead.temperature || 'COLD') as LeadTemperature;
            const rule = followUpRuleForTemperature(temperature);
            const hoursSinceOutbound =
                (now.getTime() - lastOutbound.createdAt.getTime()) / (1000 * 60 * 60);

            if (hoursSinceOutbound < rule.delayHours) {
                continue;
            }

            if (rule.action === 'ALERT_SDR') {
                const link = `/inbox?leadId=${lead.id}`;
                const existingHotAlert = await prisma.notification.findFirst({
                    where: {
                        organizationId: lead.organizationId,
                        userId: lead.assignedToUserId || null,
                        title: 'Lead HOT sem resposta',
                        link,
                        createdAt: {
                            gte: lastOutbound.createdAt,
                        },
                    },
                    select: { id: true },
                });

                if (existingHotAlert) {
                    continue;
                }

                await notificationService.create({
                    organizationId: lead.organizationId,
                    userId: lead.assignedToUserId || undefined,
                    title: 'Lead HOT sem resposta',
                    message: `${lead.fullName || 'Lead'} esta ha ${Math.round(
                        hoursSinceOutbound
                    )}h sem resposta. Recomenda-se follow-up imediato.`,
                    type: 'WARNING',
                    link,
                });
                hotAlerts += 1;
                continue;
            }

            if (rule.action === 'AUTO_FOLLOWUP') {
                const existingAutoFollowup = await prisma.message.findFirst({
                    where: {
                        leadId: lead.id,
                        direction: 'OUTBOUND',
                        metadata: {
                            path: ['followupParentId'],
                            equals: lastOutbound.id,
                        },
                    },
                    select: { id: true },
                });

                if (existingAutoFollowup) {
                    continue;
                }

                await prisma.message.create({
                    data: {
                        leadId: lead.id,
                        type: lastOutbound.type,
                        direction: 'OUTBOUND',
                        status: 'PENDING',
                        content: buildWarmFollowUpTemplate(lead.fullName),
                        metadata: {
                            automatedFollowup: true,
                            followupParentId: lastOutbound.id,
                            followupReason: rule.reason,
                        } as Prisma.InputJsonValue,
                    },
                });
                warmFollowups += 1;
                continue;
            }

            if (rule.action === 'NURTURE') {
                if (lead.tags.includes('nurture_sequence')) {
                    continue;
                }

                await prisma.lead.update({
                    where: { id: lead.id },
                    data: {
                        tags: [...lead.tags, 'nurture_sequence'],
                    },
                });

                await notificationService.create({
                    organizationId: lead.organizationId,
                    userId: lead.assignedToUserId || undefined,
                    title: 'Lead movido para nurture',
                    message: `${lead.fullName || 'Lead'} foi sinalizado para nurture por baixa interacao.`,
                    type: 'INFO',
                    link: `/inbox?leadId=${lead.id}`,
                });
                coldNurtures += 1;
            }
        }

        return {
            scanned: leads.length,
            hotAlerts,
            warmFollowups,
            coldNurtures,
        };
    }
}

export const inboxIntelligenceService = new InboxIntelligenceService();
