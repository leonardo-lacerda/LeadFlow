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

export function normalizePhone(value?: string | null) {
    if (!value) {
        return '';
    }
    return value.replace(/\D/g, '');
}
