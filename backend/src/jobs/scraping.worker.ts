import { Worker } from 'bullmq';
import { env } from '../config/env.js';
import { fetchWithTimeout } from '../lib/fetch.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

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

    new Worker(
        'scraping',
        async (job) => {
            const data = job.data as ScrapingJobData;
            const endpoint = SOURCE_ENDPOINTS[data.source];

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

            await prisma.scrapingJob.update({
                where: { id: data.jobId },
                data: {
                    status: 'RUNNING',
                    lastRunAt: new Date(),
                },
            });

            const payload = {
                ...data.query,
                job_id: data.jobId,
                webhook_url: data.webhookUrl || env.SCRAPING_WEBHOOK_URL,
                webhook_secret: env.SCRAPING_WEBHOOK_SECRET || undefined,
            };

            try {
                const response = await fetchWithTimeout(`${env.SCRAPING_SERVICE_URL}${endpoint}`, {
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
                const message = error instanceof Error ? error.message : 'Unknown error';
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
}
