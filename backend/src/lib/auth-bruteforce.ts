import crypto from 'node:crypto';
import { redis } from './redis.js';

const ATTEMPT_WINDOW_SECONDS = 15 * 60;
const MAX_FAILED_ATTEMPTS_PER_EMAIL = 8;
const MAX_FAILED_ATTEMPTS_PER_IP = 30;

function hashIdentifier(value: string) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function emailAttemptsKey(email: string) {
    return `auth:login:email:${hashIdentifier(email.trim().toLowerCase())}`;
}

function ipAttemptsKey(ip: string) {
    return `auth:login:ip:${hashIdentifier(ip.trim())}`;
}

function normalizeIp(ip?: string) {
    if (!ip || typeof ip !== 'string' || ip.trim().length === 0) {
        return 'unknown';
    }
    return ip.trim();
}

async function incrementAttempts(key: string) {
    const attempts = await redis.incr(key);
    if (attempts === 1) {
        await redis.expire(key, ATTEMPT_WINDOW_SECONDS);
    }
    return attempts;
}

async function getAttemptsAndTtl(key: string) {
    const [attemptsRaw, ttlRaw] = await Promise.all([redis.get(key), redis.ttl(key)]);
    return {
        attempts: attemptsRaw ? parseInt(attemptsRaw, 10) : 0,
        ttl: ttlRaw > 0 ? ttlRaw : ATTEMPT_WINDOW_SECONDS,
    };
}

export async function assertLoginAttemptAllowed(params: { email: string; ip?: string }) {
    const normalizedIp = normalizeIp(params.ip);
    const keys = [emailAttemptsKey(params.email), ipAttemptsKey(normalizedIp)];
    const [emailAttempts, ipAttempts] = await Promise.all(keys.map((key) => getAttemptsAndTtl(key)));

    if (emailAttempts.attempts >= MAX_FAILED_ATTEMPTS_PER_EMAIL) {
        const retryMinutes = Math.max(1, Math.ceil(emailAttempts.ttl / 60));
        throw new Error(`Too many login attempts for this account. Try again in ${retryMinutes} minute(s).`);
    }

    if (ipAttempts.attempts >= MAX_FAILED_ATTEMPTS_PER_IP) {
        const retryMinutes = Math.max(1, Math.ceil(ipAttempts.ttl / 60));
        throw new Error(`Too many login attempts from this IP. Try again in ${retryMinutes} minute(s).`);
    }
}

export async function recordLoginFailure(params: { email: string; ip?: string }) {
    const normalizedIp = normalizeIp(params.ip);
    await Promise.all([
        incrementAttempts(emailAttemptsKey(params.email)),
        incrementAttempts(ipAttemptsKey(normalizedIp)),
    ]);
}

export async function clearLoginFailures(params: { email: string; ip?: string }) {
    const normalizedIp = normalizeIp(params.ip);
    await Promise.all([
        redis.del(emailAttemptsKey(params.email)),
        redis.del(ipAttemptsKey(normalizedIp)),
    ]);
}
