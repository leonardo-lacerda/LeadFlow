import { Worker } from 'bullmq';
import { redis } from '../../lib/redis.js';
import { signalDetectorQueue } from '../../lib/queue.js';
import { signalService } from './signal.service.js';
import { registerQueueWorker } from '../../lib/queue-observability.js';

interface SignalDetectorJobData {
    organizationId?: string;
    minConfidence?: number;
}

let started = false;

export function startSignalDetectorWorker() {
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
        'signal_detector',
        async (job) => {
            const data = (job.data || {}) as SignalDetectorJobData;
            if (data.organizationId) {
                return signalService.runDetectionForOrganization(data.organizationId, {
                    minConfidence: data.minConfidence,
                });
            }
            return signalService.runDetectionForAllOrganizations({
                minConfidence: data.minConfidence,
            });
        },
        { connection }
    );

    registerQueueWorker(worker, {
        workerName: 'signal-detector-worker',
        queueName: 'signal_detector',
    });

    // Periodic refresh so insights stay up-to-date without manual action.
    void signalDetectorQueue
        .add(
            'detect_signals',
            {},
            {
                repeat: { pattern: '0 */3 * * *' },
                jobId: 'signal_detector:every_3h',
                removeOnComplete: 20,
                removeOnFail: 20,
            }
        )
        .catch((error) => {
            console.error('Failed to schedule signal detector worker:', error);
        });
}
