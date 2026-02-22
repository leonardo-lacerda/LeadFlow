import { Prisma, SignalType } from '@prisma/client';
import crypto from 'node:crypto';

export interface DetectorContext {
    organizationId: string;
    now: Date;
}

export interface DetectedSignal {
    type: SignalType;
    signature: string;
    confidence: number;
    insight: string;
    dataPoints: number;
    suggestedFormats: string[];
    rawData: Prisma.InputJsonValue;
}

export function clampInt(value: number, min: number, max: number): number {
    if (Number.isNaN(value)) {
        return min;
    }
    return Math.max(min, Math.min(max, Math.round(value)));
}

export function safeRate(numerator: number, denominator: number): number {
    if (denominator <= 0) {
        return 0;
    }
    return numerator / denominator;
}

export function percent(value: number, decimals = 1): number {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Number((value * 100).toFixed(decimals));
}

export function makeSignalSignature(type: SignalType, seed: string): string {
    const normalizedSeed = seed
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
    return crypto.createHash('sha1').update(`${type}:${normalizedSeed}`).digest('hex');
}

export function normalizeText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}
