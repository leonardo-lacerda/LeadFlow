import axios from "axios";

type ErrorPayload = {
    error?: string;
    message?: string;
};

export function getErrorMessage(error: unknown, fallback = "Erro desconhecido"): string {
    if (axios.isAxiosError(error)) {
        const payload = (error.response?.data || {}) as ErrorPayload;
        if (typeof payload.error === "string" && payload.error.trim()) {
            return payload.error;
        }
        if (typeof payload.message === "string" && payload.message.trim()) {
            return payload.message;
        }
        if (typeof error.message === "string" && error.message.trim()) {
            return error.message;
        }
        return fallback;
    }

    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }

    if (typeof error === "string" && error.trim()) {
        return error;
    }

    return fallback;
}
