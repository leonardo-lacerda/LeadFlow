"use client";

import { useCallback, useEffect, useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { CampaignLeadItem, campaignsApi } from "@/lib/campaigns-api";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { IconSearch, IconChevronLeft, IconChevronRight, IconLoader } from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CampaignLeadsTableProps {
    campaignId: string;
}

export function CampaignLeadsTable({ campaignId }: CampaignLeadsTableProps) {
    const [loading, setLoading] = useState(true);
    const [leads, setLeads] = useState<CampaignLeadItem[]>([]);
    const [total, setTotal] = useState(0);

    // Filters
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<string>("ALL");

    const debouncedSearch = useDebounce(search, 500);

    const loadLeads = useCallback(async () => {
        try {
            setLoading(true);
            const data = await campaignsApi.getCampaignLeads(campaignId, {
                page,
                limit,
                search: debouncedSearch || undefined,
                status: status === "ALL" ? undefined : status,
            });
            setLeads(data.leads);
            setTotal(data.total);
        } catch (error) {
            console.error("Failed to load leads:", error);
        } finally {
            setLoading(false);
        }
    }, [campaignId, page, limit, debouncedSearch, status]);

    useEffect(() => {
        loadLeads();
    }, [loadLeads]);

    const totalPages = Math.ceil(total / limit);

    const getStatusBadge = (status: string) => {
        const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
            PENDING: "secondary",
            SENT: "outline",
            OPENED: "default",
            REPLIED: "default", // Maybe a different color for replied?
            BOUNCED: "destructive",
        };

        // Custom style for REPLIED to stand out
        if (status === "REPLIED") {
            return <Badge className="bg-green-600 hover:bg-green-700">Respondido</Badge>;
        }

        return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
    };

    return (
        <div className="space-y-4">
            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <div className="relative w-full sm:w-72">
                    <IconSearch className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nome, email ou empresa..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8"
                    />
                </div>

                <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Todos os Status</SelectItem>
                        <SelectItem value="PENDING">Pendente</SelectItem>
                        <SelectItem value="SENT">Enviado</SelectItem>
                        <SelectItem value="OPENED">Aberto</SelectItem>
                        <SelectItem value="REPLIED">Respondido</SelectItem>
                        <SelectItem value="BOUNCED">Bounce / Erro</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Lead</TableHead>
                            <TableHead>Empresa</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Passo Atual</TableHead>
                            <TableHead>Última Atividade</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                        <IconLoader className="h-4 w-4 animate-spin" />
                                        Carregando leads...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : leads.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    Nenhum lead encontrado com os filtros atuais.
                                </TableCell>
                            </TableRow>
                        ) : (
                            leads.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <div className="font-medium">{item.lead.fullName}</div>
                                        <div className="text-sm text-muted-foreground">{item.lead.email}</div>
                                    </TableCell>
                                    <TableCell>{item.lead.companyName || "-"}</TableCell>
                                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                                    <TableCell>Passo {item.currentStep + 1}</TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {item.lastActivityAt
                                            ? formatDistanceToNow(new Date(item.lastActivityAt), { addSuffix: true, locale: ptBR })
                                            : "-"}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    Mostrando {leads.length} de {total} leads
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || loading}
                    >
                        <IconChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium">
                        Página {page} de {totalPages || 1}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages || loading}
                    >
                        <IconChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
