interface PublishInput {
    content: string;
    accessToken?: string;
    authorUrn?: string;
}

interface LinkedInMeResponse {
    id?: string;
}

interface LinkedInUserInfoResponse {
    sub?: string;
}

interface LinkedInPublishResponse {
    id?: string;
}

function normalizeAccessToken(value?: string) {
    const token = value?.trim();
    if (!token) {
        return '';
    }
    return token.replace(/^Bearer\s+/i, '').trim();
}

function normalizeAuthorUrn(value?: string) {
    const raw = value?.trim();
    if (!raw) {
        return '';
    }
    if (raw.startsWith('urn:li:')) {
        return raw;
    }
    return `urn:li:person:${raw}`;
}

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
    try {
        return (await response.json()) as T;
    } catch {
        return null;
    }
}

function buildErrorDetail(payload: unknown): string {
    if (!payload || typeof payload !== 'object') {
        return 'Unknown API error';
    }

    const record = payload as Record<string, unknown>;
    const detail =
        (record['message'] as string | undefined) ||
        (record['error_description'] as string | undefined) ||
        (record['error'] as string | undefined);

    if (detail && detail.trim().length > 0) {
        return detail.trim();
    }

    return 'Unknown API error';
}

export class LinkedinService {
    private async resolveAuthorUrn(accessToken: string, preferredUrn?: string) {
        const normalized = normalizeAuthorUrn(preferredUrn);
        if (normalized) {
            return normalized;
        }

        const meResponse = await fetch('https://api.linkedin.com/v2/me', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'X-Restli-Protocol-Version': '2.0.0',
            },
        });
        const meBody = await parseJsonSafe<LinkedInMeResponse>(meResponse);
        if (meResponse.ok && meBody?.id) {
            return `urn:li:person:${meBody.id}`;
        }

        const userInfoResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        const userInfoBody = await parseJsonSafe<LinkedInUserInfoResponse>(userInfoResponse);
        if (userInfoResponse.ok && userInfoBody?.sub) {
            return `urn:li:person:${userInfoBody.sub}`;
        }

        throw new Error(
            'Unable to resolve LinkedIn author URN. Provide linkedinAuthorUrn in API keys.'
        );
    }

    async publish(input: PublishInput) {
        const content = input.content.trim();
        if (!content) {
            throw new Error('Content is required');
        }

        const accessToken = normalizeAccessToken(input.accessToken);
        if (!accessToken) {
            throw new Error('LinkedIn access token is required');
        }

        const author = await this.resolveAuthorUrn(accessToken, input.authorUrn);
        const payload = {
            author,
            lifecycleState: 'PUBLISHED',
            specificContent: {
                'com.linkedin.ugc.ShareContent': {
                    shareCommentary: {
                        text: content.slice(0, 3000),
                    },
                    shareMediaCategory: 'NONE',
                },
            },
            visibility: {
                'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
            },
        };

        const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'X-Restli-Protocol-Version': '2.0.0',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const responseBody = await parseJsonSafe<LinkedInPublishResponse>(response);
        if (!response.ok) {
            const reason = buildErrorDetail(responseBody);
            throw new Error(`LinkedIn publish failed (${response.status}): ${reason}`);
        }

        const postIdFromHeader = response.headers.get('x-restli-id') || undefined;
        const postId = postIdFromHeader || responseBody?.id || null;

        if (!postId) {
            throw new Error('LinkedIn publish succeeded without post id');
        }

        return {
            platform: 'linkedin',
            postId,
            publishedAt: new Date().toISOString(),
            preview: payload.specificContent['com.linkedin.ugc.ShareContent'].shareCommentary.text,
            mode: 'live',
        };
    }
}

export const linkedinService = new LinkedinService();
