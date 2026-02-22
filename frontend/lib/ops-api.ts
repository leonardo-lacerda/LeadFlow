import { api } from "@/lib/api";

export interface QueueCounts {
    waiting?: number;
    active?: number;
    completed?: number;
    failed?: number;
    delayed?: number;
    paused?: number;
}

export interface WorkerMetrics {
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

export interface WorkerError {
    workerName: string;
    queueName: string;
    jobId?: string;
    attempt?: number;
    message: string;
    timestamp: string;
}

export interface OpsAlert {
    level: "warning" | "critical";
    queue: string;
    worker?: string;
    message: string;
}

export interface OpsSummary {
    timestamp: string;
    queues: Record<string, QueueCounts>;
    workers: WorkerMetrics[];
    alerts: OpsAlert[];
    redis: {
        usedMemoryHuman: string;
        usedMemoryPeakHuman: string;
    };
}

export const opsApi = {
    async getSummary(): Promise<OpsSummary> {
        const response = await api.get("/ops/summary");
        return response.data.data;
    },

    async getErrors(limit = 40): Promise<WorkerError[]> {
        const response = await api.get("/ops/errors", { params: { limit } });
        return response.data.data;
    },

    async getAlerts(): Promise<OpsAlert[]> {
        const response = await api.get("/ops/alerts");
        return response.data.data;
    },
};
