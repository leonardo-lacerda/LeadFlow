import { Worker } from 'bullmq';
import { env } from '../config/env.js';
import { fetchWithTimeout } from '../lib/fetch.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { registerQueueWorker } from '../lib/queue-observability.js';
import { isSameWebhookTarget, isTrustedWebhookUrl } from '../lib/webhook-url.js';

interface EnrichmentJobData {
    jobId: string;
    organizationId: string;
    leadIds: string[];
    webhookUrl?: string;
}

let started = false;

export function startEnrichmentWorker() {
    if (started) {
        return;
    }
    started = true;

    const connection = {
        host: redis.options.host,
        port: redis.options.port,
        password: redis.options.password,
    };

    const worker = new Worker(
        'enrichment',
        async (job) => {
            const data = job.data as EnrichmentJobData;

            await prisma.enrichmentJob.update({
                where: { id: data.jobId },
                data: {
                    status: 'RUNNING',
                    lastRunAt: new Date(),
                },
            });

            const leads = await prisma.lead.findMany({
                where: { id: { in: data.leadIds }, organizationId: data.organizationId },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    fullName: true,
                    email: true,
                    emailVerified: true,
                    phone: true,
                    whatsapp: true,
                    linkedinUrl: true,
                    companyName: true,
                    companyDomain: true,
                    companyCnpj: true,
                    companySize: true,
                    companyRevenue: true,
                    companyEmployees: true,
                    industry: true,
                    technologies: true,
                    maturityLevel: true,
                    icpReasons: true,
                    jobTitle: true,
                    seniority: true,
                    department: true,
                    city: true,
                    state: true,
                    country: true,
                    source: true,
                    sourceUrl: true,
                    tags: true,
                },
            });

            if (leads.length === 0) {
                await prisma.enrichmentJob.update({
                    where: { id: data.jobId },
                    data: {
                        status: 'FAILED',
                        errors: { error: 'No leads found for enrichment' },
                    },
                });
                throw new Error('No leads found for enrichment');
            }

            const customWebhookUrl =
                data.webhookUrl && isTrustedWebhookUrl(data.webhookUrl) ? data.webhookUrl : undefined;
            const webhookUrl = customWebhookUrl || env.ENRICHMENT_WEBHOOK_URL;
            const shouldAttachInternalSecret = isSameWebhookTarget(
                webhookUrl,
                env.ENRICHMENT_WEBHOOK_URL
            );

            const payload = {
                leads: leads.map((lead) => ({
                    leadId: lead.id,
                    ...lead,
                })),
                job_id: data.jobId,
                webhook_url: webhookUrl,
                webhook_secret: shouldAttachInternalSecret
                    ? env.ENRICHMENT_WEBHOOK_SECRET || undefined
                    : undefined,
            };

            try {
                const response = await fetchWithTimeout(`${env.ENRICHMENT_SERVICE_URL}/enrich/bulk`, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    const text = await response.text();
                    throw new Error(`Enrichment service error (${response.status}): ${text}`);
                }

                const result = (await response.json()) as Record<string, unknown>;
                const pythonJobId =
                    (result?.['job_id'] as string) || (result?.['jobId'] as string);
                if (pythonJobId) {
                    await prisma.enrichmentJob.update({
                        where: { id: data.jobId },
                        data: {
                            query: {
                                leadIds: data.leadIds,
                                pythonJobId,
                            },
                        },
                    });
                }

                return result;
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                await prisma.enrichmentJob.update({
                    where: { id: data.jobId },
                    data: {
                        status: 'FAILED',
                        errors: { error: message },
                    },
                });
                throw error;
            }
        },
        { connection }
    );

    registerQueueWorker(worker, {
        workerName: 'enrichment-worker',
        queueName: 'enrichment',
    });
}
