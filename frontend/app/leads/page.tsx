"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LeadTemperatureBadge } from "@/components/leads/lead-temperature";
import { leadsApi, LeadInput } from "@/lib/leads-api";
import { campaignsApi } from "@/lib/campaigns-api";
import { signalsApi } from "@/lib/signals-api";
import { downloadCsv, formatDate } from "@/lib/utils";
import { enrichmentApi } from "@/lib/enrichment-api";
import { getErrorMessage } from "@/lib/error-utils";
import { useToast } from "@/hooks/use-toast";
import {
    IconDots,
    IconDownload,
    IconEye,
    IconFilter,
    IconMail,
    IconBrandWhatsapp,
    IconPencil,
    IconPlus,
    IconSearch,
    IconTrash,
    IconSparkles,
    IconList,
    IconX,
} from "@tabler/icons-react";

interface LeadRow {
    id: string;
    fullName: string | null;
    email: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    companyName: string | null;
    jobTitle: string | null;
    score?: number | null;
    temperature?: "HOT" | "WARM" | "COLD";
    status: string;
    createdAt: string;
}

const LEAD_STATUS_OPTIONS = [
    "ALL",
    "NEW",
    "ENRICHING",
    "ENRICHED",
    "CONTACTED",
    "REPLIED",
    "INTERESTED",
    "MEETING_SCHEDULED",
    "CONVERTED",
    "NOT_INTERESTED",
    "BOUNCED",
    "UNSUBSCRIBED",
] as const;

type LeadStatusFilter = (typeof LEAD_STATUS_OPTIONS)[number];

const LEAD_STATUS_LABELS: Record<string, string> = {
    ALL: "Todos os status",
    NEW: "Novo",
    ENRICHING: "Enriquecendo",
    ENRICHED: "Enriquecido",
    CONTACTED: "Contatado",
    REPLIED: "Respondeu",
    INTERESTED: "Interessado",
    MEETING_SCHEDULED: "Reuniao agendada",
    CONVERTED: "Convertido",
    NOT_INTERESTED: "Sem interesse",
    BOUNCED: "Erro de entrega",
    UNSUBSCRIBED: "Descadastrado",
};

const EMPTY_FORM: LeadInput = {
    fullName: "",
    email: "",
    companyName: "",
    jobTitle: "",
};

const WEEKDAY_LABEL: Record<string, string> = {
    monday: "Seg",
    tuesday: "Ter",
    wednesday: "Qua",
    thursday: "Qui",
    friday: "Sex",
    saturday: "Sab",
    sunday: "Dom",
};

export default function LeadsPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    // Filters
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<LeadStatusFilter>("ALL");

    // Dialogs
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [addToSequenceOpen, setAddToSequenceOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
    const [form, setForm] = useState<LeadInput>(EMPTY_FORM);

    // Bulk selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Add to sequence state
    const [targetCampaignId, setTargetCampaignId] = useState<string>("");
    const [addingToSequence, setAddingToSequence] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ["leads", page, search, statusFilter],
        queryFn: () =>
            leadsApi.list({
                page,
                search,
                status: statusFilter === "ALL" ? undefined : statusFilter,
            }),
    });

    const rows = useMemo(() => (data?.data || []) as LeadRow[], [data?.data]);
    const leadIds = useMemo(() => rows.map((lead) => lead.id), [rows]);

    const { data: recommendations } = useQuery({
        queryKey: ["signals", "lead-recommendations", leadIds],
        queryFn: () => signalsApi.getLeadRecommendations(leadIds),
        enabled: leadIds.length > 0,
    });

    const { data: campaignsData } = useQuery({
        queryKey: ["campaigns-list"],
        queryFn: () => campaignsApi.list({ status: "DRAFT" }),
        enabled: addToSequenceOpen,
    });

    const recommendationMap = useMemo(
        () =>
            new Map(
                (recommendations || []).map((item) => [item.leadId, item])
            ),
        [recommendations]
    );

    const refreshLeads = async () => {
        await queryClient.invalidateQueries({ queryKey: ["leads"] });
    };

    // Checkbox logic
    const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
    const someSelected = selectedIds.size > 0;

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(rows.map((r) => r.id)));
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const clearSelection = () => setSelectedIds(new Set());

    // Bulk enrich
    const bulkEnrichMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            return enrichmentApi.createJob({
                leadIds: ids,
                name: `Manual enrichment (${ids.length} leads)`,
            });
        },
        onSuccess: (_, ids) => {
            toast({ title: `Enriquecendo ${ids.length} leads...` });
            clearSelection();
            refreshLeads();
        },
        onError: (error) => {
            toast({
                title: "Erro ao enriquecer leads",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        },
    });

    // Add to existing sequence
    const handleAddToSequence = async () => {
        if (!targetCampaignId || selectedIds.size === 0) return;
        setAddingToSequence(true);
        try {
            const result = await campaignsApi.addLeads(targetCampaignId, Array.from(selectedIds));
            toast({ title: `${result.created} leads adicionados a sequencia!` });
            setAddToSequenceOpen(false);
            setTargetCampaignId("");
            clearSelection();
        } catch (error) {
            toast({
                title: "Erro ao adicionar leads",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        } finally {
            setAddingToSequence(false);
        }
    };

    // Create new sequence with selected leads
    const handleCreateSequenceWithLeads = () => {
        const ids = Array.from(selectedIds).join(",");
        router.push(`/campaigns/new?leadIds=${ids}`);
    };

    // CRUD
    const openCreate = () => {
        setSelectedLeadId(null);
        setForm(EMPTY_FORM);
        setCreateOpen(true);
    };

    const openEdit = (lead: LeadRow) => {
        setSelectedLeadId(lead.id);
        setForm({
            fullName: lead.fullName || "",
            email: lead.email || "",
            companyName: lead.companyName || "",
            jobTitle: lead.jobTitle || "",
        });
        setEditOpen(true);
    };

    const saveCreate = async () => {
        setSaving(true);
        try {
            await leadsApi.create(form);
            toast({ title: "Lead criado com sucesso" });
            setCreateOpen(false);
            setForm(EMPTY_FORM);
            await refreshLeads();
        } catch (error) {
            toast({
                title: "Erro ao criar lead",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    const saveEdit = async () => {
        if (!selectedLeadId) return;
        setSaving(true);
        try {
            await leadsApi.update(selectedLeadId, form);
            toast({ title: "Lead atualizado com sucesso" });
            setEditOpen(false);
            setSelectedLeadId(null);
            await refreshLeads();
        } catch (error) {
            toast({
                title: "Erro ao atualizar lead",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    const removeLead = async (lead: LeadRow) => {
        if (!confirm(`Excluir lead ${lead.fullName || lead.email || lead.id}?`)) return;
        try {
            await leadsApi.delete(lead.id);
            toast({ title: "Lead removido" });
            await refreshLeads();
        } catch (error) {
            toast({
                title: "Erro ao excluir lead",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        }
    };

    const exportCurrentRows = () => {
        if (rows.length === 0) {
            toast({ title: "Sem dados para exportar", variant: "destructive" });
            return;
        }
        const toExport = someSelected ? rows.filter((r) => selectedIds.has(r.id)) : rows;
        downloadCsv(
            `leads-${new Date().toISOString().slice(0, 10)}.csv`,
            toExport.map((lead) => ({
                id: lead.id,
                nome: lead.fullName || "",
                email: lead.email || "",
                empresa: lead.companyName || "",
                cargo: lead.jobTitle || "",
                status: LEAD_STATUS_LABELS[lead.status] || lead.status,
                criado_em: formatDate(lead.createdAt),
            }))
        );
        toast({ title: "Exportacao iniciada" });
    };

    const openSendMessage = (lead: LeadRow, channel: "EMAIL" | "WHATSAPP") => {
        router.push(`/inbox?leadId=${lead.id}&channel=${channel}`);
    };

    return (
        <AppLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold tracking-tight">Leads</h2>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={exportCurrentRows}>
                            <IconDownload className="mr-2 h-4 w-4" />
                            {someSelected ? `Exportar (${selectedIds.size})` : "Exportar"}
                        </Button>
                        <Button size="sm" onClick={openCreate}>
                            <IconPlus className="mr-2 h-4 w-4" />
                            Novo Lead
                        </Button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 flex-1">
                        <div className="relative flex-1 max-w-sm">
                            <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nome, email ou empresa..."
                                className="pl-9"
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setPage(1);
                                }}
                            />
                        </div>
                        <div className="w-[220px]">
                            <Select
                                value={statusFilter}
                                onValueChange={(value) => {
                                    setStatusFilter(value as LeadStatusFilter);
                                    setPage(1);
                                }}
                            >
                                <SelectTrigger>
                                    <IconFilter className="mr-2 h-4 w-4" />
                                    <SelectValue placeholder="Filtrar status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {LEAD_STATUS_OPTIONS.map((status) => (
                                        <SelectItem key={status} value={status}>
                                            {LEAD_STATUS_LABELS[status] || status}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                {/* Bulk Actions Toolbar */}
                {someSelected && (
                    <div className="flex items-center gap-3 rounded-lg border bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800 px-4 py-2.5">
                        <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                            {selectedIds.size} lead{selectedIds.size > 1 ? "s" : ""} selecionado{selectedIds.size > 1 ? "s" : ""}
                        </span>
                        <div className="flex items-center gap-2 ml-auto">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => bulkEnrichMutation.mutate(Array.from(selectedIds))}
                                disabled={bulkEnrichMutation.isPending}
                            >
                                <IconSparkles className="mr-2 h-4 w-4" />
                                Enriquecer dados
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setAddToSequenceOpen(true)}
                            >
                                <IconList className="mr-2 h-4 w-4" />
                                Adicionar a sequencia
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleCreateSequenceWithLeads}
                            >
                                <IconPlus className="mr-2 h-4 w-4" />
                                Criar sequencia
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={clearSelection}
                            >
                                <IconX className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="rounded-md border bg-white dark:bg-neutral-900">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10">
                                    <Checkbox
                                        checked={allSelected}
                                        onCheckedChange={toggleSelectAll}
                                        aria-label="Selecionar todos"
                                    />
                                </TableHead>
                                <TableHead>Nome</TableHead>
                                <TableHead>Empresa</TableHead>
                                <TableHead>Cargo</TableHead>
                                <TableHead>Score</TableHead>
                                <TableHead>Temperatura</TableHead>
                                <TableHead>Canal Ideal</TableHead>
                                <TableHead>Melhor Janela</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Data</TableHead>
                                <TableHead className="text-right">Acoes</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={11} className="h-24 text-center">
                                        Carregando leads...
                                    </TableCell>
                                </TableRow>
                            ) : rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={11} className="h-32 text-center">
                                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                            <p>Nenhum lead encontrado.</p>
                                            <Button size="sm" variant="outline" onClick={openCreate}>
                                                <IconPlus className="mr-2 h-4 w-4" />
                                                Adicionar lead manualmente
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((lead) => {
                                    const recommendation = recommendationMap.get(lead.id);
                                    const scoreValue =
                                        typeof lead.score === "number"
                                            ? lead.score
                                            : recommendation?.sharedScore;
                                    const channelLabel =
                                        recommendation?.recommendedChannel === "whatsapp"
                                            ? "WhatsApp"
                                            : recommendation?.recommendedChannel === "email"
                                                ? "Email"
                                                : "-";
                                    const windowLabel = recommendation
                                        ? `${WEEKDAY_LABEL[recommendation.bestWindow.dayOfWeek] || recommendation.bestWindow.dayOfWeek} ${String(recommendation.bestWindow.hour).padStart(2, "0")}h`
                                        : "-";
                                    const isSelected = selectedIds.has(lead.id);

                                    return (
                                        <TableRow key={lead.id} className={isSelected ? "bg-indigo-50/50 dark:bg-indigo-950/20" : undefined}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={() => toggleSelect(lead.id)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium">{lead.fullName || "Sem nome"}</div>
                                                <div className="text-sm text-muted-foreground">{lead.email || "-"}</div>
                                            </TableCell>
                                            <TableCell>{lead.companyName || "-"}</TableCell>
                                            <TableCell>{lead.jobTitle || "-"}</TableCell>
                                            <TableCell>
                                                {typeof scoreValue === "number" ? (
                                                    <Badge variant="outline">{scoreValue}</Badge>
                                                ) : (
                                                    "-"
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {lead.temperature ? (
                                                    <LeadTemperatureBadge temperature={lead.temperature} />
                                                ) : (
                                                    "-"
                                                )}
                                            </TableCell>
                                            <TableCell>{channelLabel}</TableCell>
                                            <TableCell>{windowLabel}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">
                                                    {LEAD_STATUS_LABELS[lead.status] || lead.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{formatDate(lead.createdAt)}</TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <span className="sr-only">Menu</span>
                                                            <IconDots className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Acoes</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => router.push(`/leads/${lead.id}`)}>
                                                            <IconEye className="mr-2 h-4 w-4" />
                                                            Ver detalhes
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => openEdit(lead)}>
                                                            <IconPencil className="mr-2 h-4 w-4" />
                                                            Editar
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => openSendMessage(lead, "EMAIL")}>
                                                            <IconMail className="mr-2 h-4 w-4" />
                                                            Enviar email
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => openSendMessage(lead, "WHATSAPP")}>
                                                            <IconBrandWhatsapp className="mr-2 h-4 w-4" />
                                                            Enviar WhatsApp
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => {
                                                            setSelectedIds(new Set([lead.id]));
                                                            setAddToSequenceOpen(true);
                                                        }}>
                                                            <IconList className="mr-2 h-4 w-4" />
                                                            Adicionar a sequencia
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => bulkEnrichMutation.mutate([lead.id])}>
                                                            <IconSparkles className="mr-2 h-4 w-4" />
                                                            Enriquecer dados
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-red-600"
                                                            onClick={() => removeLead(lead)}
                                                        >
                                                            <IconTrash className="mr-2 h-4 w-4" />
                                                            Excluir
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        {someSelected ? `${selectedIds.size} de ${data?.meta?.total || rows.length} selecionados` : `${data?.meta?.total || rows.length} leads no total`}
                    </p>
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((value) => Math.max(1, value - 1))}
                            disabled={page === 1 || isLoading}
                        >
                            Anterior
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((value) => value + 1)}
                            disabled={!data?.meta || page >= data.meta.totalPages || isLoading}
                        >
                            Proximo
                        </Button>
                    </div>
                </div>

                {/* Create Dialog */}
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Novo Lead</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Nome</Label>
                                <Input value={form.fullName || ""} onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input value={form.email || ""} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Empresa</Label>
                                <Input value={form.companyName || ""} onChange={(e) => setForm((prev) => ({ ...prev, companyName: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Cargo</Label>
                                <Input value={form.jobTitle || ""} onChange={(e) => setForm((prev) => ({ ...prev, jobTitle: e.target.value }))} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                            <Button onClick={saveCreate} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Edit Dialog */}
                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Editar Lead</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Nome</Label>
                                <Input value={form.fullName || ""} onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input value={form.email || ""} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Empresa</Label>
                                <Input value={form.companyName || ""} onChange={(e) => setForm((prev) => ({ ...prev, companyName: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Cargo</Label>
                                <Input value={form.jobTitle || ""} onChange={(e) => setForm((prev) => ({ ...prev, jobTitle: e.target.value }))} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
                            <Button onClick={saveEdit} disabled={saving || !selectedLeadId}>{saving ? "Salvando..." : "Salvar"}</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Add to Sequence Dialog */}
                <Dialog open={addToSequenceOpen} onOpenChange={setAddToSequenceOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Adicionar a Sequencia</DialogTitle>
                            <DialogDescription>
                                {selectedIds.size} lead{selectedIds.size > 1 ? "s" : ""} selecionado{selectedIds.size > 1 ? "s" : ""}.
                                Escolha uma sequencia existente ou crie uma nova.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <div className="space-y-2">
                                <Label>Sequencia existente</Label>
                                <Select value={targetCampaignId} onValueChange={setTargetCampaignId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione uma sequencia..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(campaignsData?.campaigns || []).map((c) => (
                                            <SelectItem key={c.id} value={c.id}>
                                                {c.name} ({c.type})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-background px-2 text-muted-foreground">ou</span>
                                </div>
                            </div>
                            <Button variant="outline" className="w-full" onClick={handleCreateSequenceWithLeads}>
                                <IconPlus className="mr-2 h-4 w-4" />
                                Criar nova sequencia com esses leads
                            </Button>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setAddToSequenceOpen(false)}>Cancelar</Button>
                            <Button
                                onClick={handleAddToSequence}
                                disabled={!targetCampaignId || addingToSequence}
                            >
                                {addingToSequence ? "Adicionando..." : "Adicionar"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}
