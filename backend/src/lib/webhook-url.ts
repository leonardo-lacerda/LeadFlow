import net from 'node:net';
import { env } from '../config/env.js';

const DISALLOWED_HOSTS = new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    '0.0.0.0',
    'host.docker.internal',
]);

function parseAllowlist() {
    return env.WEBHOOK_URL_ALLOWLIST.split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);
}

function isPrivateIpv4(value: string) {
    const parts = value.split('.').map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
        return false;
    }

    const [a, b] = parts;
    return (
        a === 10 ||
        a === 127 ||
        a === 0 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 100 && b >= 64 && b <= 127)
    );
}

function isPrivateIpv6(value: string) {
    const normalized = value.toLowerCase();
    return (
        normalized === '::1' ||
        normalized === '::' ||
        normalized.startsWith('fc') ||
        normalized.startsWith('fd') ||
        normalized.startsWith('fe8') ||
        normalized.startsWith('fe9') ||
        normalized.startsWith('fea') ||
        normalized.startsWith('feb')
    );
}

function isHostAllowedByAllowlist(hostname: string, allowlist: string[]) {
    return allowlist.some((entry) => hostname === entry || hostname.endsWith(`.${entry}`));
}

function normalizeUrlForCompare(value: string) {
    const parsed = new URL(value);
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.protocol}//${parsed.host}${path}`;
}

export function isTrustedWebhookUrl(value: string) {
    let parsed: URL;
    try {
        parsed = new URL(value);
    } catch {
        return false;
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        return false;
    }

    if (env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
        return false;
    }

    const hostname = parsed.hostname.toLowerCase();
    if (DISALLOWED_HOSTS.has(hostname) || hostname.endsWith('.local')) {
        return false;
    }

    const ipVersion = net.isIP(hostname);
    if (ipVersion === 4 && isPrivateIpv4(hostname)) {
        return false;
    }
    if (ipVersion === 6 && isPrivateIpv6(hostname)) {
        return false;
    }

    const allowlist = parseAllowlist();
    if (allowlist.length === 0) {
        return env.NODE_ENV !== 'production';
    }

    return isHostAllowedByAllowlist(hostname, allowlist);
}

export function assertTrustedWebhookUrl(value: string, fieldName = 'webhookUrl') {
    if (!isTrustedWebhookUrl(value)) {
        throw new Error(
            `${fieldName} is not allowed. Configure WEBHOOK_URL_ALLOWLIST and use trusted HTTPS domains.`
        );
    }
}

export function isSameWebhookTarget(a?: string, b?: string) {
    if (!a || !b) {
        return false;
    }

    try {
        return normalizeUrlForCompare(a) === normalizeUrlForCompare(b);
    } catch {
        return false;
    }
}
