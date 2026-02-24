import {
    AgentDecisionRisk,
    AgentDecisionStatus,
    AgentMode,
    AgentRunStatus,
    Plan,
    Prisma,
} from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { inboxIntelligenceService } from '../inbox/inbox-intelligence.service.js';
import { detectObjection, ObjectionType } from '../inbox/objection-detector.js';
import { inboxService } from '../inbox/inbox.service.js';
import { signalService } from '../signals/signal.service.js';
import { signalLayerService } from '../signals/signal-layer.service.js';
import { campaignsService } from '../campaigns/campaigns.service.js';
import { scrapingService, ScrapingSource } from '../scraping/scraping.service.js';
import { sanitizeScrapingQuery } from '../scraping/scraping.validation.js';
import { notificationService } from '../notifications/notifications.service.js';
import { billingService } from '../billing/billing.service.js';
import {
    getAgentCapabilities,
    isAgentModeAllowed,
    PLAN_CATALOG,
    PLAN_ORDER,
} from '../billing/plan-catalog.js';

interface AgentConfigUpdateInput {
    mode?: AgentMode;
    northStarMonthlyMeetings?: number;
    guardrails?: Prisma.InputJsonValue;
}

interface AgentRunCreateInput {
    mode?: AgentMode;
    trigger?: string;
    dryRun?: boolean;
    context?: Prisma.InputJsonValue;
    enforceAutomationQuota?: boolean;
}

interface AgentRunListQuery {
    page: number;
    limit: number;
}

interface AgentHandoffListQuery {
    page: number;
    limit: number;
    status?: 'OPEN' | 'RESOLVED';
}

interface AgentSummaryQuery {
    lookbackDays: number;
}

interface AgentDecisionTemplate {
    type: string;
    title: string;
    reason: string;
    risk: AgentDecisionRisk;
    actionKey: string;
    actionPayload?: Prisma.InputJsonValue;
    confidence?: number;
}

interface AgentGuardrails {
    riskLookbackDays: number;
    riskPauseMinMessages: number;
    riskPauseBounceRate: number;
    riskPauseErrorRate: number;
}

interface AgentRiskPauseEvaluation {
    campaignId: string;
    campaignName: string;
    totalOutbound: number;
    bounced: number;
    failed: number;
    bounceRate: number;
    errorRate: number;
    paused: boolean;
    reason: string | null;
}

interface AgentRiskPauseResult {
    inspectedCampaigns: number;
    pausedCampaigns: number;
    guardrails: AgentGuardrails;
    evaluations: AgentRiskPauseEvaluation[];
}

interface AgentPolicyAction {
    actionKey: string;
    title: string;
    description: string;
    risk: AgentDecisionRisk;
    autonomousInMvp: boolean;
    requiresHumanApproval: boolean;
}

interface AgentModePolicy {
    mode: AgentMode;
    label: string;
    summary: string;
}

interface AgentDraftCampaignCandidate {
    id: string;
    name: string;
    leadsCount: number;
    stepsCount: number;
}

interface AgentVolumeSpikeCandidate {
    source: ScrapingSource;
    query: Record<string, unknown>;
    basedOnJobId: string;
    previousLimit: number;
    recommendedLimit: number;
}

interface AgentSensitiveReplyCandidate {
    leadId: string;
    messageId: string;
    channel: 'EMAIL' | 'WHATSAPP';
    leadName: string | null;
    objectionType: string;
    preview: string;
}

interface AgentContextualReplyCandidate {
    leadId: string;
    messageId: string;
    channel: 'EMAIL' | 'WHATSAPP';
    intent: AgentConversationIntent;
    objectionType: ObjectionType | null;
    handoffReadinessScore: number;
    playbook: 'FIT' | 'NOT_FIT' | 'DEMO' | 'OBJECTION' | 'CURIOUS';
    suggestedReply: string;
    suggestedVariant: AgentExperimentVariant;
    segment: string;
    memorySummary: string;
}

interface AgentAutoCycleOptions {
    trigger?: string;
    enforceAutomationQuota?: boolean;
    initiatedByUserId?: string;
}

interface AgentConversationQuery {
    limit: number;
}

type AgentConversationIntent = 'CURIOUS' | 'FIT' | 'NOT_FIT' | 'DEMO' | 'OBJECTION';
type AgentFeedbackOutcome = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
type AgentExperimentVariant = 'A' | 'B';

interface AgentConversationFeedbackInput {
    reviewedIntent?: AgentConversationIntent;
    reviewedObjectionType?: string;
    outcome?: AgentFeedbackOutcome;
    notes?: string;
}

interface AgentConversationInsight {
    leadId: string;
    leadName: string | null;
    companyName: string | null;
    segment: string;
    messageId: string;
    messageCreatedAt: Date;
    channel: 'EMAIL' | 'WHATSAPP';
    intent: AgentConversationIntent;
    objectionType: ObjectionType | null;
    objectionConfidence: number | null;
    handoffReadinessScore: number;
    shouldEscalate: boolean;
    playbook: 'FIT' | 'NOT_FIT' | 'DEMO' | 'OBJECTION' | 'CURIOUS';
    suggestedReply: string;
    suggestedVariant: AgentExperimentVariant;
    memory: {
        summary: string;
        recentMessages: Array<{
            direction: 'INBOUND' | 'OUTBOUND';
            channel: 'EMAIL' | 'WHATSAPP';
            preview: string;
            createdAt: string;
        }>;
    };
    feedback: {
        reviewedIntent: string | null;
        reviewedObjectionType: string | null;
        outcome: string | null;
        notes: string | null;
        notedAt: string | null;
    } | null;
}

interface AgentOptimizationQuery {
    lookbackDays: number;
}

const NORTH_STAR_METRIC_KEY = 'qualified_meetings_per_month_min_human_intervention';
const NORTH_STAR_METRIC_LABEL =
    'Meetings qualificadas geradas por mes com minima intervencao humana';
const SENSITIVE_COMMERCIAL_KEYWORDS = [
    'preco',
    'valor',
    'custo',
    'contrato',
    'juridico',
    'juridica',
    'legal',
    'security',
    'seguranca',
    'compliance',
    'procurement',
    'dpa',
    'sla',
];
const VALID_SCRAPING_SOURCES: ScrapingSource[] = [
    'google_maps',
    'cnpj',
    'reclame_aqui',
    'indeed',
    'catho',
    'mercado_livre',
    'wappalyzer',
    'linkedin_dork',
    'comprasnet',
];
const AGENT_INTENTS: AgentConversationIntent[] = [
    'CURIOUS',
    'FIT',
    'NOT_FIT',
    'DEMO',
    'OBJECTION',
];

const AGENT_MODE_POLICIES: AgentModePolicy[] = [
    {
        mode: AgentMode.ASSISTED,
        label: 'Assistido',
        summary: 'Agente sugere e o humano aprova antes de executar.',
    },
    {
        mode: AgentMode.SUPERVISED,
        label: 'Supervisionado',
        summary: 'Executa acoes de baixo risco e escala excecoes para humano.',
    },
    {
        mode: AgentMode.AUTONOMOUS,
        label: 'Autonomo',
        summary: 'Opera continuamente dentro de politicas e limites definidos.',
    },
];

const AGENT_DECISION_TEMPLATES: AgentDecisionTemplate[] = [
    {
        type: 'FOLLOWUP_EXISTING_THREAD',
        title: 'Executar follow-up em threads existentes',
        reason: 'Acao de baixo risco para aumentar taxa de resposta qualificada.',
        risk: AgentDecisionRisk.LOW,
        actionKey: 'inbox.followups.recalculate',
        confidence: 0.82,
    },
    {
        type: 'CONTEXTUAL_THREAD_REPLY',
        title: 'Responder thread com playbook contextual',
        reason: 'Acao de baixo risco em thread existente com memoria e playbook.',
        risk: AgentDecisionRisk.LOW,
        actionKey: 'inbox.contextual_thread_reply',
        confidence: 0.73,
    },
    {
        type: 'ADJUST_CHANNEL_WINDOW',
        title: 'Recalibrar janela e canal recomendado',
        reason: 'Atualiza recomendacoes de timing/canal com base em sinais recentes.',
        risk: AgentDecisionRisk.LOW,
        actionKey: 'signals.detect',
        actionPayload: { minConfidence: 60 } as Prisma.InputJsonValue,
        confidence: 0.76,
    },
    {
        type: 'PAUSE_CAMPAIGN_BY_RISK',
        title: 'Validar pausa preventiva de campanha',
        reason: 'Acao de protecao de reputacao quando risco operacional aumenta.',
        risk: AgentDecisionRisk.LOW,
        actionKey: 'campaign.pause_risky',
        confidence: 0.63,
    },
    {
        type: 'FIRST_OUTBOUND_MESSAGE',
        title: 'Enviar primeira mensagem outbound',
        reason: 'Acao de alto risco que impacta reputacao e abordagem inicial.',
        risk: AgentDecisionRisk.HIGH,
        actionKey: 'campaign.first_outbound_message',
        confidence: 0.58,
    },
    {
        type: 'CHANGE_ICP',
        title: 'Alterar ICP ativo',
        reason: 'Mudanca estrategica de alto impacto comercial.',
        risk: AgentDecisionRisk.HIGH,
        actionKey: 'organization.icp.update',
        confidence: 0.52,
    },
    {
        type: 'INCREASE_VOLUME_SPIKE',
        title: 'Aumentar volume de operacao',
        reason: 'Aumento brusco de volume exige validacao humana.',
        risk: AgentDecisionRisk.HIGH,
        actionKey: 'scraping.volume.spike',
        confidence: 0.55,
    },
    {
        type: 'SENSITIVE_COMMERCIAL_REPLY',
        title: 'Responder conversa comercial sensivel',
        reason: 'Preco/seguranca/juridico devem passar por humano.',
        risk: AgentDecisionRisk.HIGH,
        actionKey: 'inbox.commercial_sensitive_reply',
        confidence: 0.67,
    },
];

function nsmSnapshot(target: number) {
    return {
        metric: NORTH_STAR_METRIC_KEY,
        target,
    } as Prisma.InputJsonValue;
}

function readGuardrails(payload: unknown): AgentGuardrails {
    const source =
        payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};

    const riskLookbackDays =
        typeof source['riskLookbackDays'] === 'number' &&
        source['riskLookbackDays'] > 0 &&
        source['riskLookbackDays'] <= 90
            ? Math.round(source['riskLookbackDays'])
            : 14;
    const riskPauseMinMessages =
        typeof source['riskPauseMinMessages'] === 'number' &&
        source['riskPauseMinMessages'] > 0 &&
        source['riskPauseMinMessages'] <= 1000
            ? Math.round(source['riskPauseMinMessages'])
            : 25;
    const riskPauseBounceRate =
        typeof source['riskPauseBounceRate'] === 'number' &&
        source['riskPauseBounceRate'] >= 0 &&
        source['riskPauseBounceRate'] <= 1
            ? source['riskPauseBounceRate']
            : 0.08;
    const riskPauseErrorRate =
        typeof source['riskPauseErrorRate'] === 'number' &&
        source['riskPauseErrorRate'] >= 0 &&
        source['riskPauseErrorRate'] <= 1
            ? source['riskPauseErrorRate']
            : 0.15;

    return {
        riskLookbackDays,
        riskPauseMinMessages,
        riskPauseBounceRate,
        riskPauseErrorRate,
    };
}

function asObject(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
}

function normalizeForMatch(value: string) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function isScrapingSource(value: string): value is ScrapingSource {
    return VALID_SCRAPING_SOURCES.includes(value as ScrapingSource);
}

function extractLeadIdFromPayload(payload: Prisma.JsonValue | null): string | null {
    const source = asObject(payload);
    if (!source) {
        return null;
    }
    return typeof source['leadId'] === 'string' && source['leadId'].trim().length > 0
        ? source['leadId']
        : null;
}

function getMonthStartUtc(base: Date) {
    return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
}

function getDayStartUtc(base: Date) {
    return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
}

function readJsonNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function asString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function firstName(value: string | null | undefined) {
    const normalized = (value || '').trim();
    if (!normalized) {
        return 'oi';
    }
    return normalized.split(/\s+/)[0];
}

function shortPreview(content: string, maxLen = 120) {
    const normalized = content.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLen) {
        return normalized;
    }
    return `${normalized.slice(0, maxLen)}...`;
}

function channelLabel(channel: 'EMAIL' | 'WHATSAPP') {
    return channel === 'WHATSAPP' ? 'WhatsApp' : 'email';
}

function isComplexCommercialObjection(type: ObjectionType | null) {
    return type === 'PRICE' || type === 'TRUST' || type === 'AUTHORITY';
}

function inferIntentFromMessage(content: string, objectionType: ObjectionType | null): AgentConversationIntent {
    const normalized = normalizeForMatch(content);
    if (objectionType && objectionType !== 'OTHER') {
        return 'OBJECTION';
    }
    if (
        normalized.includes('demo') ||
        normalized.includes('reuniao') ||
        normalized.includes('agenda') ||
        normalized.includes('call') ||
        normalized.includes('apresentacao')
    ) {
        return 'DEMO';
    }
    if (
        normalized.includes('sem interesse') ||
        normalized.includes('nao tenho interesse') ||
        normalized.includes('unsubscribe') ||
        normalized.includes('nao faz sentido') ||
        normalized.includes('nao e fit')
    ) {
        return 'NOT_FIT';
    }
    if (
        normalized.includes('quero') ||
        normalized.includes('interesse') ||
        normalized.includes('podemos seguir') ||
        normalized.includes('vamos falar')
    ) {
        return 'FIT';
    }
    return 'CURIOUS';
}

function scoreHandoffReadiness(params: {
    intent: AgentConversationIntent;
    temperature: 'HOT' | 'WARM' | 'COLD' | null;
    objectionType: ObjectionType | null;
    messageSize: number;
}) {
    const byIntent: Record<AgentConversationIntent, number> = {
        DEMO: 90,
        FIT: 78,
        OBJECTION: 70,
        CURIOUS: 58,
        NOT_FIT: 15,
    };
    let score = byIntent[params.intent];

    if (params.temperature === 'HOT') {
        score += 10;
    } else if (params.temperature === 'WARM') {
        score += 5;
    }

    if (isComplexCommercialObjection(params.objectionType)) {
        score += 8;
    }

    if (params.messageSize >= 220) {
        score += 4;
    }

    return clamp(Math.round(score), 0, 100);
}

function resolvePlaybook(intent: AgentConversationIntent) {
    if (intent === 'DEMO') {
        return 'DEMO';
    }
    if (intent === 'FIT') {
        return 'FIT';
    }
    if (intent === 'NOT_FIT') {
        return 'NOT_FIT';
    }
    if (intent === 'OBJECTION') {
        return 'OBJECTION';
    }
    return 'CURIOUS';
}

function chooseExperimentVariant(seed: string): AgentExperimentVariant {
    let hash = 0;
    for (let index = 0; index < seed.length; index += 1) {
        hash = (hash + seed.charCodeAt(index)) % 9973;
    }
    return hash % 2 === 0 ? 'A' : 'B';
}

function resolveLeadSegment(lead: {
    industry: string | null;
    companySize: string | null;
    tags: string[];
}) {
    if (lead.industry && lead.industry.trim().length > 0) {
        return lead.industry.trim();
    }
    if (lead.companySize && lead.companySize.trim().length > 0) {
        return `size:${lead.companySize.trim()}`;
    }
    const firstTag = lead.tags.find((tag) => tag.trim().length > 0);
    return firstTag || 'general';
}

function buildThreadMemory(
    messages: Array<{
        direction: 'INBOUND' | 'OUTBOUND';
        type: 'EMAIL' | 'WHATSAPP';
        content: string;
        createdAt: Date;
    }>
) {
    const ordered = [...messages].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const recentMessages = ordered.slice(-6).map((message) => ({
        direction: message.direction,
        channel: message.type,
        preview: shortPreview(message.content || ''),
        createdAt: message.createdAt.toISOString(),
    }));

    const latestInbound = [...ordered].reverse().find((item) => item.direction === 'INBOUND');
    const latestOutbound = [...ordered].reverse().find((item) => item.direction === 'OUTBOUND');
    const summaryParts: string[] = [];
    if (latestOutbound) {
        summaryParts.push(
            `Ultimo outbound via ${channelLabel(latestOutbound.type)}: "${shortPreview(
                latestOutbound.content || '',
                80
            )}".`
        );
    }
    if (latestInbound) {
        summaryParts.push(
            `Ultimo inbound: "${shortPreview(latestInbound.content || '', 90)}".`
        );
    }

    return {
        summary: summaryParts.join(' '),
        recentMessages,
    };
}

function toConversationFeedback(metadata: unknown) {
    const source = asObject(metadata);
    const feedback = asObject(source?.['agentIntentFeedback']);
    if (!feedback) {
        return null;
    }

    return {
        reviewedIntent: asString(feedback['reviewedIntent']),
        reviewedObjectionType: asString(feedback['reviewedObjectionType']),
        outcome: asString(feedback['outcome']),
        notes: asString(feedback['notes']),
        notedAt: asString(feedback['notedAt']),
    };
}

function readExperimentVariant(metadata: unknown): AgentExperimentVariant | null {
    const source = asObject(metadata);
    const experiment = asObject(source?.['agentExperiment']);
    const variant = asString(experiment?.['variant']);
    if (variant !== 'A' && variant !== 'B') {
        return null;
    }
    return variant;
}

function buildPlaybookReply(params: {
    intent: AgentConversationIntent;
    objectionType: ObjectionType | null;
    channel: 'EMAIL' | 'WHATSAPP';
    leadName: string | null;
    variant: AgentExperimentVariant;
}) {
    const name = firstName(params.leadName);
    const shorter = params.channel === 'WHATSAPP';

    if (params.intent === 'DEMO') {
        return params.variant === 'A'
            ? `Perfeito ${name}. Podemos marcar uma demo objetiva de 20 minutos para mapear seu cenario e mostrar um plano pratico. Quais janelas de horario funcionam para voce esta semana?`
            : `Fechado ${name}. Se fizer sentido, te envio agora duas opcoes de horario para demo curta e voce escolhe a melhor.`;
    }

    if (params.intent === 'FIT') {
        return params.variant === 'A'
            ? `Excelente ${name}. Pelo seu contexto, o proximo passo recomendado e validar um piloto rapido com meta clara de resultado. Posso te enviar um plano inicial em 3 pontos?`
            : `Perfeito ${name}. Vamos para o proximo passo: piloto enxuto + meta de impacto em 30 dias. Quer que eu te mande o cronograma?`;
    }

    if (params.intent === 'NOT_FIT') {
        return `Obrigado pelo retorno, ${name}. Sem problema, encerramos este fluxo por aqui. Se em algum momento o contexto mudar, fico a disposicao para retomar.`;
    }

    if (params.intent === 'OBJECTION') {
        if (params.objectionType === 'PRICE') {
            return params.variant === 'A'
                ? `Entendo seu ponto sobre investimento, ${name}. Podemos comecar por um escopo menor para validar retorno rapido antes de expandir.`
                : `Faz sentido, ${name}. Posso abrir uma opcao de entrada com custo reduzido e meta objetiva para testar sem risco alto.`;
        }
        if (params.objectionType === 'TRUST') {
            return `Boa pergunta, ${name}. Posso te mandar um resumo de seguranca/compliance e casos reais de operacao para te dar visibilidade completa antes de avancarmos.`;
        }
        if (params.objectionType === 'AUTHORITY') {
            return `Perfeito ${name}. Se ajudar, preparo um resumo executivo de 1 pagina para voce compartilhar com o decisor e alinhamos uma conversa conjunta.`;
        }

        return `Obrigado pela transparencia, ${name}. Posso responder ponto a ponto sua objecao com uma proposta pratica para reduzir risco na implementacao.`;
    }

    const curiousA = `Obrigado pelo retorno, ${name}. Posso te responder de forma objetiva e te indicar o proximo passo de menor friccao para validar aderencia no seu cenario.`;
    const curiousB = `Boa pergunta, ${name}. Te envio uma resposta direta com recomendacao pratica e, se fizer sentido, alinhamos uma call curta depois.`;
    if (shorter) {
        return params.variant === 'A' ? curiousA : curiousB;
    }
    return params.variant === 'A'
        ? `${curiousA} Qual objetivo comercial voce quer priorizar agora?`
        : `${curiousB} Qual meta de pipeline e prioridade para as proximas semanas?`;
}

function buildTimeWindow(hourUtc: number) {
    if (hourUtc < 6) {
        return '00:00-05:59';
    }
    if (hourUtc < 12) {
        return '06:00-11:59';
    }
    if (hourUtc < 18) {
        return '12:00-17:59';
    }
    return '18:00-23:59';
}

async function getOrgPlan(organizationId: string) {
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, plan: true },
    });

    if (!org) {
        throw new Error('Organization not found');
    }

    return org.plan;
}

function assertModeForPlan(plan: Plan, mode: AgentMode) {
    if (!isAgentModeAllowed(plan, mode)) {
        throw new Error(`Mode ${mode} is not available for plan ${plan}`);
    }
}

export class AgentService {
    async getModesCatalog() {
        return {
            plans: PLAN_ORDER.map((plan) => ({
                code: plan,
                label: PLAN_CATALOG[plan].label,
                priceCents: PLAN_CATALOG[plan].priceCents,
                currency: PLAN_CATALOG[plan].currency,
                agent: PLAN_CATALOG[plan].agent,
            })),
        };
    }

    async getPolicySummary() {
        const toPolicyAction = (template: AgentDecisionTemplate): AgentPolicyAction => ({
            actionKey: template.actionKey,
            title: template.title,
            description: template.reason,
            risk: template.risk,
            autonomousInMvp: template.risk === AgentDecisionRisk.LOW,
            requiresHumanApproval: template.risk === AgentDecisionRisk.HIGH,
        });

        return {
            northStarMetric: {
                key: NORTH_STAR_METRIC_KEY,
                label: NORTH_STAR_METRIC_LABEL,
            },
            riskMatrix: {
                lowRiskActions: AGENT_DECISION_TEMPLATES.filter(
                    (item) => item.risk === AgentDecisionRisk.LOW
                ).map(toPolicyAction),
                highRiskActions: AGENT_DECISION_TEMPLATES.filter(
                    (item) => item.risk === AgentDecisionRisk.HIGH
                ).map(toPolicyAction),
            },
            modes: AGENT_MODE_POLICIES,
        };
    }

    async getConfig(organizationId: string) {
        const plan = await getOrgPlan(organizationId);
        const defaults = getAgentCapabilities(plan);
        const existing = await prisma.agentConfig.findUnique({
            where: { organizationId },
        });

        let config = existing;
        if (!config) {
            config = await prisma.agentConfig.create({
                data: {
                    organizationId,
                    mode: defaults.defaultMode as AgentMode,
                    northStarMonthlyMeetings: 10,
                },
            });
        } else if (!isAgentModeAllowed(plan, config.mode as AgentMode)) {
            config = await prisma.agentConfig.update({
                where: { id: config.id },
                data: {
                    mode: defaults.defaultMode as AgentMode,
                },
            });
        }

        const normalizedConfig = {
            ...config,
            guardrails: readGuardrails(config.guardrails),
        };

        return {
            plan,
            planAgentCapabilities: defaults,
            config: normalizedConfig,
        };
    }

    async updateConfig(
        organizationId: string,
        userId: string,
        input: AgentConfigUpdateInput
    ) {
        const plan = await getOrgPlan(organizationId);
        const defaults = getAgentCapabilities(plan);
        const nextMode = input.mode || defaults.defaultMode;

        assertModeForPlan(plan, nextMode as AgentMode);

        const existing = await prisma.agentConfig.findUnique({
            where: { organizationId },
            select: { id: true, createdByUserId: true },
        });

        const config = await prisma.agentConfig.upsert({
            where: { organizationId },
            update: {
                mode: nextMode as AgentMode,
                northStarMonthlyMeetings:
                    typeof input.northStarMonthlyMeetings === 'number'
                        ? input.northStarMonthlyMeetings
                        : undefined,
                guardrails: input.guardrails,
                updatedByUserId: userId,
            },
            create: {
                organizationId,
                mode: nextMode as AgentMode,
                northStarMonthlyMeetings:
                    typeof input.northStarMonthlyMeetings === 'number'
                        ? input.northStarMonthlyMeetings
                        : 10,
                guardrails: input.guardrails,
                createdByUserId: existing?.createdByUserId || userId,
                updatedByUserId: userId,
            },
        });

        const normalizedConfig = {
            ...config,
            guardrails: readGuardrails(config.guardrails),
        };

        return {
            plan,
            planAgentCapabilities: defaults,
            config: normalizedConfig,
        };
    }

    async listRuns(organizationId: string, query: AgentRunListQuery) {
        const page = Math.max(1, query.page);
        const limit = Math.max(1, Math.min(100, query.limit));
        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
            prisma.agentRun.findMany({
                where: { organizationId },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    decisions: {
                        orderBy: { createdAt: 'asc' },
                    },
                    handoffs: {
                        orderBy: { createdAt: 'asc' },
                    },
                },
            }),
            prisma.agentRun.count({ where: { organizationId } }),
        ]);

        return {
            items,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / limit)),
            },
        };
    }

    async getRunById(organizationId: string, runId: string) {
        const run = await prisma.agentRun.findFirst({
            where: { id: runId, organizationId },
            include: {
                decisions: {
                    orderBy: { createdAt: 'asc' },
                },
                handoffs: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        });

        if (!run) {
            throw new Error('Agent run not found');
        }

        return run;
    }

    async listHandoffs(organizationId: string, query: AgentHandoffListQuery) {
        const page = Math.max(1, query.page);
        const limit = Math.max(1, Math.min(100, query.limit));
        const skip = (page - 1) * limit;

        const where: Prisma.AgentHandoffWhereInput = {
            organizationId,
        };
        if (query.status) {
            where.status = query.status;
        }

        const [items, total] = await Promise.all([
            prisma.agentHandoff.findMany({
                where,
                skip,
                take: limit,
                orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
                include: {
                    decision: {
                        select: {
                            id: true,
                            title: true,
                            risk: true,
                            status: true,
                        },
                    },
                    lead: {
                        select: {
                            id: true,
                            fullName: true,
                            companyName: true,
                            email: true,
                        },
                    },
                },
            }),
            prisma.agentHandoff.count({ where }),
        ]);

        return {
            items,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / limit)),
            },
        };
    }

    async listConversationInsights(organizationId: string, query: AgentConversationQuery) {
        const limit = clamp(Math.round(query.limit), 1, 50);
        const leads = await prisma.lead.findMany({
            where: {
                organizationId,
                messages: {
                    some: {
                        direction: 'INBOUND',
                    },
                },
            },
            orderBy: {
                updatedAt: 'desc',
            },
            take: limit * 6,
            select: {
                id: true,
                fullName: true,
                companyName: true,
                temperature: true,
                industry: true,
                companySize: true,
                tags: true,
                messages: {
                    orderBy: {
                        createdAt: 'desc',
                    },
                    take: 12,
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

        const items: AgentConversationInsight[] = [];
        for (const lead of leads) {
            const latestInbound = lead.messages.find((message) => message.direction === 'INBOUND');
            if (!latestInbound) {
                continue;
            }

            const hasOutboundAfterInbound = lead.messages.some(
                (message) =>
                    message.direction === 'OUTBOUND' &&
                    message.createdAt.getTime() > latestInbound.createdAt.getTime()
            );
            if (hasOutboundAfterInbound) {
                continue;
            }

            const objection = detectObjection(latestInbound.content || '');
            const intent = inferIntentFromMessage(latestInbound.content || '', objection?.type || null);
            const memory = buildThreadMemory(
                lead.messages.map((message) => ({
                    direction: message.direction,
                    type: message.type,
                    content: message.content || '',
                    createdAt: message.createdAt,
                }))
            );
            const variant = chooseExperimentVariant(lead.id);
            const suggestedReply = buildPlaybookReply({
                intent,
                objectionType: objection?.type || null,
                channel: latestInbound.type,
                leadName: lead.fullName,
                variant,
            });
            const handoffReadinessScore = scoreHandoffReadiness({
                intent,
                temperature: lead.temperature as 'HOT' | 'WARM' | 'COLD' | null,
                objectionType: objection?.type || null,
                messageSize: (latestInbound.content || '').length,
            });
            const shouldEscalate =
                handoffReadinessScore >= 80 ||
                intent === 'DEMO' ||
                (intent === 'OBJECTION' && isComplexCommercialObjection(objection?.type || null));
            const feedback = toConversationFeedback(latestInbound.metadata);

            items.push({
                leadId: lead.id,
                leadName: lead.fullName,
                companyName: lead.companyName,
                segment: resolveLeadSegment(lead),
                messageId: latestInbound.id,
                messageCreatedAt: latestInbound.createdAt,
                channel: latestInbound.type,
                intent,
                objectionType: objection?.type || null,
                objectionConfidence: objection?.confidence || null,
                handoffReadinessScore,
                shouldEscalate,
                playbook: resolvePlaybook(intent),
                suggestedReply,
                suggestedVariant: variant,
                memory,
                feedback,
            });

            if (items.length >= limit) {
                break;
            }
        }

        return {
            generatedAt: new Date().toISOString(),
            limit,
            scannedLeads: leads.length,
            returned: items.length,
            items,
        };
    }

    async recordConversationFeedback(
        organizationId: string,
        messageId: string,
        userId: string,
        input: AgentConversationFeedbackInput
    ) {
        if (input.reviewedIntent && !AGENT_INTENTS.includes(input.reviewedIntent)) {
            throw new Error('Invalid reviewedIntent');
        }

        const message = await prisma.message.findFirst({
            where: {
                id: messageId,
                direction: 'INBOUND',
                lead: {
                    organizationId,
                },
            },
            select: {
                id: true,
                metadata: true,
            },
        });

        if (!message) {
            throw new Error('Inbound message not found');
        }

        const nextMetadata = {
            ...(asObject(message.metadata) || {}),
            agentIntentFeedback: {
                reviewedIntent: input.reviewedIntent || null,
                reviewedObjectionType: input.reviewedObjectionType || null,
                outcome: input.outcome || null,
                notes: input.notes || null,
                notedAt: new Date().toISOString(),
                notedByUserId: userId,
            },
        } as Record<string, unknown>;

        await prisma.message.update({
            where: { id: message.id },
            data: {
                metadata: nextMetadata as Prisma.InputJsonValue,
            },
        });

        return {
            messageId: message.id,
            feedback: toConversationFeedback(nextMetadata as Prisma.InputJsonValue),
        };
    }

    async getOptimizationDashboard(organizationId: string, query: AgentOptimizationQuery) {
        const lookbackDays = clamp(Math.round(query.lookbackDays), 1, 180);
        const now = new Date();
        const since = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
        const midpoint = new Date(now.getTime() - Math.round(lookbackDays / 2) * 24 * 60 * 60 * 1000);

        const [
            outboundMessages,
            inboundMessages,
            meetingsScheduled,
            failedDecisions,
            openHandoffs,
            riskPauseDecisions,
            usageSnapshot,
            cohortStatus,
        ] = await Promise.all([
            prisma.message.findMany({
                where: {
                    direction: 'OUTBOUND',
                    createdAt: { gte: since },
                    lead: {
                        organizationId,
                    },
                },
                select: {
                    id: true,
                    type: true,
                    status: true,
                    repliedAt: true,
                    createdAt: true,
                    metadata: true,
                    lead: {
                        select: {
                            industry: true,
                            companySize: true,
                            tags: true,
                        },
                    },
                },
            }),
            prisma.message.findMany({
                where: {
                    direction: 'INBOUND',
                    createdAt: { gte: since },
                    lead: {
                        organizationId,
                    },
                },
                select: {
                    id: true,
                    type: true,
                    content: true,
                    createdAt: true,
                },
            }),
            prisma.lead.count({
                where: {
                    organizationId,
                    status: 'MEETING_SCHEDULED',
                    updatedAt: { gte: since },
                },
            }),
            prisma.agentDecision.count({
                where: {
                    organizationId,
                    status: AgentDecisionStatus.FAILED,
                    createdAt: { gte: since },
                },
            }),
            prisma.agentHandoff.count({
                where: {
                    organizationId,
                    status: 'OPEN',
                },
            }),
            prisma.agentDecision.findMany({
                where: {
                    organizationId,
                    actionKey: 'campaign.pause_risky',
                    status: AgentDecisionStatus.EXECUTED,
                    createdAt: { gte: since },
                },
                select: {
                    result: true,
                },
            }),
            billingService.getUsageSnapshot(organizationId),
            signalLayerService.getCohortStatus(organizationId).catch(() => null),
        ]);

        const qualifiedReplies = inboundMessages.reduce((accumulator, message) => {
            const objection = detectObjection(message.content || '');
            const intent = inferIntentFromMessage(message.content || '', objection?.type || null);
            return intent === 'FIT' || intent === 'DEMO' || intent === 'OBJECTION'
                ? accumulator + 1
                : accumulator;
        }, 0);

        const intentMixAccumulator = inboundMessages.reduce(
            (accumulator, message) => {
                const objection = detectObjection(message.content || '');
                const intent = inferIntentFromMessage(message.content || '', objection?.type || null);
                accumulator[intent] += 1;
                return accumulator;
            },
            {
                CURIOUS: 0,
                FIT: 0,
                NOT_FIT: 0,
                DEMO: 0,
                OBJECTION: 0,
            } as Record<AgentConversationIntent, number>
        );

        const channelWindowMap = new Map<
            string,
            {
                channel: 'EMAIL' | 'WHATSAPP';
                window: string;
                outbound: number;
                replied: number;
            }
        >();
        const experimentMap = new Map<
            string,
            {
                segment: string;
                channel: 'EMAIL' | 'WHATSAPP';
                variant: AgentExperimentVariant;
                outbound: number;
                replied: number;
            }
        >();

        let previousOutbound = 0;
        let previousReplied = 0;
        let recentOutbound = 0;
        let recentReplied = 0;

        for (const message of outboundMessages) {
            const replied = message.status === 'REPLIED' || Boolean(message.repliedAt);
            const window = buildTimeWindow(message.createdAt.getUTCHours());
            const channelWindowKey = `${message.type}|${window}`;
            const channelWindow =
                channelWindowMap.get(channelWindowKey) ||
                {
                    channel: message.type,
                    window,
                    outbound: 0,
                    replied: 0,
                };
            channelWindow.outbound += 1;
            if (replied) {
                channelWindow.replied += 1;
            }
            channelWindowMap.set(channelWindowKey, channelWindow);

            if (message.createdAt >= midpoint) {
                recentOutbound += 1;
                if (replied) {
                    recentReplied += 1;
                }
            } else {
                previousOutbound += 1;
                if (replied) {
                    previousReplied += 1;
                }
            }

            const variant = readExperimentVariant(message.metadata);
            if (!variant) {
                continue;
            }

            const segment = resolveLeadSegment(message.lead);
            const experimentKey = `${segment}|${message.type}|${variant}`;
            const experiment =
                experimentMap.get(experimentKey) ||
                {
                    segment,
                    channel: message.type,
                    variant,
                    outbound: 0,
                    replied: 0,
                };
            experiment.outbound += 1;
            if (replied) {
                experiment.replied += 1;
            }
            experimentMap.set(experimentKey, experiment);
        }

        const channelWindowPerformance = Array.from(channelWindowMap.values())
            .map((item) => ({
                channel: item.channel,
                window: item.window,
                outbound: item.outbound,
                replied: item.replied,
                replyRate:
                    item.outbound > 0
                        ? Math.round((item.replied / item.outbound) * 10000) / 100
                        : 0,
            }))
            .sort((a, b) => b.replyRate - a.replyRate || b.outbound - a.outbound);

        const experiments = Array.from(experimentMap.values())
            .map((item) => ({
                segment: item.segment,
                channel: item.channel,
                variant: item.variant,
                outbound: item.outbound,
                replied: item.replied,
                replyRate:
                    item.outbound > 0
                        ? Math.round((item.replied / item.outbound) * 10000) / 100
                        : 0,
            }))
            .sort((a, b) => b.replyRate - a.replyRate || b.outbound - a.outbound);

        const abGroups = new Map<
            string,
            {
                segment: string;
                channel: 'EMAIL' | 'WHATSAPP';
                A?: (typeof experiments)[number];
                B?: (typeof experiments)[number];
            }
        >();
        for (const experiment of experiments) {
            const key = `${experiment.segment}|${experiment.channel}`;
            const group = abGroups.get(key) || {
                segment: experiment.segment,
                channel: experiment.channel,
            };
            group[experiment.variant] = experiment;
            abGroups.set(key, group);
        }

        const abRecommendations = Array.from(abGroups.values())
            .filter(
                (group) =>
                    group.A &&
                    group.B &&
                    group.A.outbound >= 3 &&
                    group.B.outbound >= 3
            )
            .map((group) => {
                const winner = (group.A?.replyRate || 0) >= (group.B?.replyRate || 0) ? group.A! : group.B!;
                const loser = winner.variant === 'A' ? group.B! : group.A!;
                const lift =
                    loser.replyRate > 0
                        ? Math.round(((winner.replyRate - loser.replyRate) / loser.replyRate) * 10000) / 100
                        : winner.replyRate > 0
                            ? 100
                            : 0;

                return {
                    segment: group.segment,
                    channel: group.channel,
                    winnerVariant: winner.variant,
                    winnerReplyRate: winner.replyRate,
                    loserVariant: loser.variant,
                    loserReplyRate: loser.replyRate,
                    liftPercent: lift,
                };
            })
            .sort((a, b) => b.liftPercent - a.liftPercent);

        const topChannelWindow =
            channelWindowPerformance.find((item) => item.outbound >= 5) || channelWindowPerformance[0] || null;
        const pausedCampaignsByGuardrail = riskPauseDecisions.reduce((accumulator, decision) => {
            const payload = asObject(decision.result);
            const count = readJsonNumber(payload?.['pausedCampaigns']) || 0;
            return accumulator + count;
        }, 0);

        const previousReplyRate =
            previousOutbound > 0 ? (previousReplied / previousOutbound) * 100 : 0;
        const recentReplyRate = recentOutbound > 0 ? (recentReplied / recentOutbound) * 100 : 0;
        const degradationAlerts: Array<{
            key: string;
            severity: 'INFO' | 'WARNING' | 'CRITICAL';
            message: string;
        }> = [];

        if (previousReplyRate > 0 && recentReplyRate < previousReplyRate * 0.8) {
            degradationAlerts.push({
                key: 'reply_rate_drop',
                severity: 'WARNING',
                message: `Reply rate caiu de ${previousReplyRate.toFixed(2)}% para ${recentReplyRate.toFixed(2)}% no periodo recente.`,
            });
        }

        if (failedDecisions >= 5) {
            degradationAlerts.push({
                key: 'decision_failures',
                severity: failedDecisions >= 10 ? 'CRITICAL' : 'WARNING',
                message: `${failedDecisions} decisoes falharam no periodo analisado.`,
            });
        }

        if (pausedCampaignsByGuardrail > 0) {
            degradationAlerts.push({
                key: 'guardrail_pause',
                severity: 'INFO',
                message: `${pausedCampaignsByGuardrail} pausas preventivas por guardrail foram acionadas.`,
            });
        }

        return {
            generatedAt: now.toISOString(),
            lookbackDays,
            cohort: cohortStatus
                ? {
                    code: cohortStatus.cohort,
                    currentPlan: cohortStatus.currentPlan,
                    recommendedTier: cohortStatus.tierRecommendation.recommendedTier,
                    usagePercent: cohortStatus.usage.usagePercent,
                }
                : null,
            recommendation: topChannelWindow
                ? {
                    channel: topChannelWindow.channel,
                    window: topChannelWindow.window,
                    rationale: cohortStatus
                        ? `Cohort ${cohortStatus.cohort} com melhor resposta em ${topChannelWindow.channel} na janela ${topChannelWindow.window}.`
                        : `Melhor resposta observada em ${topChannelWindow.channel} na janela ${topChannelWindow.window}.`,
                }
                : null,
            channelWindowPerformance,
            experiments,
            abRecommendations,
            alerts: [...usageSnapshot.alerts, ...degradationAlerts],
            executive: {
                results: {
                    qualifiedReplies,
                    meetingsScheduled,
                    intentMix: intentMixAccumulator,
                    recentReplyRate: Math.round(recentReplyRate * 100) / 100,
                    previousReplyRate: Math.round(previousReplyRate * 100) / 100,
                },
                risk: {
                    failedDecisions,
                    openHandoffs,
                    pausedCampaignsByGuardrail,
                },
                cost: {
                    planPriceCents: usageSnapshot.plan.priceCents,
                    planCurrency: usageSnapshot.plan.currency,
                    automationRunsUsed: usageSnapshot.dimensions.automation.runsDaily.used,
                    automationRunsLimit: usageSnapshot.dimensions.automation.runsDaily.limit,
                    automationUsagePercent:
                        usageSnapshot.dimensions.automation.runsDaily.usagePercent,
                    signalsOverageRemaining:
                        usageSnapshot.dimensions.volume.signals.overageRemaining,
                },
            },
        };
    }

    async getSummary(organizationId: string, query: AgentSummaryQuery) {
        const lookbackDays = Math.max(1, Math.min(180, query.lookbackDays));
        const now = new Date();
        const since = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
        const monthStart = getMonthStartUtc(now);
        const dayStart = getDayStartUtc(now);

        const [configPayload, runStatuses, decisionStatuses, decisionRisks, actionBreakdown, handoffStatuses, recentFailures, riskPauseResults, meetingsThisMonth, usageSnapshot] =
            await Promise.all([
                this.getConfig(organizationId),
                prisma.agentRun.groupBy({
                    by: ['status'],
                    where: {
                        organizationId,
                        createdAt: { gte: since },
                    },
                    _count: { _all: true },
                }),
                prisma.agentDecision.groupBy({
                    by: ['status'],
                    where: {
                        organizationId,
                        createdAt: { gte: since },
                    },
                    _count: { _all: true },
                }),
                prisma.agentDecision.groupBy({
                    by: ['risk'],
                    where: {
                        organizationId,
                        createdAt: { gte: since },
                    },
                    _count: { _all: true },
                }),
                prisma.agentDecision.groupBy({
                    by: ['actionKey'],
                    where: {
                        organizationId,
                        status: AgentDecisionStatus.EXECUTED,
                        createdAt: { gte: since },
                    },
                    _count: { _all: true },
                }),
                prisma.agentHandoff.groupBy({
                    by: ['status'],
                    where: {
                        organizationId,
                        createdAt: { gte: since },
                    },
                    _count: { _all: true },
                }),
                prisma.agentDecision.findMany({
                    where: {
                        organizationId,
                        status: AgentDecisionStatus.FAILED,
                        createdAt: { gte: since },
                    },
                    orderBy: { updatedAt: 'desc' },
                    take: 5,
                    select: {
                        id: true,
                        title: true,
                        actionKey: true,
                        errorMessage: true,
                        updatedAt: true,
                    },
                }),
                prisma.agentDecision.findMany({
                    where: {
                        organizationId,
                        actionKey: 'campaign.pause_risky',
                        status: AgentDecisionStatus.EXECUTED,
                        createdAt: { gte: since },
                    },
                    select: {
                        result: true,
                    },
                }),
                prisma.lead.count({
                    where: {
                        organizationId,
                        status: 'MEETING_SCHEDULED',
                        updatedAt: { gte: monthStart },
                    },
                }),
                billingService.getUsageSnapshot(organizationId),
            ]);

        const runsByStatus = Object.fromEntries(
            runStatuses.map((item) => [item.status, item._count._all])
        ) as Record<string, number>;
        const decisionsByStatus = Object.fromEntries(
            decisionStatuses.map((item) => [item.status, item._count._all])
        ) as Record<string, number>;
        const decisionsByRisk = Object.fromEntries(
            decisionRisks.map((item) => [item.risk, item._count._all])
        ) as Record<string, number>;
        const handoffsByStatus = Object.fromEntries(
            handoffStatuses.map((item) => [item.status, item._count._all])
        ) as Record<string, number>;

        const lowRiskTotal = decisionsByRisk[AgentDecisionRisk.LOW] || 0;
        const lowRiskExecuted = await prisma.agentDecision.count({
            where: {
                organizationId,
                risk: AgentDecisionRisk.LOW,
                status: AgentDecisionStatus.EXECUTED,
                createdAt: { gte: since },
            },
        });
        const lowRiskAutoExecuted = await prisma.agentDecision.count({
            where: {
                organizationId,
                risk: AgentDecisionRisk.LOW,
                status: AgentDecisionStatus.EXECUTED,
                createdAt: { gte: since },
                approvedByUserId: null,
            },
        });

        const pausedCampaignsTotal = riskPauseResults.reduce((acc, item) => {
            const payload = asObject(item.result);
            const value = readJsonNumber(payload?.['pausedCampaigns']);
            return acc + (value || 0);
        }, 0);

        const northStarTarget = configPayload.config.northStarMonthlyMeetings;
        const northStarProgressPercent =
            northStarTarget > 0
                ? Math.round((meetingsThisMonth / northStarTarget) * 10000) / 100
                : 0;

        const runsToday = await prisma.agentRun.count({
            where: {
                organizationId,
                createdAt: { gte: dayStart },
            },
        });

        return {
            generatedAt: now.toISOString(),
            lookbackDays,
            northStar: {
                key: NORTH_STAR_METRIC_KEY,
                label: NORTH_STAR_METRIC_LABEL,
                targetMonthly: northStarTarget,
                meetingsThisMonth,
                progressPercent: northStarProgressPercent,
            },
            runs: {
                total: runStatuses.reduce((acc, item) => acc + item._count._all, 0),
                byStatus: runsByStatus,
                today: runsToday,
            },
            decisions: {
                total: decisionStatuses.reduce((acc, item) => acc + item._count._all, 0),
                byStatus: decisionsByStatus,
                byRisk: decisionsByRisk,
                lowRiskExecutionRate:
                    lowRiskTotal > 0 ? Math.round((lowRiskExecuted / lowRiskTotal) * 10000) / 100 : 0,
                lowRiskAutoExecutionRate:
                    lowRiskTotal > 0
                        ? Math.round((lowRiskAutoExecuted / lowRiskTotal) * 10000) / 100
                        : 0,
                actionBreakdown: actionBreakdown
                    .map((item) => ({
                        actionKey: item.actionKey,
                        executed: item._count._all,
                    }))
                    .sort((a, b) => b.executed - a.executed),
            },
            handoffs: {
                total: handoffStatuses.reduce((acc, item) => acc + item._count._all, 0),
                byStatus: handoffsByStatus,
                open: handoffsByStatus.OPEN || 0,
                resolved: handoffsByStatus.RESOLVED || 0,
            },
            risk: {
                pausedCampaignsByGuardrail: pausedCampaignsTotal,
            },
            automationQuota: {
                usedToday: usageSnapshot.dimensions.automation.runsDaily.used,
                limitDaily: usageSnapshot.dimensions.automation.runsDaily.limit,
                remainingToday: usageSnapshot.dimensions.automation.runsDaily.remaining,
                usagePercentToday: usageSnapshot.dimensions.automation.runsDaily.usagePercent,
            },
            recentFailures: recentFailures.map((item) => ({
                id: item.id,
                title: item.title,
                actionKey: item.actionKey,
                errorMessage: item.errorMessage,
                updatedAt: item.updatedAt,
            })),
        };
    }

    async runAutoCycle(organizationId: string, options: AgentAutoCycleOptions = {}) {
        const trigger = options.trigger || 'auto_cycle';
        const configPayload = await this.getConfig(organizationId);
        const mode = configPayload.config.mode as AgentMode;

        if (mode === AgentMode.ASSISTED) {
            return {
                organizationId,
                executed: false,
                reason: 'Mode ASSISTED does not allow automatic cycle execution.',
            };
        }

        const activeRun = await prisma.agentRun.findFirst({
            where: {
                organizationId,
                status: {
                    in: [AgentRunStatus.EXECUTING, AgentRunStatus.APPROVAL_REQUIRED],
                },
            },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                status: true,
                createdAt: true,
            },
        });

        if (activeRun) {
            return {
                organizationId,
                executed: false,
                reason: 'Existing run still active.',
                activeRun,
            };
        }

        if (options.enforceAutomationQuota !== false) {
            await billingService.consumeAutomationRuns(
                organizationId,
                1,
                `automation:agent:${organizationId}:${Date.now()}`
            );
        }

        const run = await this.createRun(organizationId, options.initiatedByUserId || null, {
            mode,
            trigger,
            dryRun: false,
            context: {
                autoCycle: true,
                executedAt: new Date().toISOString(),
                trigger,
            } as Prisma.InputJsonValue,
            enforceAutomationQuota: false,
        });

        return {
            organizationId,
            executed: true,
            runId: run.id,
            status: run.status,
            mode: run.mode,
        };
    }

    async runAutoCycleForAllOrganizations(options: AgentAutoCycleOptions = {}) {
        const organizations = await prisma.organization.findMany({
            select: {
                id: true,
            },
        });

        const results: Array<{
            organizationId: string;
            executed: boolean;
            runId?: string;
            status?: AgentRunStatus;
            mode?: AgentMode;
            reason?: string;
            error?: string;
        }> = [];

        for (const organization of organizations) {
            try {
                const result = await this.runAutoCycle(organization.id, options);
                results.push(result);
            } catch (error) {
                results.push({
                    organizationId: organization.id,
                    executed: false,
                    error: error instanceof Error ? error.message : 'Failed to execute auto cycle',
                });
            }
        }

        return {
            generatedAt: new Date().toISOString(),
            scannedOrganizations: organizations.length,
            executedOrganizations: results.filter((item) => item.executed).length,
            skippedOrganizations: results.filter((item) => !item.executed && !item.error).length,
            failedOrganizations: results.filter((item) => Boolean(item.error)).length,
            results,
        };
    }

    async resolveHandoff(
        organizationId: string,
        handoffId: string,
        notes?: string
    ) {
        const handoff = await prisma.agentHandoff.findFirst({
            where: {
                id: handoffId,
                organizationId,
            },
            select: {
                id: true,
                status: true,
                decisionId: true,
                runId: true,
            },
        });

        if (!handoff) {
            throw new Error('Agent handoff not found');
        }

        if (handoff.status === 'RESOLVED') {
            return prisma.agentHandoff.findUnique({
                where: { id: handoff.id },
            });
        }

        const updated = await prisma.agentHandoff.update({
            where: { id: handoff.id },
            data: {
                status: 'RESOLVED',
                notes: notes || undefined,
                resolvedAt: new Date(),
            },
        });

        if (handoff.decisionId) {
            await prisma.agentDecision.updateMany({
                where: {
                    id: handoff.decisionId,
                    organizationId,
                    status: AgentDecisionStatus.PROPOSED,
                },
                data: {
                    status: AgentDecisionStatus.SKIPPED,
                    requiresApproval: true,
                    result: {
                        handoffResolved: true,
                        reason: notes || 'Resolved manually',
                    } as Prisma.InputJsonValue,
                },
            });
        }

        if (handoff.runId) {
            await this.recalculateRunStatus(organizationId, handoff.runId);
        }

        return updated;
    }

    private async findDraftCampaignCandidate(
        organizationId: string
    ): Promise<AgentDraftCampaignCandidate | null> {
        const campaign = await prisma.campaign.findFirst({
            where: {
                organizationId,
                status: 'DRAFT',
                steps: {
                    some: {},
                },
                leads: {
                    some: {
                        status: {
                            in: ['PENDING', 'IN_PROGRESS', 'PAUSED'],
                        },
                    },
                },
            },
            orderBy: {
                updatedAt: 'desc',
            },
            select: {
                id: true,
                name: true,
                _count: {
                    select: {
                        leads: true,
                        steps: true,
                    },
                },
            },
        });

        if (!campaign) {
            return null;
        }

        return {
            id: campaign.id,
            name: campaign.name,
            leadsCount: campaign._count.leads,
            stepsCount: campaign._count.steps,
        };
    }

    private async findVolumeSpikeCandidate(
        organizationId: string
    ): Promise<AgentVolumeSpikeCandidate | null> {
        const job = await prisma.scrapingJob.findFirst({
            where: {
                organizationId,
                status: {
                    in: ['COMPLETED', 'RUNNING', 'PENDING'],
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            select: {
                id: true,
                source: true,
                query: true,
            },
        });

        if (!job || !isScrapingSource(job.source)) {
            return null;
        }

        const query = asObject(job.query);
        if (!query) {
            return null;
        }

        const rawLimit =
            typeof query['limit'] === 'number'
                ? query['limit']
                : typeof query['limit'] === 'string'
                    ? Number(query['limit'])
                    : NaN;
        const previousLimit =
            Number.isFinite(rawLimit) && rawLimit > 0 ? Math.round(rawLimit) : 100;
        const recommendedLimit = Math.min(1000, Math.max(previousLimit + 1, Math.round(previousLimit * 1.25)));

        if (recommendedLimit <= previousLimit) {
            return null;
        }

        let sanitizedQuery: Record<string, unknown>;
        try {
            sanitizedQuery = sanitizeScrapingQuery(job.source, {
                ...query,
                limit: recommendedLimit,
            });
        } catch {
            return null;
        }

        return {
            source: job.source,
            query: sanitizedQuery,
            basedOnJobId: job.id,
            previousLimit,
            recommendedLimit,
        };
    }

    private async findSensitiveReplyCandidate(
        organizationId: string
    ): Promise<AgentSensitiveReplyCandidate | null> {
        const inboundMessages = await prisma.message.findMany({
            where: {
                direction: 'INBOUND',
                lead: {
                    organizationId,
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 80,
            select: {
                id: true,
                leadId: true,
                type: true,
                content: true,
                lead: {
                    select: {
                        fullName: true,
                    },
                },
            },
        });

        for (const message of inboundMessages) {
            const normalized = normalizeForMatch(message.content || '');
            const objection = detectObjection(message.content || '');
            const sensitiveByObjection =
                objection !== null && ['PRICE', 'TRUST', 'AUTHORITY'].includes(objection.type);
            const sensitiveByKeyword = SENSITIVE_COMMERCIAL_KEYWORDS.some((keyword) =>
                normalized.includes(normalizeForMatch(keyword))
            );

            if (!sensitiveByObjection && !sensitiveByKeyword) {
                continue;
            }

            return {
                leadId: message.leadId,
                messageId: message.id,
                channel: message.type,
                leadName: message.lead?.fullName || null,
                objectionType: objection?.type || 'OTHER',
                preview: message.content.slice(0, 160),
            };
        }

        return null;
    }

    private async findContextualReplyCandidate(
        organizationId: string
    ): Promise<AgentContextualReplyCandidate | null> {
        const insights = await this.listConversationInsights(organizationId, { limit: 12 });
        const candidate = insights.items.find(
            (item) =>
                !item.shouldEscalate &&
                item.intent !== 'NOT_FIT' &&
                item.intent !== 'DEMO' &&
                !(item.intent === 'OBJECTION' && isComplexCommercialObjection(item.objectionType))
        );

        if (!candidate) {
            return null;
        }

        return {
            leadId: candidate.leadId,
            messageId: candidate.messageId,
            channel: candidate.channel,
            intent: candidate.intent,
            objectionType: candidate.objectionType,
            handoffReadinessScore: candidate.handoffReadinessScore,
            playbook: candidate.playbook,
            suggestedReply: candidate.suggestedReply,
            suggestedVariant: candidate.suggestedVariant,
            segment: candidate.segment,
            memorySummary: candidate.memory.summary,
        };
    }

    private async buildTemplatesForRun(
        organizationId: string,
        context?: Prisma.InputJsonValue
    ): Promise<AgentDecisionTemplate[]> {
        const lowRiskTemplates = AGENT_DECISION_TEMPLATES.filter(
            (template) => template.risk === AgentDecisionRisk.LOW
                && template.actionKey !== 'inbox.contextual_thread_reply'
        ).map((template) => ({
            ...template,
            actionPayload: template.actionPayload
                ? ({ ...(asObject(template.actionPayload) || {}) } as Prisma.InputJsonValue)
                : undefined,
        }));

        const [draftCampaign, volumeSpike, sensitiveReply, contextualReply] = await Promise.all([
            this.findDraftCampaignCandidate(organizationId),
            this.findVolumeSpikeCandidate(organizationId),
            this.findSensitiveReplyCandidate(organizationId),
            this.findContextualReplyCandidate(organizationId),
        ]);

        const contextualTemplate = AGENT_DECISION_TEMPLATES.find(
            (template) => template.actionKey === 'inbox.contextual_thread_reply'
        );
        if (contextualTemplate && contextualReply) {
            lowRiskTemplates.push({
                ...contextualTemplate,
                title: `Responder thread com playbook (${contextualReply.segment})`,
                reason: `Intent ${contextualReply.intent} com score de handoff ${contextualReply.handoffReadinessScore}.`,
                confidence: Math.max(contextualTemplate.confidence || 0.73, 0.79),
                actionPayload: {
                    leadId: contextualReply.leadId,
                    messageId: contextualReply.messageId,
                    channel: contextualReply.channel,
                    intent: contextualReply.intent,
                    objectionType: contextualReply.objectionType,
                    playbook: contextualReply.playbook,
                    replyDraft: contextualReply.suggestedReply,
                    segment: contextualReply.segment,
                    handoffReadinessScore: contextualReply.handoffReadinessScore,
                    memorySummary: contextualReply.memorySummary,
                    experiment: {
                        variant: contextualReply.suggestedVariant,
                        segment: contextualReply.segment,
                        channel: contextualReply.channel,
                    },
                } as Prisma.InputJsonValue,
            });
        }

        const highRiskTemplates: AgentDecisionTemplate[] = [];
        const firstOutboundTemplate = AGENT_DECISION_TEMPLATES.find(
            (template) => template.actionKey === 'campaign.first_outbound_message'
        );
        if (firstOutboundTemplate && draftCampaign) {
            highRiskTemplates.push({
                ...firstOutboundTemplate,
                title: `Enviar primeira mensagem outbound (${draftCampaign.name})`,
                reason: `Campanha em draft com ${draftCampaign.leadsCount} leads e ${draftCampaign.stepsCount} passos pronta para ativacao.`,
                confidence: Math.max(firstOutboundTemplate.confidence || 0.58, 0.74),
                actionPayload: {
                    campaignId: draftCampaign.id,
                    campaignName: draftCampaign.name,
                    leadsCount: draftCampaign.leadsCount,
                    stepsCount: draftCampaign.stepsCount,
                } as Prisma.InputJsonValue,
            });
        }

        const contextObject = asObject(context);
        const proposedIcp =
            asObject(contextObject?.['proposedIcp']) || asObject(contextObject?.['icpDefinition']);
        const icpTemplate = AGENT_DECISION_TEMPLATES.find(
            (template) => template.actionKey === 'organization.icp.update'
        );
        if (icpTemplate && proposedIcp) {
            highRiskTemplates.push({
                ...icpTemplate,
                reason: 'Contexto do run trouxe proposta de mudanca de ICP para validacao humana.',
                confidence: Math.max(icpTemplate.confidence || 0.52, 0.64),
                actionPayload: {
                    icpDefinition: proposedIcp,
                    source: 'run_context',
                } as Prisma.InputJsonValue,
            });
        }

        const volumeTemplate = AGENT_DECISION_TEMPLATES.find(
            (template) => template.actionKey === 'scraping.volume.spike'
        );
        if (volumeTemplate && volumeSpike) {
            highRiskTemplates.push({
                ...volumeTemplate,
                title: `Aumentar volume de scraping (${volumeSpike.source})`,
                reason: `Sugestao de aumento de limite de ${volumeSpike.previousLimit} para ${volumeSpike.recommendedLimit} com base no ultimo job.`,
                confidence: Math.max(volumeTemplate.confidence || 0.55, 0.69),
                actionPayload: {
                    source: volumeSpike.source,
                    query: volumeSpike.query,
                    basedOnJobId: volumeSpike.basedOnJobId,
                    previousLimit: volumeSpike.previousLimit,
                    recommendedLimit: volumeSpike.recommendedLimit,
                } as Prisma.InputJsonValue,
            });
        }

        const sensitiveTemplate = AGENT_DECISION_TEMPLATES.find(
            (template) => template.actionKey === 'inbox.commercial_sensitive_reply'
        );
        if (sensitiveTemplate && sensitiveReply) {
            highRiskTemplates.push({
                ...sensitiveTemplate,
                title: `Responder conversa sensivel (${sensitiveReply.leadName || 'Lead sem nome'})`,
                reason: `Mensagem inbound com risco comercial (${sensitiveReply.objectionType}). Exige revisao humana.`,
                confidence: Math.max(sensitiveTemplate.confidence || 0.67, 0.75),
                actionPayload: {
                    leadId: sensitiveReply.leadId,
                    messageId: sensitiveReply.messageId,
                    channel: sensitiveReply.channel,
                    objectionType: sensitiveReply.objectionType,
                    preview: sensitiveReply.preview,
                } as Prisma.InputJsonValue,
            });
        }

        return [...lowRiskTemplates, ...highRiskTemplates];
    }

    private async pauseRiskyCampaigns(organizationId: string): Promise<AgentRiskPauseResult> {
        const [config, activeCampaigns] = await Promise.all([
            prisma.agentConfig.findUnique({
                where: { organizationId },
                select: { guardrails: true },
            }),
            prisma.campaign.findMany({
                where: {
                    organizationId,
                    status: 'ACTIVE',
                },
                select: {
                    id: true,
                    name: true,
                },
            }),
        ]);

        const guardrails = readGuardrails(config?.guardrails);
        const since = new Date(
            Date.now() - guardrails.riskLookbackDays * 24 * 60 * 60 * 1000
        );

        const evaluations: AgentRiskPauseEvaluation[] = [];

        for (const campaign of activeCampaigns) {
            const whereBase: Prisma.MessageWhereInput = {
                direction: 'OUTBOUND',
                createdAt: {
                    gte: since,
                },
                metadata: {
                    path: ['campaignId'],
                    equals: campaign.id,
                },
            };

            const [totalOutbound, bounced, failed] = await Promise.all([
                prisma.message.count({
                    where: whereBase,
                }),
                prisma.message.count({
                    where: {
                        ...whereBase,
                        status: 'BOUNCED',
                    },
                }),
                prisma.message.count({
                    where: {
                        ...whereBase,
                        status: 'FAILED',
                    },
                }),
            ]);

            const bounceRate = totalOutbound > 0 ? bounced / totalOutbound : 0;
            const errorRate = totalOutbound > 0 ? (bounced + failed) / totalOutbound : 0;

            const shouldPause =
                totalOutbound >= guardrails.riskPauseMinMessages &&
                (bounceRate >= guardrails.riskPauseBounceRate ||
                    errorRate >= guardrails.riskPauseErrorRate);

            if (shouldPause) {
                await campaignsService.pause(organizationId, campaign.id);
            }

            evaluations.push({
                campaignId: campaign.id,
                campaignName: campaign.name,
                totalOutbound,
                bounced,
                failed,
                bounceRate: Number(bounceRate.toFixed(4)),
                errorRate: Number(errorRate.toFixed(4)),
                paused: shouldPause,
                reason: shouldPause ? 'Campaign paused due to risk thresholds.' : null,
            });
        }

        return {
            inspectedCampaigns: activeCampaigns.length,
            pausedCampaigns: evaluations.filter((item) => item.paused).length,
            guardrails,
            evaluations,
        };
    }

    private async executeDecision(
        organizationId: string,
        decision: { id: string; actionKey: string; actionPayload: Prisma.JsonValue | null }
    ) {
        if (decision.actionKey === 'inbox.followups.recalculate') {
            const result = await inboxIntelligenceService.enqueueFollowUpScan();
            return {
                action: decision.actionKey,
                ...result,
            } as Prisma.InputJsonValue;
        }

        if (decision.actionKey === 'inbox.contextual_thread_reply') {
            const payload = asObject(decision.actionPayload);
            const leadId = asString(payload?.['leadId']);
            const channel = asString(payload?.['channel']);
            const replyDraft = asString(payload?.['replyDraft']);
            const intent = asString(payload?.['intent']);
            const playbook = asString(payload?.['playbook']);
            const segment = asString(payload?.['segment']);
            const memorySummary = asString(payload?.['memorySummary']);
            const experiment = asObject(payload?.['experiment']);
            const variant = asString(experiment?.['variant']);

            if (!leadId || !replyDraft || (channel !== 'EMAIL' && channel !== 'WHATSAPP')) {
                throw new Error('Missing leadId/channel/replyDraft for contextual thread reply');
            }

            const outbound = await inboxService.sendMessage(organizationId, leadId, {
                content: replyDraft,
                type: channel,
                metadata: {
                    agentReply: true,
                    agentActionKey: decision.actionKey,
                    agentIntent: intent,
                    agentPlaybook: playbook,
                    agentMemorySummary: memorySummary,
                    agentExperiment: {
                        variant: variant === 'A' || variant === 'B' ? variant : 'A',
                        segment: segment || 'general',
                        channel,
                    },
                } as Prisma.InputJsonValue,
            });

            return {
                action: decision.actionKey,
                sent: true,
                outboundMessageId: outbound.id,
                leadId,
                channel,
                variant: variant === 'A' || variant === 'B' ? variant : 'A',
            } as Prisma.InputJsonValue;
        }

        if (decision.actionKey === 'signals.detect') {
            const payload =
                decision.actionPayload && typeof decision.actionPayload === 'object'
                    ? (decision.actionPayload as Record<string, unknown>)
                    : {};
            const minConfidence =
                typeof payload['minConfidence'] === 'number'
                    ? payload['minConfidence']
                    : undefined;
            const result = await signalService.runDetectionForOrganization(organizationId, {
                minConfidence,
            });
            return {
                action: decision.actionKey,
                ...result,
            } as Prisma.InputJsonValue;
        }

        if (decision.actionKey === 'campaign.pause_risky') {
            const result = await this.pauseRiskyCampaigns(organizationId);
            return {
                action: decision.actionKey,
                ...result,
            } as unknown as Prisma.InputJsonValue;
        }

        if (decision.actionKey === 'campaign.first_outbound_message') {
            const payload = asObject(decision.actionPayload);
            let campaignId =
                typeof payload?.['campaignId'] === 'string' ? String(payload['campaignId']) : null;

            if (!campaignId) {
                const fallbackCampaign = await this.findDraftCampaignCandidate(organizationId);
                campaignId = fallbackCampaign?.id || null;
            }

            if (!campaignId) {
                throw new Error('No eligible campaign found for first outbound message action');
            }

            await campaignsService.launch(organizationId, campaignId);

            return {
                action: decision.actionKey,
                launched: true,
                campaignId,
            } as Prisma.InputJsonValue;
        }

        if (decision.actionKey === 'organization.icp.update') {
            const payload = asObject(decision.actionPayload);
            const icpDefinition = asObject(payload?.['icpDefinition']);
            if (!icpDefinition) {
                throw new Error('Missing icpDefinition payload for organization.icp.update action');
            }

            const updateResult = await prisma.organization.updateMany({
                where: { id: organizationId },
                data: {
                    icpDefinition: icpDefinition as Prisma.InputJsonValue,
                },
            });

            if (updateResult.count === 0) {
                throw new Error('Organization not found for ICP update');
            }

            return {
                action: decision.actionKey,
                updated: true,
                icpFields: Object.keys(icpDefinition).length,
            } as Prisma.InputJsonValue;
        }

        if (decision.actionKey === 'scraping.volume.spike') {
            const payload = asObject(decision.actionPayload);
            const source = typeof payload?.['source'] === 'string' ? payload['source'] : null;
            const query = asObject(payload?.['query']);

            if (!source || !isScrapingSource(source) || !query) {
                throw new Error('Missing source/query payload for scraping.volume.spike action');
            }

            const sanitizedQuery = sanitizeScrapingQuery(source, query);
            const createdJob = await scrapingService.createJob(organizationId, {
                name: `Agent volume spike ${source}`,
                source,
                query: sanitizedQuery,
            });

            return {
                action: decision.actionKey,
                queued: true,
                scrapingJobId: createdJob.id,
                source,
                limit:
                    typeof sanitizedQuery['limit'] === 'number'
                        ? sanitizedQuery['limit']
                        : null,
            } as Prisma.InputJsonValue;
        }

        if (decision.actionKey === 'inbox.commercial_sensitive_reply') {
            const payload = asObject(decision.actionPayload);
            const leadId = typeof payload?.['leadId'] === 'string' ? payload['leadId'] : null;
            const preview = typeof payload?.['preview'] === 'string' ? payload['preview'] : '';

            if (!leadId) {
                return {
                    action: decision.actionKey,
                    notified: false,
                    reason: 'No lead context available for sensitive conversation handoff.',
                } as Prisma.InputJsonValue;
            }

            await notificationService.create({
                organizationId,
                title: 'Handoff comercial sensivel',
                message: preview
                    ? `Lead ${leadId}: ${preview}`
                    : `Lead ${leadId} exige resposta comercial supervisionada.`,
                type: 'WARNING',
                link: `/inbox?leadId=${leadId}`,
            });

            return {
                action: decision.actionKey,
                notified: true,
                leadId,
            } as Prisma.InputJsonValue;
        }

        return {
            action: decision.actionKey,
            simulated: true,
            reason: 'Executor not wired yet.',
        } as Prisma.InputJsonValue;
    }

    private async recalculateRunStatus(organizationId: string, runId: string) {
        const decisions = await prisma.agentDecision.findMany({
            where: { organizationId, runId },
            select: { status: true },
        });

        const hasPendingApproval = decisions.some(
            (item) => item.status === AgentDecisionStatus.PROPOSED
        );
        const hasApprovedPendingExecution = decisions.some(
            (item) => item.status === AgentDecisionStatus.APPROVED
        );
        const hasFailed = decisions.some((item) => item.status === AgentDecisionStatus.FAILED);

        let nextStatus: AgentRunStatus = AgentRunStatus.COMPLETED;
        if (hasPendingApproval) {
            nextStatus = AgentRunStatus.APPROVAL_REQUIRED;
        } else if (hasApprovedPendingExecution) {
            nextStatus = AgentRunStatus.EXECUTING;
        } else if (hasFailed) {
            nextStatus = AgentRunStatus.FAILED;
        }

        const run = await prisma.agentRun.update({
            where: { id: runId },
            data: {
                status: nextStatus,
                finishedAt:
                    nextStatus === AgentRunStatus.COMPLETED || nextStatus === AgentRunStatus.FAILED
                        ? new Date()
                        : null,
            },
            include: {
                decisions: true,
                handoffs: true,
            },
        });

        return run;
    }

    private async resolveOpenHandoffsForDecision(
        organizationId: string,
        decisionId: string,
        notes: string
    ) {
        await prisma.agentHandoff.updateMany({
            where: {
                organizationId,
                decisionId,
                status: 'OPEN',
            },
            data: {
                status: 'RESOLVED',
                notes,
                resolvedAt: new Date(),
            },
        });
    }

    private async executeApprovedDecisionsInternal(organizationId: string, runId: string) {
        const decisions = await prisma.agentDecision.findMany({
            where: {
                organizationId,
                runId,
                status: AgentDecisionStatus.APPROVED,
            },
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                actionKey: true,
                actionPayload: true,
            },
        });

        for (const decision of decisions) {
            try {
                const result = await this.executeDecision(organizationId, decision);
                await prisma.agentDecision.update({
                    where: { id: decision.id },
                    data: {
                        status: AgentDecisionStatus.EXECUTED,
                        executedAt: new Date(),
                        result,
                        errorMessage: null,
                    },
                });
                await this.resolveOpenHandoffsForDecision(
                    organizationId,
                    decision.id,
                    'Resolved automatically after decision execution.'
                );
            } catch (error) {
                await prisma.agentDecision.update({
                    where: { id: decision.id },
                    data: {
                        status: AgentDecisionStatus.FAILED,
                        executedAt: new Date(),
                        errorMessage:
                            error instanceof Error ? error.message : 'Failed to execute decision',
                    },
                });
            }
        }

        return this.recalculateRunStatus(organizationId, runId);
    }

    async executeApprovedDecisions(organizationId: string, runId: string) {
        await this.getRunById(organizationId, runId);
        return this.executeApprovedDecisionsInternal(organizationId, runId);
    }

    async approveDecision(
        organizationId: string,
        decisionId: string,
        userId: string,
        execute = true,
        actionPayload?: Prisma.InputJsonValue
    ) {
        const decision = await prisma.agentDecision.findFirst({
            where: {
                id: decisionId,
                organizationId,
            },
            select: {
                id: true,
                runId: true,
                status: true,
            },
        });

        if (!decision) {
            throw new Error('Agent decision not found');
        }

        if (decision.status !== AgentDecisionStatus.PROPOSED) {
            throw new Error('Only proposed decisions can be approved');
        }

        await prisma.agentDecision.update({
            where: { id: decisionId },
            data: {
                status: AgentDecisionStatus.APPROVED,
                approvedByUserId: userId,
                approvedAt: new Date(),
                actionPayload: actionPayload !== undefined ? actionPayload : undefined,
            },
        });

        if (execute) {
            await this.executeApprovedDecisionsInternal(organizationId, decision.runId);
        } else {
            await this.recalculateRunStatus(organizationId, decision.runId);
        }

        return this.getRunById(organizationId, decision.runId);
    }

    async rejectDecision(organizationId: string, decisionId: string, userId: string) {
        const decision = await prisma.agentDecision.findFirst({
            where: {
                id: decisionId,
                organizationId,
            },
            select: {
                id: true,
                runId: true,
                status: true,
            },
        });

        if (!decision) {
            throw new Error('Agent decision not found');
        }

        if (decision.status !== AgentDecisionStatus.PROPOSED) {
            throw new Error('Only proposed decisions can be rejected');
        }

        await prisma.agentDecision.update({
            where: { id: decision.id },
            data: {
                status: AgentDecisionStatus.REJECTED,
                approvedByUserId: userId,
                approvedAt: new Date(),
                requiresApproval: true,
                result: {
                    rejectedBy: userId,
                    reason: 'Manual rejection',
                } as Prisma.InputJsonValue,
            },
        });
        await this.resolveOpenHandoffsForDecision(
            organizationId,
            decision.id,
            'Resolved after manual decision rejection.'
        );

        await this.recalculateRunStatus(organizationId, decision.runId);
        return this.getRunById(organizationId, decision.runId);
    }

    async createRun(organizationId: string, userId: string | null, input: AgentRunCreateInput) {
        const plan = await getOrgPlan(organizationId);
        const configPayload = await this.getConfig(organizationId);
        const planAgent = getAgentCapabilities(plan);
        const mode = (input.mode || configPayload.config.mode) as AgentMode;
        const dryRun = Boolean(input.dryRun);

        assertModeForPlan(plan, mode);

        if (!dryRun && input.enforceAutomationQuota) {
            await billingService.consumeAutomationRuns(
                organizationId,
                1,
                `automation:agent:manual:${organizationId}:${Date.now()}`
            );
        }

        const templates = await this.buildTemplatesForRun(organizationId, input.context);
        const autoExecuteLowRisk =
            !dryRun &&
            mode !== AgentMode.ASSISTED &&
            planAgent.autoExecuteLowRisk;

        const run = await prisma.$transaction(async (tx) => {
            const createdRun = await tx.agentRun.create({
                data: {
                    organizationId,
                    mode,
                    trigger: input.trigger || 'manual',
                    dryRun,
                    status: dryRun
                        ? AgentRunStatus.DRAFT
                        : mode === AgentMode.ASSISTED
                            ? AgentRunStatus.APPROVAL_REQUIRED
                            : AgentRunStatus.EXECUTING,
                    goalSnapshot: nsmSnapshot(configPayload.config.northStarMonthlyMeetings),
                    inputSnapshot: {
                        context: input.context || {},
                        plan,
                        planAgent,
                    } as Prisma.InputJsonValue,
                    summary: dryRun
                        ? 'Dry-run generated. No side effects executed.'
                        : `Run started in ${mode} mode.`,
                    startedAt: new Date(),
                    createdByUserId: userId || undefined,
                },
            });

            for (const template of templates) {
                const isLowRisk = template.risk === AgentDecisionRisk.LOW;
                const shouldAutoApprove = autoExecuteLowRisk && isLowRisk;
                await tx.agentDecision.create({
                    data: {
                        organizationId,
                        runId: createdRun.id,
                        type: template.type,
                        title: template.title,
                        reason: template.reason,
                        risk: template.risk,
                        actionKey: template.actionKey,
                        actionPayload: template.actionPayload,
                        confidence: template.confidence,
                        status: shouldAutoApprove
                            ? AgentDecisionStatus.APPROVED
                            : AgentDecisionStatus.PROPOSED,
                        requiresApproval: !shouldAutoApprove,
                    },
                });
            }

            return createdRun;
        });

        if (!dryRun) {
            const highRiskDecisions = await prisma.agentDecision.findMany({
                where: {
                    organizationId,
                    runId: run.id,
                    risk: AgentDecisionRisk.HIGH,
                    status: AgentDecisionStatus.PROPOSED,
                },
                select: {
                    id: true,
                    title: true,
                    reason: true,
                    actionPayload: true,
                    actionKey: true,
                },
            });

            if (highRiskDecisions.length > 0) {
                await prisma.agentHandoff.createMany({
                    data: highRiskDecisions.map((decision) => ({
                        organizationId,
                        runId: run.id,
                        decisionId: decision.id,
                        leadId: extractLeadIdFromPayload(decision.actionPayload),
                        reason: decision.title,
                        notes: decision.reason || 'High-risk action requires human review.',
                        details: {
                            actionKey: decision.actionKey,
                            actionPayload: decision.actionPayload,
                        } as Prisma.InputJsonValue,
                        status: 'OPEN',
                    })),
                });
            }
        }

        if (autoExecuteLowRisk) {
            await this.executeApprovedDecisionsInternal(organizationId, run.id);
        } else if (dryRun) {
            await prisma.agentRun.update({
                where: { id: run.id },
                data: {
                    status: AgentRunStatus.COMPLETED,
                    finishedAt: new Date(),
                },
            });
        }

        if (!dryRun && !autoExecuteLowRisk) {
            await this.recalculateRunStatus(organizationId, run.id);
        }

        return this.getRunById(organizationId, run.id);
    }
}

export const agentService = new AgentService();
