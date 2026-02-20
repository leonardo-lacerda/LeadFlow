import { Worker } from 'bullmq';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { campaignQueue } from '../lib/queue.js';
import { emailService } from '../modules/email/email.service.js';
import { whatsappService } from '../modules/whatsapp/whatsapp.service.js';

interface CampaignJobData {
    campaignLeadId: string;
    scheduledFor?: string;
    stepIndex?: number;
}

let started = false;

function delayForStep(step: { delayDays: number | null; delayHours: number | null }) {
    const hours = (step.delayDays || 0) * 24 + (step.delayHours || 0);
    return Math.max(0, hours * 60 * 60 * 1000);
}

function mapLeadStatus(status?: string) {
    if (!status) {
        return null;
    }
    if (status === 'REPLIED') {
        return 'REPLIED';
    }
    if (status === 'BOUNCED') {
        return 'BOUNCED';
    }
    if (status === 'UNSUBSCRIBED') {
        return 'UNSUBSCRIBED';
    }
    if (status === 'NOT_INTERESTED') {
        return 'PAUSED';
    }
    return null;
}

function resolveValue(data: Record<string, unknown>, path: string) {
    let current: unknown = data;
    for (const part of path.split('.')) {
        if (current && typeof current === 'object' && part in current) {
            current = (current as Record<string, unknown>)[part];
        } else {
            return undefined;
        }
    }
    return current;
}

function evaluateCondition(condition: Record<string, unknown>, context: Record<string, unknown>) {
    const field = typeof condition['field'] === 'string' ? condition['field'] : undefined;
    if (!field) {
        return true;
    }
    const operator =
        typeof condition['operator'] === 'string' ? condition['operator'] : 'equals';
    const expected = condition['value'];
    const actual = resolveValue(context, field);

    switch (operator) {
        case 'not_equals':
            return actual !== expected;
        case 'contains':
            if (Array.isArray(actual)) {
                return actual.includes(expected);
            }
            if (typeof actual === 'string') {
                return actual.includes(String(expected));
            }
            return false;
        case 'exists':
            return actual !== undefined && actual !== null && actual !== '';
        case 'equals':
        default:
            return actual === expected;
    }
}

async function scheduleNextStep(campaignLeadId: string, stepIndex: number, delayMs: number) {
    const scheduledFor = new Date(Date.now() + delayMs);
    await prisma.campaignLead.update({
        where: { id: campaignLeadId },
        data: { currentStep: stepIndex, nextActionAt: scheduledFor, status: 'IN_PROGRESS' },
    });
    await campaignQueue.add(
        'process',
        { campaignLeadId, scheduledFor: scheduledFor.toISOString(), stepIndex },
        { delay: delayMs, removeOnComplete: true, removeOnFail: true }
    );
}

export function startCampaignWorker() {
    if (started) {
        return;
    }
    started = true;

    const connection = {
        host: redis.options.host,
        port: redis.options.port,
        password: redis.options.password,
    };

    new Worker(
        'campaign',
        async (job) => {
            const data = job.data as CampaignJobData;

            const campaignLead = await prisma.campaignLead.findUnique({
                where: { id: data.campaignLeadId },
                include: {
                    lead: true,
                    campaign: {
                        include: {
                            steps: { orderBy: { order: 'asc' } },
                        },
                    },
                },
            });

            if (!campaignLead) {
                return;
            }

            if (campaignLead.campaign.status !== 'ACTIVE') {
                return;
            }

            if (['COMPLETED', 'REPLIED', 'BOUNCED', 'UNSUBSCRIBED', 'PAUSED'].includes(campaignLead.status)) {
                return;
            }

            if (campaignLead.nextActionAt && data.scheduledFor) {
                const scheduledAt = new Date(data.scheduledFor).getTime();
                if (Math.abs(campaignLead.nextActionAt.getTime() - scheduledAt) > 1000) {
                    return;
                }
            }

            if (campaignLead.nextActionAt && campaignLead.nextActionAt > new Date()) {
                const delay = campaignLead.nextActionAt.getTime() - Date.now();
                await scheduleNextStep(campaignLead.id, campaignLead.currentStep, delay);
                return;
            }

            const stopStatus = mapLeadStatus(campaignLead.lead.status || undefined);
            if (stopStatus) {
                await prisma.campaignLead.update({
                    where: { id: campaignLead.id },
                    data: { status: stopStatus, nextActionAt: null },
                });
                return;
            }

            const steps = campaignLead.campaign.steps;
            const stepIndex = campaignLead.currentStep;
            const step = steps[stepIndex];

            if (!step) {
                await prisma.campaignLead.update({
                    where: { id: campaignLead.id },
                    data: { status: 'COMPLETED', nextActionAt: null },
                });
                return;
            }

            const metadata = {
                campaignId: campaignLead.campaignId,
                campaignLeadId: campaignLead.id,
                stepId: step.id,
                stepOrder: step.order,
                stepType: step.type,
            };

            if (step.type === 'WAIT') {
                const nextStep = steps[stepIndex + 1];
                if (!nextStep) {
                    await prisma.campaignLead.update({
                        where: { id: campaignLead.id },
                        data: { status: 'COMPLETED', nextActionAt: null, currentStep: stepIndex + 1 },
                    });
                    return;
                }
                await scheduleNextStep(campaignLead.id, stepIndex + 1, delayForStep(nextStep));
                return;
            }

            if (step.type === 'CONDITION') {
                let condition: Record<string, unknown> = {};
                try {
                    condition = JSON.parse(step.content || '{}') as Record<string, unknown>;
                } catch {
                    condition = {};
                }
                const latestMessage = await prisma.message.findFirst({
                    where: { leadId: campaignLead.leadId },
                    orderBy: { createdAt: 'desc' },
                });
                const context = {
                    lead: campaignLead.lead,
                    campaignLead,
                    message: latestMessage,
                };
                const passed = evaluateCondition(condition, context as Record<string, unknown>);
                if (!passed) {
                    const action =
                        typeof condition['action'] === 'string' ? condition['action'] : 'skip';
                    if (action === 'stop') {
                        await prisma.campaignLead.update({
                            where: { id: campaignLead.id },
                            data: { status: 'PAUSED', nextActionAt: null },
                        });
                        return;
                    }
                }
                const nextStep = steps[stepIndex + 1];
                if (!nextStep) {
                    await prisma.campaignLead.update({
                        where: { id: campaignLead.id },
                        data: { status: 'COMPLETED', nextActionAt: null, currentStep: stepIndex + 1 },
                    });
                    return;
                }
                await scheduleNextStep(campaignLead.id, stepIndex + 1, delayForStep(nextStep));
                return;
            }

            if (step.type === 'EMAIL') {
                if (!campaignLead.lead.email) {
                    await prisma.campaignLead.update({
                        where: { id: campaignLead.id },
                        data: { status: 'PAUSED', nextActionAt: null },
                    });
                    return;
                }

                try {
                    await emailService.queueSend(campaignLead.campaign.organizationId, {
                        leadIds: [campaignLead.leadId],
                        subject: step.subject || '',
                        content: step.content,
                        templateId: step.templateId || undefined,
                        metadata,
                    });
                } catch {
                    await prisma.campaignLead.update({
                        where: { id: campaignLead.id },
                        data: { status: 'PAUSED', nextActionAt: null },
                    });
                    return;
                }
            }

            if (step.type === 'WHATSAPP') {
                const number = campaignLead.lead.whatsapp || campaignLead.lead.phone;
                if (!number) {
                    await prisma.campaignLead.update({
                        where: { id: campaignLead.id },
                        data: { status: 'PAUSED', nextActionAt: null },
                    });
                    return;
                }

                try {
                    await whatsappService.queueSend(campaignLead.campaign.organizationId, {
                        leadIds: [campaignLead.leadId],
                        message: step.content,
                        templateId: step.templateId || undefined,
                        metadata,
                    });
                } catch {
                    await prisma.campaignLead.update({
                        where: { id: campaignLead.id },
                        data: { status: 'PAUSED', nextActionAt: null },
                    });
                    return;
                }
            }

            if (
                campaignLead.lead.status === 'NEW' ||
                campaignLead.lead.status === 'ENRICHED' ||
                campaignLead.lead.status === 'ENRICHING'
            ) {
                await prisma.lead.update({
                    where: { id: campaignLead.leadId },
                    data: { status: 'CONTACTED' },
                });
            }

            const nextStep = steps[stepIndex + 1];
            if (!nextStep) {
                await prisma.campaignLead.update({
                    where: { id: campaignLead.id },
                    data: { status: 'COMPLETED', nextActionAt: null, currentStep: stepIndex + 1 },
                });
                return;
            }

            await scheduleNextStep(campaignLead.id, stepIndex + 1, delayForStep(nextStep));
        },
        { connection }
    );
}
