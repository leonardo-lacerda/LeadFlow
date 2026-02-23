import { Worker } from 'bullmq';
import { env } from '../config/env.js';
import { fetchWithTimeout } from '../lib/fetch.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { leadPoolService } from '../modules/lead-pool/lead-pool.service.js';
import { registerQueueWorker } from '../lib/queue-observability.js';
import { isSameWebhookTarget, isTrustedWebhookUrl } from '../lib/webhook-url.js';
import { billingService } from '../modules/billing/billing.service.js';

interface ScrapingJobData {
    jobId: string;
    organizationId: string;
    source: string;
    query: Record<string, unknown>;
    webhookUrl?: string;
}

const SOURCE_ENDPOINTS: Record<string, string> = {
    google_maps: '/scrape/google-maps',
    cnpj: '/scrape/cnpj',
    reclame_aqui: '/scrape/reclame-aqui',
    indeed: '/scrape/indeed',
    catho: '/scrape/catho',
    mercado_livre: '/scrape/mercado-livre',
    wappalyzer: '/scrape/wappalyzer',
    linkedin_dork: '/scrape/linkedin-dork',
    comprasnet: '/scrape/comprasnet',
};


let started = false;

export function startScrapingWorker() {
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
        'scraping',
        async (job) => {
            const data = job.data as ScrapingJobData;
            const endpoint = SOURCE_ENDPOINTS[data.source];
            const isScheduledRun = Boolean(job.repeatJobKey || job.opts?.repeat);

            if (!endpoint) {
                await prisma.scrapingJob.update({
                    where: { id: data.jobId },
                    data: {
                        status: 'FAILED',
                        errors: { error: `Unsupported source: ${data.source}` },
                    },
                });
                throw new Error(`Unsupported source: ${data.source}`);
            }

            if (isScheduledRun) {
                try {
                    await billingService.consumeAutomationRuns(
                        data.organizationId,
                        1,
                        `automation:scraping:${String(job.id)}`
                    );
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Automation limit exceeded';
                    await prisma.scrapingJob.update({
                        where: { id: data.jobId },
                        data: {
                            status: 'FAILED',
                            errors: { error: message },
                        },
                    });
                    throw error;
                }
            }

            await prisma.scrapingJob.update({
                where: { id: data.jobId },
                data: {
                    status: 'RUNNING',
                    lastRunAt: new Date(),
                },
            });

            let preFetchReport: { matched: number; claimed: number; cacheHint: boolean } | null = null;
            try {
                preFetchReport = await leadPoolService.preFetch({
                    organizationId: data.organizationId,
                    source: data.source,
                    query: data.query,
                    scrapingJobId: data.jobId,
                });

                if (preFetchReport.cacheHint) {
                    await prisma.scrapingJob.update({
                        where: { id: data.jobId },
                        data: {
                            query: {
                                ...data.query,
                                leadPool: {
                                    matched: preFetchReport.matched,
                                    claimed: preFetchReport.claimed,
                                    preFetchedAt: new Date().toISOString(),
                                },
                            },
                        },
                    });
                }
            } catch (error) {
                console.error('Lead pool pre-fetch failed:', error);
            }

            const customWebhookUrl =
                data.webhookUrl && isTrustedWebhookUrl(data.webhookUrl) ? data.webhookUrl : undefined;
            const webhookUrl = customWebhookUrl || env.SCRAPING_WEBHOOK_URL;
            const shouldAttachInternalSecret = isSameWebhookTarget(
                webhookUrl,
                env.SCRAPING_WEBHOOK_URL
            );

            const payload = {
                ...data.query,
                job_id: data.jobId,
                webhook_url: webhookUrl,
                webhook_secret: shouldAttachInternalSecret
                    ? env.SCRAPING_WEBHOOK_SECRET || undefined
                    : undefined,
            };

            try {
                const targetUrl = `${env.SCRAPING_SERVICE_URL}${endpoint}`;
                const response = await fetchWithTimeout(targetUrl, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    const text = await response.text();
                    throw new Error(`Scraping service error (${response.status}): ${text}`);
                }

                const result = (await response.json()) as Record<string, unknown>;
                if (preFetchReport) {
                    result['leadPool'] = preFetchReport;
                }

                const pythonJobId = result?.['job_id'] || result?.['jobId'];
                if (pythonJobId) {
                    await prisma.scrapingJob.update({
                        where: { id: data.jobId },
                        data: {
                            query: {
                                ...(data.query || {}),
                                pythonJobId,
                            },
                        },
                    });
                }

                return result;
            } catch (error) {
                const isNetworkFetchFailure =
                    error instanceof TypeError &&
                    (error.message === 'fetch failed' ||
                        error.message.includes('fetch failed') ||
                        error.message.includes('ECONNREFUSED') ||
                        error.message.includes('ENOTFOUND'));
                const message = isNetworkFetchFailure
                    ? `Failed to reach scraping service at ${env.SCRAPING_SERVICE_URL}${endpoint}. Check if the 'scraping' service is running and healthy.`
                    : error instanceof Error
                        ? error.message
                        : 'Unknown error';
                await prisma.scrapingJob.update({
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
        workerName: 'scraping-worker',
        queueName: 'scraping',
    });
}
