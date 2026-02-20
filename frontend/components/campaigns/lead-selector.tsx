"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { IconSearch, IconFilter, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { leadsApi, Lead } from "@/lib/leads-api";
import { useQuery } from "@tanstack/react-query";

interface LeadSelectorProps {
    selectedLeads: string[];
    onSelectionChange: (ids: string[]) => void;
}

export function LeadSelector({ selectedLeads, onSelectionChange }: LeadSelectorProps) {
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);

    const { data, isLoading } = useQuery({
        queryKey: ["leads", "selector", page, search],
        queryFn: () => leadsApi.list({ page, limit: 20, search }),
    });

    const leads = data?.data || [];
    const totalPages = data?.meta?.totalPages || 1;

    const toggleLead = (id: string) => {
        if (selectedLeads.includes(id)) {
            onSelectionChange(selectedLeads.filter((leadId) => leadId !== id));
        } else {
            onSelectionChange([...selectedLeads, id]);
        }
    };

    const toggleAll = () => {
        const visibleIds = leads.map((l) => l.id);
        if (visibleIds.every((id) => selectedLeads.includes(id))) {
            onSelectionChange(selectedLeads.filter((id) => !visibleIds.includes(id)));
        } else {
            const newSelected = [...new Set([...selectedLeads, ...visibleIds])];
            onSelectionChange(newSelected);
        }
    };

    const isAllSelected = leads.length > 0 &&
        leads.every((lead) => selectedLeads.includes(lead.id));

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <div className="relative flex-1">
                    <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nome, empresa ou cargo..."
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Button variant="outline" className="gap-2">
                    <IconFilter className="h-4 w-4" /> Filtros
                </Button>
            </div>

            <div className="border rounded-md max-h-[400px] overflow-y-auto">
                <Table>
                    <TableHeader className="bg-neutral-50 dark:bg-neutral-900 sticky top-0 z-10">
                        <TableRow>
                            <TableHead className="w-[50px]">
                                <Checkbox
                                    checked={isAllSelected}
                                    onCheckedChange={toggleAll}
                                />
                            </TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>Empresa</TableHead>
                            <TableHead>Cargo</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    Carregando...
                                </TableCell>
                            </TableRow>
                        ) : leads.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    Nenhum lead encontrado.
                                </TableCell>
                            </TableRow>
                        ) : (
                            leads.map((lead: Lead) => (
                                <TableRow
                                    key={lead.id}
                                    className={selectedLeads.includes(lead.id) ? "bg-muted/50" : ""}
                                    onClick={() => toggleLead(lead.id)}
                                >
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <Checkbox
                                            checked={selectedLeads.includes(lead.id)}
                                            onCheckedChange={() => toggleLead(lead.id)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium">{lead.fullName}</div>
                                        <div className="text-xs text-muted-foreground">{lead.email}</div>
                                    </TableCell>
                                    <TableCell>{lead.companyName}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="font-normal">
                                            {lead.jobTitle || "-"}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted/20 p-2 rounded-md">
                <span>{selectedLeads.length} leads selecionados</span>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))}>
                        <IconChevronLeft className="h-4 w-4" />
                    </Button>
                    <span>Página {page} de {totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                        <IconChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
