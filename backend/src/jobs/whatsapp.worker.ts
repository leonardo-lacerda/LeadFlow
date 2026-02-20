import { Worker } from 'bullmq';
import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { whatsappService } from '../modules/whatsapp/whatsapp.service.js';

interface WhatsAppJobData {
    messageId: string;
}

let started = false;

export function startWhatsappWorker() {
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
        'whatsapp',
        async (job) => {
            const data = job.data as WhatsAppJobData;
            try {
                await whatsappService.sendMessage(data.messageId);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                await prisma.message.update({
                    where: { id: data.messageId },
                    data: {
                        status: 'FAILED',
                        metadata: { error: message },
                    },
                });
                throw error;
            }
        },
        { connection }
    );
}
