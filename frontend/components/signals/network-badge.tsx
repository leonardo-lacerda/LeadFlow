"use client";

import { Badge } from '@/components/ui/badge';

interface NetworkBadgeProps {
    organizations: number;
}

export function NetworkBadge({ organizations }: NetworkBadgeProps) {
    if (organizations <= 0) {
        return <Badge variant="outline">Sem dados de rede</Badge>;
    }

    return (
        <Badge variant="secondary">
            Baseado em dados anonimizados de {organizations} SaaS
        </Badge>
    );
}
