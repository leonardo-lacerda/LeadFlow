import crypto from 'node:crypto';
import { redis } from './redis.js';

const REVOKED_TOKEN_PREFIX = 'auth:revoked:jti:';
const MIN_REVOKE_TTL_SECONDS = 60;

function revokedTokenKey(jti: string) {
    return `${REVOKED_TOKEN_PREFIX}${jti}`;
}

export function generateTokenJti() {
    return crypto.randomUUID();
}

export async function revokeTokenJti(jti: string, expUnixSeconds?: number) {
    if (!jti) {
        return;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const ttl = expUnixSeconds ? Math.max(expUnixSeconds - nowSeconds, MIN_REVOKE_TTL_SECONDS) : 86400;
    await redis.set(revokedTokenKey(jti), '1', 'EX', ttl);
}

export async function isTokenJtiRevoked(jti?: string) {
    if (!jti) {
        return false;
    }
    const value = await redis.get(revokedTokenKey(jti));
    return value === '1';
}
