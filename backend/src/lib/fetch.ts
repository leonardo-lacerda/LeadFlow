import { env } from '../config/env.js';

export async function fetchWithTimeout(
    input: string,
    init: RequestInit = {},
    timeoutMs = env.INTERNAL_REQUEST_TIMEOUT_MS
) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(input, {
            ...init,
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timeout);
    }
}
