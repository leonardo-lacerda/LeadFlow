export interface ScoreDimensions {
    enrichment: number;
    interaction: number;
    timing: number;
    icp: number;
}

function clampInt(value: number, min: number, max: number): number {
    if (Number.isNaN(value)) {
        return min;
    }
    return Math.max(min, Math.min(max, Math.round(value)));
}

export function composeLeadScore(dimensions: ScoreDimensions): number {
    return clampInt(
        dimensions.enrichment + dimensions.interaction + dimensions.timing + dimensions.icp,
        0,
        100
    );
}
