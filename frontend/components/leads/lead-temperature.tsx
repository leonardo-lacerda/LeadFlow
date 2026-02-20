import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LeadTemperature } from '@/lib/scoring-api';
import { Flame, Snowflake, SunMedium } from 'lucide-react';

interface LeadTemperatureBadgeProps {
    temperature: LeadTemperature;
    className?: string;
}

const temperatureConfig = {
    HOT: {
        label: 'Quente',
        icon: Flame,
        className: 'border-red-200 bg-red-50 text-red-700',
    },
    WARM: {
        label: 'Morno',
        icon: SunMedium,
        className: 'border-amber-200 bg-amber-50 text-amber-700',
    },
    COLD: {
        label: 'Frio',
        icon: Snowflake,
        className: 'border-sky-200 bg-sky-50 text-sky-700',
    },
} as const;

export function LeadTemperatureBadge({ temperature, className }: LeadTemperatureBadgeProps) {
    const config = temperatureConfig[temperature];
    const Icon = config.icon;

    return (
        <Badge
            variant="outline"
            className={cn('inline-flex items-center gap-1.5', config.className, className)}
        >
            <Icon className="h-3 w-3" />
            {config.label}
        </Badge>
    );
}
