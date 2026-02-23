import crypto from 'node:crypto';
import { env } from '../config/env.js';

const SECRET_PREFIX = 'enc:v1:';
const IV_LENGTH = 12;

function getEncryptionKey() {
    if (env.NODE_ENV === 'production' && !env.SECRETS_ENCRYPTION_KEY) {
        throw new Error('SECRETS_ENCRYPTION_KEY is required in production');
    }
    const baseKey = env.SECRETS_ENCRYPTION_KEY || env.JWT_SECRET;
    return crypto.createHash('sha256').update(baseKey).digest();
}

export function isEncryptedSecret(value: string | null | undefined) {
    return typeof value === 'string' && value.startsWith(SECRET_PREFIX);
}

export function encryptSecret(value: string | null | undefined) {
    if (!value) {
        return value;
    }
    if (isEncryptedSecret(value)) {
        return value;
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const payload = [
        iv.toString('base64url'),
        encrypted.toString('base64url'),
        authTag.toString('base64url'),
    ].join('.');

    return `${SECRET_PREFIX}${payload}`;
}

export function decryptSecret(value: string | null | undefined) {
    if (!value) {
        return value;
    }
    if (!isEncryptedSecret(value)) {
        return value;
    }

    try {
        const encoded = value.slice(SECRET_PREFIX.length);
        const [ivEncoded, encryptedEncoded, authTagEncoded] = encoded.split('.');
        if (!ivEncoded || !encryptedEncoded || !authTagEncoded) {
            throw new Error('Malformed encrypted secret');
        }

        const iv = Buffer.from(ivEncoded, 'base64url');
        const encrypted = Buffer.from(encryptedEncoded, 'base64url');
        const authTag = Buffer.from(authTagEncoded, 'base64url');

        const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        return decrypted.toString('utf8');
    } catch (error) {
        if (env.NODE_ENV === 'production') {
            throw new Error(
                `Failed to decrypt secret: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
        // Legacy fallback in non-production environments.
        return value;
    }
}

export function encryptStringMap(value?: Record<string, string>) {
    if (!value) {
        return undefined;
    }
    return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, encryptSecret(entry) || ''])
    );
}

export function decryptStringMap(value?: Record<string, string>) {
    if (!value) {
        return undefined;
    }
    return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, decryptSecret(entry) || ''])
    );
}
