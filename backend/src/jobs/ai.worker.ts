import { Worker } from 'bullmq';
import { env } from '../config/env.js';
import { fetchWithTimeout } from '../lib/fetch.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

interface AiJobData {
    jobId: string;
    organizationId: string;
    leadIds: string[];
    icp?: Record<string, unknown>;
    promptId?: string;
    providerOrder?: string[];
    temperature?: number;
    maxTokens?: number;
    webhookUrl?: string;
}

let started = false;

export function startAiWorker() {
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
        'ai',
        async (job) => {
            const data = job.data as AiJobData;

            await prisma.aiJob.update({
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
                    phone: true,
                    whatsapp: true,
                    linkedinUrl: true,
                    companyName: true,
                    companyDomain: true,
                    companySize: true,
                    industry: true,
                    jobTitle: true,
                    seniority: true,
                    department: true,
                    city: true,
                    state: true,
                    country: true,
                    tags: true,
                },
            });

            if (leads.length === 0) {
                await prisma.aiJob.update({
                    where: { id: data.jobId },
                    data: {
                        status: 'FAILED',
                        errors: { error: 'No leads found for scoring' },
                    },
                });
                throw new Error('No leads found for scoring');
            }

            const payload = {
                leads: leads.map((lead) => ({
                    leadId: lead.id,
                    ...lead,
                })),
                icp: data.icp,
                prompt_id: data.promptId,
                provider_order: data.providerOrder,
                temperature: data.temperature,
                max_tokens: data.maxTokens,
                job_id: data.jobId,
                org_id: data.organizationId,
                webhook_url: data.webhookUrl || env.AI_WEBHOOK_URL,
                webhook_secret: env.AI_WEBHOOK_SECRET || undefined,
            };

            try {
                const response = await fetchWithTimeout(`${env.AI_SERVICE_URL}/score/bulk`, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    const text = await response.text();
                    throw new Error(`AI service error (${response.status}): ${text}`);
                }

                const result = (await response.json()) as Record<string, unknown>;
                const pythonJobId =
                    (result?.['job_id'] as string) || (result?.['jobId'] as string);
                if (pythonJobId) {
                    await prisma.aiJob.update({
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
                await prisma.aiJob.update({
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
}
