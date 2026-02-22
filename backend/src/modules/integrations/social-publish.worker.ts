import { Worker } from 'bullmq';
import { redis } from '../../lib/redis.js';
import { registerQueueWorker } from '../../lib/queue-observability.js';
import { socialPublishService } from './social-publish.service.js';

interface SocialPublishJobData {
    publishJobId: string;
}

let started = false;

export function startSocialPublishWorker() {
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
        'social_publish',
        async (job) => {
            const data = job.data as SocialPublishJobData;
            if (!data?.publishJobId) {
                throw new Error('Missing publish job id');
            }

            return socialPublishService.processQueuedJob(data.publishJobId, job.attemptsMade);
        },
        { connection }
    );

    registerQueueWorker(worker, {
        workerName: 'social-publish-worker',
        queueName: 'social_publish',
    });
}
