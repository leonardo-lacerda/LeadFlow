import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { redis } from '../../lib/redis.js';

type OAuthProvider = 'twitter' | 'linkedin';

interface OAuthStatePayload {
    provider: OAuthProvider;
    organizationId: string;
    returnTo: string;
    codeVerifier?: string;
    createdAt: string;
}

interface OAuthTokenPayload {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: string;
    scope?: string;
    tokenType?: string;
    raw?: unknown;
}

interface OAuthStartResult {
    state: string;
    authorizationUrl: string;
}

interface OAuthCallbackContext {
    state: string;
    code: string;
}

function toBase64Url(value: Buffer) {
    return value.toString('base64url');
}

function createCodeVerifier() {
    return toBase64Url(crypto.randomBytes(48));
}

function createCodeChallenge(verifier: string) {
    return toBase64Url(crypto.createHash('sha256').update(verifier).digest());
}

function normalizeReturnTo(value?: string) {
    if (!value || typeof value !== 'string' || value.trim().length === 0) {
        return '/growth';
    }

    const trimmed = value.trim();
    if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
        return '/growth';
    }

    return trimmed;
}

function stateKey(state: string) {
    return `${env.OAUTH_STATE_PREFIX}:${state}`;
}

function assertOAuthConfig(provider: OAuthProvider) {
    if (provider === 'twitter') {
        if (!env.TWITTER_CLIENT_ID || !env.TWITTER_CLIENT_SECRET || !env.TWITTER_REDIRECT_URI) {
            throw new Error('Twitter OAuth is not configured');
        }
        return;
    }

    if (!env.LINKEDIN_CLIENT_ID || !env.LINKEDIN_CLIENT_SECRET || !env.LINKEDIN_REDIRECT_URI) {
        throw new Error('LinkedIn OAuth is not configured');
    }
}

function toReadableErrorPayload(payload: unknown) {
    if (!payload || typeof payload !== 'object') {
        return 'Unknown provider error';
    }
    const record = payload as Record<string, unknown>;
    const message =
        (record['error_description'] as string | undefined) ||
        (record['message'] as string | undefined) ||
        (record['error'] as string | undefined) ||
        (record['detail'] as string | undefined);
    return message || 'Unknown provider error';
}

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
    try {
        return (await response.json()) as T;
    } catch {
        return null;
    }
}

interface TwitterTokenResponse {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
}

interface LinkedinTokenResponse {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    refresh_token_expires_in?: number;
    scope?: string;
    token_type?: string;
}

function computeExpiresAt(expiresInSeconds?: number) {
    if (!expiresInSeconds || !Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
        return undefined;
    }

    return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

export class SocialOAuthService {
    async createAuthorizationUrl(input: {
        provider: OAuthProvider;
        organizationId: string;
        returnTo?: string;
    }): Promise<OAuthStartResult> {
        assertOAuthConfig(input.provider);

        const state = toBase64Url(crypto.randomBytes(24));
        const returnTo = normalizeReturnTo(input.returnTo);
        const statePayload: OAuthStatePayload = {
            provider: input.provider,
            organizationId: input.organizationId,
            returnTo,
            createdAt: new Date().toISOString(),
        };

        let authorizationUrl = '';

        if (input.provider === 'twitter') {
            const codeVerifier = createCodeVerifier();
            statePayload.codeVerifier = codeVerifier;
            const codeChallenge = createCodeChallenge(codeVerifier);

            const params = new URLSearchParams({
                response_type: 'code',
                client_id: env.TWITTER_CLIENT_ID,
                redirect_uri: env.TWITTER_REDIRECT_URI,
                scope: env.TWITTER_OAUTH_SCOPES,
                state,
                code_challenge: codeChallenge,
                code_challenge_method: 'S256',
            });

            authorizationUrl = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
        } else {
            const params = new URLSearchParams({
                response_type: 'code',
                client_id: env.LINKEDIN_CLIENT_ID,
                redirect_uri: env.LINKEDIN_REDIRECT_URI,
                state,
                scope: env.LINKEDIN_OAUTH_SCOPES,
            });

            authorizationUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
        }

        await redis.set(
            stateKey(state),
            JSON.stringify(statePayload),
            'EX',
            env.OAUTH_STATE_TTL_SECONDS
        );

        return { state, authorizationUrl };
    }

    async consumeState(provider: OAuthProvider, state: string) {
        const raw = await redis.get(stateKey(state));
        if (!raw) {
            throw new Error('OAuth state is invalid or expired');
        }

        await redis.del(stateKey(state));

        const parsed = JSON.parse(raw) as OAuthStatePayload;
        if (parsed.provider !== provider) {
            throw new Error('OAuth state provider mismatch');
        }

        return parsed;
    }

    async exchangeCode(input: {
        provider: OAuthProvider;
        callback: OAuthCallbackContext;
        codeVerifier?: string;
    }): Promise<OAuthTokenPayload> {
        assertOAuthConfig(input.provider);

        if (input.provider === 'twitter') {
            return this.exchangeTwitterCode(input.callback.code, input.codeVerifier);
        }

        return this.exchangeLinkedinCode(input.callback.code);
    }

    async refreshAccessToken(input: {
        provider: OAuthProvider;
        refreshToken: string;
    }): Promise<OAuthTokenPayload> {
        assertOAuthConfig(input.provider);

        if (input.provider === 'twitter') {
            return this.refreshTwitterToken(input.refreshToken);
        }

        return this.refreshLinkedinToken(input.refreshToken);
    }

    private async exchangeTwitterCode(code: string, codeVerifier?: string): Promise<OAuthTokenPayload> {
        if (!codeVerifier) {
            throw new Error('Twitter OAuth code verifier is missing');
        }

        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: env.TWITTER_REDIRECT_URI,
            client_id: env.TWITTER_CLIENT_ID,
            code_verifier: codeVerifier,
        });

        const credentials = Buffer.from(
            `${env.TWITTER_CLIENT_ID}:${env.TWITTER_CLIENT_SECRET}`
        ).toString('base64');

        const response = await fetch('https://api.twitter.com/2/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${credentials}`,
            },
            body: params,
        });

        const payload = await parseJsonSafe<TwitterTokenResponse>(response);

        if (!response.ok || !payload?.access_token) {
            const detail = toReadableErrorPayload(payload);
            throw new Error(`Twitter OAuth exchange failed (${response.status}): ${detail}`);
        }

        return {
            accessToken: payload.access_token,
            refreshToken: payload.refresh_token,
            expiresAt: computeExpiresAt(payload.expires_in),
            scope: payload.scope,
            tokenType: payload.token_type,
            raw: payload,
        };
    }

    private async refreshTwitterToken(refreshToken: string): Promise<OAuthTokenPayload> {
        const params = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: env.TWITTER_CLIENT_ID,
        });

        const credentials = Buffer.from(
            `${env.TWITTER_CLIENT_ID}:${env.TWITTER_CLIENT_SECRET}`
        ).toString('base64');

        const response = await fetch('https://api.twitter.com/2/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${credentials}`,
            },
            body: params,
        });

        const payload = await parseJsonSafe<TwitterTokenResponse>(response);
        if (!response.ok || !payload?.access_token) {
            const detail = toReadableErrorPayload(payload);
            throw new Error(`Twitter token refresh failed (${response.status}): ${detail}`);
        }

        return {
            accessToken: payload.access_token,
            refreshToken: payload.refresh_token || refreshToken,
            expiresAt: computeExpiresAt(payload.expires_in),
            scope: payload.scope,
            tokenType: payload.token_type,
            raw: payload,
        };
    }

    private async exchangeLinkedinCode(code: string): Promise<OAuthTokenPayload> {
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: env.LINKEDIN_REDIRECT_URI,
            client_id: env.LINKEDIN_CLIENT_ID,
            client_secret: env.LINKEDIN_CLIENT_SECRET,
        });

        const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
        });

        const payload = await parseJsonSafe<LinkedinTokenResponse>(response);

        if (!response.ok || !payload?.access_token) {
            const detail = toReadableErrorPayload(payload);
            throw new Error(`LinkedIn OAuth exchange failed (${response.status}): ${detail}`);
        }

        return {
            accessToken: payload.access_token,
            refreshToken: payload.refresh_token,
            expiresAt: computeExpiresAt(payload.expires_in),
            scope: payload.scope,
            tokenType: payload.token_type,
            raw: payload,
        };
    }

    private async refreshLinkedinToken(refreshToken: string): Promise<OAuthTokenPayload> {
        const params = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: env.LINKEDIN_CLIENT_ID,
            client_secret: env.LINKEDIN_CLIENT_SECRET,
        });

        const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
        });

        const payload = await parseJsonSafe<LinkedinTokenResponse>(response);
        if (!response.ok || !payload?.access_token) {
            const detail = toReadableErrorPayload(payload);
            throw new Error(`LinkedIn token refresh failed (${response.status}): ${detail}`);
        }

        return {
            accessToken: payload.access_token,
            refreshToken: payload.refresh_token || refreshToken,
            expiresAt: computeExpiresAt(payload.expires_in),
            scope: payload.scope,
            tokenType: payload.token_type,
            raw: payload,
        };
    }
}

export const socialOAuthService = new SocialOAuthService();
