import { Worker } from 'bullmq';
import { redis } from '../../lib/redis.js';
import { scoringService, ScoringRecalculateJobData } from './scoring.service.js';
import { registerQueueWorker } from '../../lib/queue-observability.js';

let started = false;

export function startScoringWorker() {
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
        'scoring',
        async (job) => {
            const data = job.data as ScoringRecalculateJobData;
            return scoringService.processRecalculateJob(data);
        },
        { connection }
    );

    registerQueueWorker(worker, {
        workerName: 'scoring-worker',
        queueName: 'scoring',
    });
}
