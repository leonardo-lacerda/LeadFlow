import { Worker } from 'bullmq';
import { inboxFollowupQueue } from '../../lib/queue.js';
import { redis } from '../../lib/redis.js';
import { inboxIntelligenceService } from './inbox-intelligence.service.js';

let started = false;

export function startFollowUpWorker() {
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
        'inbox_followup',
        async (job) => {
            if (job.name !== 'scan_followups') {
                return null;
            }
            return inboxIntelligenceService.processFollowUpScan();
        },
        { connection }
    );

    // Hourly scan for leads without reply based on temperature rules.
    void inboxFollowupQueue
        .add(
            'scan_followups',
            {},
            {
                repeat: { pattern: '0 * * * *' },
                jobId: 'inbox_followup:hourly_scan',
                removeOnComplete: 20,
                removeOnFail: 20,
            }
        )
        .catch((error) => {
            console.error('Failed to schedule inbox follow-up scan:', error);
        });
}
