interface PublishInput {
    content: string;
    accessToken?: string;
}

interface TwitterCreateTweetResponse {
    data?: {
        id?: string;
        text?: string;
    };
    title?: string;
    detail?: string;
    type?: string;
}

function normalizeAccessToken(value?: string) {
    const token = value?.trim();
    if (!token) {
        return '';
    }
    return token.replace(/^Bearer\s+/i, '').trim();
}

function toReadableError(payload: unknown): string {
    if (!payload || typeof payload !== 'object') {
        return 'Unknown API error';
    }

    const record = payload as Record<string, unknown>;
    const detail =
        (record['detail'] as string | undefined) ||
        (record['message'] as string | undefined) ||
        (record['title'] as string | undefined);

    if (detail && detail.trim().length > 0) {
        return detail.trim();
    }

    return 'Unknown API error';
}

export class TwitterService {
    async publish(input: PublishInput) {
        const content = input.content.trim();
        if (!content) {
            throw new Error('Content is required');
        }

        const accessToken = normalizeAccessToken(input.accessToken);
        if (!accessToken) {
            throw new Error('Twitter access token is required');
        }

        const payload = {
            text: content.slice(0, 280),
        };

        const response = await fetch('https://api.twitter.com/2/tweets', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        let parsed: TwitterCreateTweetResponse | null = null;
        try {
            parsed = (await response.json()) as TwitterCreateTweetResponse;
        } catch {
            parsed = null;
        }

        if (!response.ok) {
            const reason = toReadableError(parsed);
            throw new Error(`Twitter publish failed (${response.status}): ${reason}`);
        }

        const postId = parsed?.data?.id;
        if (!postId) {
            throw new Error('Twitter publish succeeded without post id');
        }

        return {
            platform: 'twitter',
            postId,
            publishedAt: new Date().toISOString(),
            preview: payload.text,
            mode: 'live',
        };
    }
}

export const twitterService = new TwitterService();
