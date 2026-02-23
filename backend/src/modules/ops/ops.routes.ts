import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { allQueues } from '../../lib/queue.js';
import { redis } from '../../lib/redis.js';
import { getWorkerAlerts, getWorkerErrors, getWorkerMetrics } from '../../lib/queue-observability.js';
import { assertAdminOrOwner } from '../../lib/rbac.js';

async function getQueueSnapshot() {
    const entries = await Promise.all(
        Object.entries(allQueues).map(async ([name, queue]) => {
            const counts = await queue.getJobCounts(
                'waiting',
                'active',
                'completed',
                'failed',
                'delayed',
                'paused'
            );
            return [name, counts] as const;
        })
    );

    return Object.fromEntries(entries);
}

function parseRedisInfo(info: string) {
    const memory = {
        usedMemoryHuman: '',
        usedMemoryPeakHuman: '',
    };

    const lines = info.split('\n').map((line) => line.trim());
    for (const line of lines) {
        if (line.startsWith('used_memory_human:')) {
            memory.usedMemoryHuman = line.split(':')[1] || '';
        }
        if (line.startsWith('used_memory_peak_human:')) {
            memory.usedMemoryPeakHuman = line.split(':')[1] || '';
        }
    }

    return memory;
}

function buildQueueAlerts(queueSnapshot: Record<string, Record<string, number>>) {
    const alerts: Array<{ level: 'warning' | 'critical'; queue: string; message: string }> = [];

    for (const [queueName, counts] of Object.entries(queueSnapshot)) {
        const failed = counts.failed || 0;
        const active = counts.active || 0;
        const waiting = counts.waiting || 0;
        const backlog = waiting + active;

        if (failed >= 50) {
            alerts.push({
                level: 'critical',
                queue: queueName,
                message: `High failed jobs volume (${failed})`,
            });
        }

        if (backlog >= 200) {
            alerts.push({
                level: 'warning',
                queue: queueName,
                message: `Queue backlog is high (${backlog} jobs)`,
            });
        }
    }

    return alerts;
}

export async function opsRoutes(fastify: FastifyInstance) {
    async function requireOpsAccess(request: FastifyRequest) {
        const decoded = await request.jwtVerify<{ userId: string; organizationId: string }>();
        await assertAdminOrOwner(decoded.userId, decoded.organizationId);
    }

    function getErrorStatus(error: unknown) {
        if (
            error instanceof Error &&
            (error.message === 'Forbidden' || error.message.includes('Only ADMIN'))
        ) {
            return 403;
        }
        return 400;
    }

    fastify.get(
        '/summary',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                await requireOpsAccess(request);
                const [queueSnapshot, redisInfoRaw] = await Promise.all([
                    getQueueSnapshot(),
                    redis.info('memory'),
                ]);

                const workerMetrics = getWorkerMetrics();
                const alerts = [
                    ...buildQueueAlerts(queueSnapshot),
                    ...getWorkerAlerts().map((alert) => ({
                        level: alert.level,
                        queue: alert.queueName,
                        worker: alert.workerName,
                        message: alert.message,
                    })),
                ];

                return reply.send({
                    success: true,
                    data: {
                        timestamp: new Date().toISOString(),
                        queues: queueSnapshot,
                        workers: workerMetrics,
                        alerts,
                        redis: parseRedisInfo(redisInfoRaw),
                    },
                });
            } catch (error) {
                return reply.code(getErrorStatus(error)).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to load ops summary',
                });
            }
        }
    );

    fastify.get(
        '/workers',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                await requireOpsAccess(request);
                return reply.send({
                    success: true,
                    data: getWorkerMetrics(),
                });
            } catch (error) {
                return reply.code(getErrorStatus(error)).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to load workers',
                });
            }
        }
    );

    fastify.get(
        '/errors',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                await requireOpsAccess(request);
                const query = request.query as { limit?: string | number };
                const limitRaw =
                    typeof query?.limit === 'string'
                        ? parseInt(query.limit, 10)
                        : Number(query?.limit || 50);
                const limit = Number.isFinite(limitRaw) ? limitRaw : 50;

                return reply.send({
                    success: true,
                    data: getWorkerErrors(limit),
                });
            } catch (error) {
                return reply.code(getErrorStatus(error)).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to load errors',
                });
            }
        }
    );

    fastify.get(
        '/alerts',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                await requireOpsAccess(request);
                const queueSnapshot = await getQueueSnapshot();
                const alerts = [
                    ...buildQueueAlerts(queueSnapshot),
                    ...getWorkerAlerts().map((alert) => ({
                        level: alert.level,
                        queue: alert.queueName,
                        worker: alert.workerName,
                        message: alert.message,
                    })),
                ];

                return reply.send({
                    success: true,
                    data: alerts,
                });
            } catch (error) {
                return reply.code(getErrorStatus(error)).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to load alerts',
                });
            }
        }
    );
}
