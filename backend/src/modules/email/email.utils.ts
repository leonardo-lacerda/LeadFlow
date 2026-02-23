import crypto from 'node:crypto';
import Handlebars from 'handlebars';
import { env } from '../../config/env.js';

export function getApiBaseUrl() {
    if (env.API_BASE_URL) {
        return env.API_BASE_URL;
    }
    return `http://${env.HOST}:${env.PORT}`;
}

export function renderTemplate(template: string, data: Record<string, unknown>) {
    const compiled = Handlebars.compile(template, { noEscape: true });
    return compiled(data);
}

function base64UrlEncode(value: string) {
    return Buffer.from(value, 'utf-8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function getTrackingSecret() {
    return env.EMAIL_TRACKING_SIGNING_SECRET || env.JWT_SECRET;
}

export function buildClickSignature(messageId: string, encodedUrl: string) {
    return crypto
        .createHmac('sha256', getTrackingSecret())
        .update(`${messageId}:${encodedUrl}`)
        .digest('hex');
}

function buildMessageActionSignature(action: 'open' | 'unsubscribe', messageId: string) {
    return crypto
        .createHmac('sha256', getTrackingSecret())
        .update(`${action}:${messageId}`)
        .digest('hex');
}

export function buildOpenSignature(messageId: string) {
    return buildMessageActionSignature('open', messageId);
}

export function buildUnsubscribeSignature(messageId: string) {
    return buildMessageActionSignature('unsubscribe', messageId);
}

export function verifyClickSignature(messageId: string, encodedUrl: string, signature?: string) {
    if (!signature) {
        return false;
    }

    const expected = buildClickSignature(messageId, encodedUrl);
    if (expected.length !== signature.length) {
        return false;
    }
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function verifyMessageActionSignature(
    action: 'open' | 'unsubscribe',
    messageId: string,
    signature?: string
) {
    if (!signature) {
        return false;
    }

    const expected = buildMessageActionSignature(action, messageId);
    if (expected.length !== signature.length) {
        return false;
    }
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function injectTrackingPixel(html: string, messageId: string) {
    const sig = buildOpenSignature(messageId);
    const pixelUrl = `${getApiBaseUrl()}/api/email/track/open?messageId=${messageId}&sig=${sig}`;
    const pixel = `<img src="${pixelUrl}" alt="" width="1" height="1" style="display:none;" />`;
    return html.includes('</body>') ? html.replace('</body>', `${pixel}</body>`) : `${html}${pixel}`;
}

export function injectUnsubscribe(html: string, messageId: string) {
    const sig = buildUnsubscribeSignature(messageId);
    const url = `${getApiBaseUrl()}/api/email/unsubscribe?messageId=${messageId}&sig=${sig}`;
    const link =
        `<p style="font-size:12px;color:#888;">` +
        `Se nao quiser receber mais emails, <a href="${url}">clique aqui</a>.</p>`;
    return html.includes('</body>') ? html.replace('</body>', `${link}</body>`) : `${html}${link}`;
}

export function isAllowedTrackingUrl(value: string) {
    let parsed: URL;
    try {
        parsed = new URL(value);
    } catch {
        return false;
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        return false;
    }

    const allowed = env.EMAIL_TRACKING_ALLOWED_DOMAINS
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);

    if (allowed.length === 0) {
        return true;
    }

    const host = parsed.hostname.toLowerCase();
    return allowed.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export function injectLinkTracking(html: string, messageId: string) {
    const base = `${getApiBaseUrl()}/api/email/track/click?messageId=${messageId}&url=`;
    return html.replace(/href=(["'])(.*?)\1/gi, (match, quote, href) => {
        if (
            href.startsWith('mailto:') ||
            href.startsWith('tel:') ||
            href.includes('/api/email/track/click')
        ) {
            return match;
        }
        const encoded = base64UrlEncode(href);
        const sig = buildClickSignature(messageId, encoded);
        return `href=${quote}${base}${encoded}&sig=${sig}${quote}`;
    });
}

export function stripHtml(html: string) {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
