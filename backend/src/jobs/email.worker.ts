import { Worker } from 'bullmq';
import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { emailService } from '../modules/email/email.service.js';
import { signalLayerService } from '../modules/signals/signal-layer.service.js';

interface EmailJobData {
    messageId: string;
}

let started = false;

export function startEmailWorker() {
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
        'email',
        async (job) => {
            const data = job.data as EmailJobData;
            try {
                await emailService.sendMessage(data.messageId);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                await prisma.message.update({
                    where: { id: data.messageId },
                    data: {
                        status: 'FAILED',
                        metadata: { error: message },
                    },
                });
                await signalLayerService.trackMessageFailure(data.messageId, message);
                throw error;
            }
        },
        { connection }
    );
}
