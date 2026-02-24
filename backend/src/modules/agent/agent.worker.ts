import { Worker } from 'bullmq';
import { redis } from '../../lib/redis.js';
import { agentQueue } from '../../lib/queue.js';
import { registerQueueWorker } from '../../lib/queue-observability.js';
import { agentService } from './agent.service.js';

interface AgentWorkerJobData {
    organizationId?: string;
    trigger?: string;
}

let started = false;

export function startAgentWorker() {
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
        'agent',
        async (job) => {
            const data = (job.data || {}) as AgentWorkerJobData;
            if (data.organizationId) {
                return agentService.runAutoCycle(data.organizationId, {
                    trigger: data.trigger || 'worker_auto_cycle',
                    enforceAutomationQuota: true,
                });
            }

            return agentService.runAutoCycleForAllOrganizations({
                trigger: data.trigger || 'worker_auto_cycle',
            });
        },
        { connection }
    );

    registerQueueWorker(worker, {
        workerName: 'agent-worker',
        queueName: 'agent',
    });

    // Run agent automatic cycle every 4 hours.
    void agentQueue
        .add(
            'auto_cycle',
            {
                trigger: 'scheduled_auto_cycle',
            },
            {
                repeat: { pattern: '15 */4 * * *' },
                jobId: 'agent:auto_cycle:4h',
                removeOnComplete: 20,
                removeOnFail: 20,
            }
        )
        .catch((error) => {
            console.error('Failed to schedule agent auto-cycle job:', error);
        });
}
