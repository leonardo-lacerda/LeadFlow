import { Plan } from '@prisma/client';

export interface LimitExceededDetails {
    dimension: 'volume' | 'scale' | 'automation' | 'sophistication';
    metric: string;
    currentPlan: Plan;
    used: number;
    requested: number;
    limit: number;
    remaining: number;
    recommendedPlan: Plan;
}

export class LimitExceededError extends Error {
    readonly statusCode = 409;
    readonly code = 'LIMIT_EXCEEDED';
    readonly details: LimitExceededDetails;

    constructor(details: LimitExceededDetails, message?: string) {
        super(message || `${details.metric} limit exceeded`);
        this.name = 'LimitExceededError';
        this.details = details;
    }
}

export function isLimitExceededError(value: unknown): value is LimitExceededError {
    return value instanceof LimitExceededError;
}

