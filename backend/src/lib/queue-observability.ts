import { Worker } from 'bullmq';

interface WorkerMetrics {
    workerName: string;
    queueName: string;
    startedAt: string;
    lastActiveAt?: string;
    lastCompletedAt?: string;
    lastFailedAt?: string;
    processed: number;
    completed: number;
    failed: number;
    stalled: number;
}

interface WorkerErrorEntry {
    workerName: string;
    queueName: string;
    jobId?: string;
    attempt?: number;
    message: string;
    timestamp: string;
}

const MAX_ERRORS = 200;

const workerMetricsMap = new Map<string, WorkerMetrics>();
const recentErrors: WorkerErrorEntry[] = [];

function appendError(entry: WorkerErrorEntry) {
    recentErrors.unshift(entry);
    if (recentErrors.length > MAX_ERRORS) {
        recentErrors.length = MAX_ERRORS;
    }
}

function getWorkerKey(workerName: string, queueName: string) {
    return `${queueName}:${workerName}`;
}

export function registerQueueWorker(
    worker: Worker,
    options: {
        workerName: string;
        queueName: string;
    }
) {
    const key = getWorkerKey(options.workerName, options.queueName);
    if (!workerMetricsMap.has(key)) {
        workerMetricsMap.set(key, {
            workerName: options.workerName,
            queueName: options.queueName,
            startedAt: new Date().toISOString(),
            processed: 0,
            completed: 0,
            failed: 0,
            stalled: 0,
        });
    }

    const update = (mutator: (metrics: WorkerMetrics) => void) => {
        const current = workerMetricsMap.get(key);
        if (!current) {
            return;
        }
        mutator(current);
        workerMetricsMap.set(key, current);
    };

    worker.on('active', () => {
        update((metrics) => {
            metrics.processed += 1;
            metrics.lastActiveAt = new Date().toISOString();
        });
    });

    worker.on('completed', () => {
        update((metrics) => {
            metrics.completed += 1;
            metrics.lastCompletedAt = new Date().toISOString();
        });
    });

    worker.on('failed', (job, error) => {
        update((metrics) => {
            metrics.failed += 1;
            metrics.lastFailedAt = new Date().toISOString();
        });
        appendError({
            workerName: options.workerName,
            queueName: options.queueName,
            jobId: job?.id ? String(job.id) : undefined,
            attempt: job ? job.attemptsMade + 1 : undefined,
            message: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
        });
    });

    worker.on('stalled', (jobId) => {
        update((metrics) => {
            metrics.stalled += 1;
            metrics.lastFailedAt = new Date().toISOString();
        });
        appendError({
            workerName: options.workerName,
            queueName: options.queueName,
            jobId: jobId ? String(jobId) : undefined,
            message: 'Job stalled',
            timestamp: new Date().toISOString(),
        });
    });

    worker.on('error', (error) => {
        appendError({
            workerName: options.workerName,
            queueName: options.queueName,
            message: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
        });
    });
}

export function getWorkerMetrics() {
    return Array.from(workerMetricsMap.values()).sort((a, b) =>
        a.queueName.localeCompare(b.queueName)
    );
}

export function getWorkerErrors(limit = 50) {
    return recentErrors.slice(0, Math.max(1, Math.min(limit, MAX_ERRORS)));
}

export function getWorkerAlerts() {
    const alerts: Array<{
        level: 'warning' | 'critical';
        workerName: string;
        queueName: string;
        message: string;
    }> = [];

    for (const metrics of workerMetricsMap.values()) {
        if (metrics.failed >= 20) {
            alerts.push({
                level: 'critical',
                workerName: metrics.workerName,
                queueName: metrics.queueName,
                message: `High failure volume: ${metrics.failed} failed jobs`,
            });
        }

        const failureRate =
            metrics.processed > 0 ? Number((metrics.failed / metrics.processed).toFixed(3)) : 0;

        if (metrics.processed >= 20 && failureRate >= 0.2) {
            alerts.push({
                level: 'warning',
                workerName: metrics.workerName,
                queueName: metrics.queueName,
                message: `Failure rate elevated: ${(failureRate * 100).toFixed(1)}%`,
            });
        }

        if (metrics.stalled > 0) {
            alerts.push({
                level: 'warning',
                workerName: metrics.workerName,
                queueName: metrics.queueName,
                message: `${metrics.stalled} stalled jobs detected`,
            });
        }
    }

    return alerts;
}
