export const LEAD_TEMPERATURE_VALUES = ['HOT', 'WARM', 'COLD'] as const;

export type LeadTemperatureValue = (typeof LEAD_TEMPERATURE_VALUES)[number];
