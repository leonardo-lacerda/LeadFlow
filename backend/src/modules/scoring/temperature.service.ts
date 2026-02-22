import { LeadTemperatureValue } from './scoring.types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function daysSince(date: Date | null, now: Date): number {
    if (!date) {
        return Number.POSITIVE_INFINITY;
    }
    return (now.getTime() - date.getTime()) / DAY_MS;
}

function isWithinDays(date: Date | null, days: number, now: Date): boolean {
    if (!date) {
        return false;
    }
    return now.getTime() - date.getTime() <= days * DAY_MS;
}

export function determineLeadTemperature(input: {
    score: number;
    now: Date;
    lastInteraction: Date | null;
    lastReplyAt: Date | null;
    lastOpenAt: Date | null;
}): LeadTemperatureValue {
    const repliedRecently = isWithinDays(input.lastReplyAt, 3, input.now);
    const openedRecently = isWithinDays(input.lastOpenAt, 7, input.now);
    const inactiveMoreThan14Days = daysSince(input.lastInteraction, input.now) > 14;

    if (repliedRecently || input.score >= 70) {
        return 'HOT';
    }
    if (inactiveMoreThan14Days || input.score < 40) {
        return 'COLD';
    }
    if (openedRecently || (input.score >= 40 && input.score <= 69)) {
        return 'WARM';
    }
    return 'COLD';
}
