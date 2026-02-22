import { Worker } from 'bullmq';
import { analyticsQueue } from '../../lib/queue.js';
import { redis } from '../../lib/redis.js';
import { analyticsService } from './analytics.service.js';
import { registerQueueWorker } from '../../lib/queue-observability.js';

interface AnalyticsRecalculateJobData {
    organizationId?: string;
    campaignId?: string;
}

let started = false;

export function startAnalyticsWorker() {
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
        'analytics',
        async (job) => {
            const data = (job.data || {}) as AnalyticsRecalculateJobData;
            return analyticsService.recomputeCampaignMetrics(data.organizationId, data.campaignId);
        },
        { connection }
    );

    registerQueueWorker(worker, {
        workerName: 'analytics-worker',
        queueName: 'analytics',
    });

    // Batch metrics update every 2 hours for campaign dashboards.
    void analyticsQueue
        .add(
            'recalculate_metrics',
            {},
            {
                repeat: { pattern: '0 */2 * * *' },
                jobId: 'analytics:recalculate:2h',
                removeOnComplete: 20,
                removeOnFail: 20,
            }
        )
        .catch((error) => {
            console.error('Failed to schedule analytics recalculate job:', error);
        });
}
