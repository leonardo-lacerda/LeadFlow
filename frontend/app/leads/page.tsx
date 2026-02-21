"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { leadsApi, LeadInput } from "@/lib/leads-api";
import { signalsApi } from "@/lib/signals-api";
import { downloadCsv, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
    IconDots,
    IconDownload,
    IconEye,
    IconFilter,
    IconPencil,
    IconPlus,
    IconSearch,
    IconTrash,
} from "@tabler/icons-react";

interface LeadRow {
    id: string;
    fullName: string | null;
    email: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    companyName: string | null;
    jobTitle: string | null;
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

    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<LeadStatusFilter>("ALL");
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
    const [form, setForm] = useState<LeadInput>(EMPTY_FORM);

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

    const recommendationMap = useMemo(
        () =>
            new Map(
                (recommendations || []).map((item) => [
                    item.leadId,
                    item,
                ])
            ),
        [recommendations]
    );

    const refreshLeads = async () => {
        await queryClient.invalidateQueries({ queryKey: ["leads"] });
    };

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
                description: error instanceof Error ? error.message : "Erro desconhecido",
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    const saveEdit = async () => {
        if (!selectedLeadId) {
            return;
        }

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
                description: error instanceof Error ? error.message : "Erro desconhecido",
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    const removeLead = async (lead: LeadRow) => {
        if (!confirm(`Excluir lead ${lead.fullName || lead.email || lead.id}?`)) {
            return;
        }
        try {
            await leadsApi.delete(lead.id);
            toast({ title: "Lead removido" });
            await refreshLeads();
        } catch (error) {
            toast({
                title: "Erro ao excluir lead",
                description: error instanceof Error ? error.message : "Erro desconhecido",
                variant: "destructive",
            });
        }
    };

    const exportCurrentRows = () => {
        if (rows.length === 0) {
            toast({ title: "Sem dados para exportar", variant: "destructive" });
            return;
        }

        downloadCsv(
            `leads-${new Date().toISOString().slice(0, 10)}.csv`,
            rows.map((lead) => ({
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

    return (
        <AppLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold tracking-tight">Leads + Sinais</h2>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={exportCurrentRows}>
                            <IconDownload className="mr-2 h-4 w-4" />
                            Exportar
                        </Button>
                        <Button size="sm" onClick={openCreate}>
                            <IconPlus className="mr-2 h-4 w-4" />
                            Novo Lead
                        </Button>
                    </div>
                </div>

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

                <div className="rounded-md border bg-white dark:bg-neutral-900">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Empresa</TableHead>
                                <TableHead>Cargo</TableHead>
                                <TableHead>Score</TableHead>
                                <TableHead>Canal</TableHead>
                                <TableHead>Janela</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Data</TableHead>
                                <TableHead className="text-right">Acoes</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-24 text-center">
                                        Carregando leads...
                                    </TableCell>
                                </TableRow>
                            ) : rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-24 text-center">
                                        Nenhum lead encontrado.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((lead) => {
                                    const recommendation = recommendationMap.get(lead.id);
                                    const channelLabel =
                                        recommendation?.recommendedChannel === "whatsapp"
                                            ? "WhatsApp"
                                            : recommendation?.recommendedChannel === "email"
                                                ? "Email"
                                                : "-";
                                    const windowLabel = recommendation
                                        ? `${WEEKDAY_LABEL[recommendation.bestWindow.dayOfWeek] || recommendation.bestWindow.dayOfWeek} ${String(recommendation.bestWindow.hour).padStart(2, "0")}h`
                                        : "-";

                                    return (
                                    <TableRow key={lead.id}>
                                        <TableCell>
                                            <div className="font-medium">{lead.fullName || "Sem nome"}</div>
                                            <div className="text-sm text-muted-foreground">{lead.email || "-"}</div>
                                        </TableCell>
                                        <TableCell>{lead.companyName || "-"}</TableCell>
                                        <TableCell>{lead.jobTitle || "-"}</TableCell>
                                        <TableCell>
                                            {recommendation ? (
                                                <Badge variant="outline">
                                                    {recommendation.sharedScore}
                                                </Badge>
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

                <div className="flex items-center justify-end space-x-2">
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

                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Novo Lead</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Nome</Label>
                                <Input
                                    value={form.fullName || ""}
                                    onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input
                                    value={form.email || ""}
                                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Empresa</Label>
                                <Input
                                    value={form.companyName || ""}
                                    onChange={(event) => setForm((prev) => ({ ...prev, companyName: event.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Cargo</Label>
                                <Input
                                    value={form.jobTitle || ""}
                                    onChange={(event) => setForm((prev) => ({ ...prev, jobTitle: event.target.value }))}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setCreateOpen(false)}>
                                Cancelar
                            </Button>
                            <Button onClick={saveCreate} disabled={saving}>
                                {saving ? "Salvando..." : "Salvar"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Editar Lead</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Nome</Label>
                                <Input
                                    value={form.fullName || ""}
                                    onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input
                                    value={form.email || ""}
                                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Empresa</Label>
                                <Input
                                    value={form.companyName || ""}
                                    onChange={(event) => setForm((prev) => ({ ...prev, companyName: event.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Cargo</Label>
                                <Input
                                    value={form.jobTitle || ""}
                                    onChange={(event) => setForm((prev) => ({ ...prev, jobTitle: event.target.value }))}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditOpen(false)}>
                                Cancelar
                            </Button>
                            <Button onClick={saveEdit} disabled={saving || !selectedLeadId}>
                                {saving ? "Salvando..." : "Salvar"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}



