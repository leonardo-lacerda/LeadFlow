"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/error-utils";
import { leadPoolApi, SharedLeadItem } from "@/lib/lead-pool-api";
import {
    LeadPoolFilters,
    LeadPoolFiltersValue,
} from "@/components/lead-pool/lead-pool-filters";
import { LeadPoolStats } from "@/components/lead-pool/lead-pool-stats";
import { LeadPoolTable } from "@/components/lead-pool/lead-pool-table";

const PAGE_SIZE = 20;

const EMPTY_FILTERS: LeadPoolFiltersValue = {
    city: "",
    state: "",
    category: "",
    source: "",
    freshnessDays: "",
};

export default function LeadPoolPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [page, setPage] = useState(1);
    const [appliedFilters, setAppliedFilters] = useState<LeadPoolFiltersValue>(EMPTY_FILTERS);

    const searchParams = useMemo(() => {
        const freshnessDays = Number(appliedFilters.freshnessDays);
        return {
            page,
            limit: PAGE_SIZE,
            city: appliedFilters.city || undefined,
            state: appliedFilters.state || undefined,
            category: appliedFilters.category || undefined,
            source: appliedFilters.source || undefined,
            freshnessDays:
                Number.isFinite(freshnessDays) && freshnessDays > 0 ? freshnessDays : undefined,
        };
    }, [appliedFilters, page]);

    const statsQuery = useQuery({
        queryKey: ["lead-pool", "stats"],
        queryFn: () => leadPoolApi.getStats(),
    });

    const searchQuery = useQuery({
        queryKey: ["lead-pool", "search", searchParams],
        queryFn: () => leadPoolApi.search(searchParams),
    });

    const claimMutation = useMutation({
        mutationFn: async (input: {
            item: SharedLeadItem;
            createCampaign?: boolean;
        }) => {
            if (input.item.claimed && input.item.claimedLeadId) {
                return {
                    leadId: input.item.claimedLeadId,
                    createCampaign: input.createCampaign,
                    alreadyClaimed: true,
                };
            }

            const result = await leadPoolApi.claim({ sharedLeadId: input.item.id });
            return {
                leadId: result.leadId,
                createCampaign: input.createCampaign,
                alreadyClaimed: false,
            };
        },
        onSuccess: async ({ leadId, createCampaign, alreadyClaimed }) => {
            toast({
                title: alreadyClaimed ? "Lead ja estava claimed" : "Lead claimed com sucesso",
            });
            await queryClient.invalidateQueries({ queryKey: ["lead-pool"] });
            if (createCampaign && leadId) {
                router.push(`/campaigns/new?leadIds=${leadId}`);
            }
        },
        onError: (error) => {
            toast({
                title: "Erro ao fazer claim",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        },
    });

    const stats = statsQuery.data || {
        sharedLeads: 0,
        sharedLeads30d: 0,
        orgClaims: 0,
        claimedWithLead: 0,
    };

    const items = searchQuery.data?.items || [];
    const meta = searchQuery.data?.meta;

    const applyFilters = (value: LeadPoolFiltersValue) => {
        setAppliedFilters(value);
        setPage(1);
    };

    return (
        <AppLayout>
            <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Lead Pool</h1>
                        <p className="text-muted-foreground">
                            Reaproveite leads compartilhados da rede e transforme em pipeline ativo.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => router.push("/scraping")}>
                            Nova Descoberta
                        </Button>
                        <Button variant="outline" onClick={() => router.push("/leads")}>
                            Ver Leads
                        </Button>
                        <Button onClick={() => router.push("/campaigns/new")}>Nova Sequencia</Button>
                    </div>
                </div>

                <LeadPoolStats
                    sharedLeads={stats.sharedLeads}
                    sharedLeads30d={stats.sharedLeads30d}
                    orgClaims={stats.orgClaims}
                    claimedWithLead={stats.claimedWithLead}
                />

                {statsQuery.isError && (
                    <Card className="border-destructive">
                        <CardContent className="pt-6 text-sm text-destructive">
                            Falha ao carregar estatisticas: {getErrorMessage(statsQuery.error)}
                        </CardContent>
                    </Card>
                )}

                <LeadPoolFilters
                    initialValue={appliedFilters}
                    onApply={applyFilters}
                    loading={searchQuery.isFetching}
                />

                {searchQuery.isError && (
                    <Card className="border-destructive">
                        <CardContent className="pt-6 text-sm text-destructive">
                            Falha ao buscar lead pool: {getErrorMessage(searchQuery.error)}
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle>Resultados Compartilhados</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <LeadPoolTable
                            items={items}
                            loading={searchQuery.isLoading}
                            claimingId={claimMutation.variables?.item.id || null}
                            onClaim={(item) => claimMutation.mutate({ item })}
                            onClaimAndCreateCampaign={(item) =>
                                claimMutation.mutate({ item, createCampaign: true })
                            }
                        />
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                {meta ? `${meta.total} leads encontrados` : "Sem dados"}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                                    disabled={page <= 1 || searchQuery.isFetching}
                                >
                                    Anterior
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage((current) => current + 1)}
                                    disabled={!meta || page >= meta.totalPages || searchQuery.isFetching}
                                >
                                    Proximo
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
