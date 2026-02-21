'use client';

import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { IconBolt, IconRefresh, IconArrowRight } from '@tabler/icons-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LeadTemperatureBadge } from '@/components/leads/lead-temperature';
import { LeaderboardLead, scoringApi } from '@/lib/scoring-api';
import { signalsApi } from '@/lib/signals-api';

const WEEKDAY_LABEL: Record<string, string> = {
    monday: 'Seg',
    tuesday: 'Ter',
    wednesday: 'Qua',
    thursday: 'Qui',
    friday: 'Sex',
    saturday: 'Sab',
    sunday: 'Dom',
};

function getActionForLead(lead: LeaderboardLead): {
    label: string;
    href: string;
    external: boolean;
} {
    if (lead.recommendedAction === 'WHATSAPP' && lead.whatsapp) {
        const sanitized = lead.whatsapp.replace(/\D/g, '');
        if (sanitized) {
            return {
                label: 'WA',
                href: `https://wa.me/${sanitized}`,
                external: true,
            };
        }
    }

    if (lead.recommendedAction === 'CALL' && lead.phone) {
        return {
            label: 'Ligar',
            href: `tel:${lead.phone}`,
            external: true,
        };
    }

    if (lead.recommendedAction === 'EMAIL' && lead.email) {
        return {
            label: 'Email',
            href: `mailto:${lead.email}`,
            external: true,
        };
    }

    return {
        label: 'Abrir',
        href: '/inbox',
        external: false,
    };
}

export function HotLeadsWidget() {
    const {
        data: leads,
        isLoading,
        refetch,
        isFetching,
    } = useQuery({
        queryKey: ['scoring', 'leaderboard', 'hot-widget'],
        queryFn: () => scoringApi.getLeaderboard({ limit: 8 }),
    });

    const recalculateMutation = useMutation({
        mutationFn: () => scoringApi.recalculate({ limit: 300 }),
        onSuccess: async () => {
            await refetch();
        },
    });

    const leadIds = leads?.map((lead) => lead.id) || [];
    const { data: leadRecommendations } = useQuery({
        queryKey: ['signals', 'hot-leads-recommendations', leadIds],
        queryFn: () => signalsApi.getLeadRecommendations(leadIds),
        enabled: leadIds.length > 0,
    });

    const recommendationMap = new Map(
        (leadRecommendations || []).map((item) => [item.leadId, item])
    );

    const { data: alerts } = useQuery({
        queryKey: ['signals', 'dashboard-alerts'],
        queryFn: () => signalsApi.getActionableAlerts(3),
        refetchInterval: 30000,
    });

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                        <IconBolt className="h-4 w-4 text-amber-500" />
                        Leads + Sinais em Alta
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                        Priorizacao por score compartilhado, interacao e momento
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => recalculateMutation.mutate()}
                        disabled={recalculateMutation.isPending}
                    >
                        <IconRefresh className="mr-2 h-4 w-4" />
                        Recalcular
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                        <Link href="/leads">
                            Ver leads
                            <IconArrowRight className="ml-1 h-4 w-4" />
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading || isFetching ? (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div key={index} className="h-32 animate-pulse rounded-lg border bg-muted/30" />
                        ))}
                    </div>
                ) : !leads || leads.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                        Nenhum lead priorizado ainda. Clique em Recalcular para atualizar os scores.
                    </div>
                ) : (
                    <>
                        {alerts && alerts.length > 0 && (
                            <div className="mb-4 rounded-lg border p-3">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Alertas acionaveis
                                </p>
                                <div className="grid gap-2 md:grid-cols-3">
                                    {alerts.map((alert) => (
                                        <div key={alert.id} className="rounded border p-2">
                                            <p className="text-sm font-medium">{alert.title}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {alert.recommendedAction}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            {leads.map((lead) => {
                                const action = getActionForLead(lead);
                                const recommendation = recommendationMap.get(lead.id);
                                return (
                                    <div key={lead.id} className="rounded-lg border p-4">
                                        <div className="mb-3 flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold">{lead.name}</p>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {lead.companyName || 'Sem empresa'}
                                                </p>
                                            </div>
                                            <LeadTemperatureBadge temperature={lead.temperature} />
                                        </div>
                                        <div className="text-3xl font-bold leading-none">{lead.score}</div>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {lead.lastInteraction
                                                ? `Interacao ${formatDistanceToNow(new Date(lead.lastInteraction), {
                                                      addSuffix: true,
                                                      locale: ptBR,
                                                  })}`
                                                : 'Sem interacao registrada'}
                                        </p>
                                        {recommendation && (
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {recommendation.recommendedChannel === 'whatsapp'
                                                    ? 'Canal: WhatsApp'
                                                    : 'Canal: Email'}{' '}
                                                |{' '}
                                                {WEEKDAY_LABEL[recommendation.bestWindow.dayOfWeek] ||
                                                    recommendation.bestWindow.dayOfWeek}{' '}
                                                {String(recommendation.bestWindow.hour).padStart(2, '0')}h
                                            </p>
                                        )}
                                        <div className="mt-4">
                                            <Button variant="outline" size="sm" className="w-full" asChild>
                                                <Link
                                                    href={action.href}
                                                    target={action.external ? '_blank' : undefined}
                                                    rel={action.external ? 'noreferrer' : undefined}
                                                >
                                                    {action.label}
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}


