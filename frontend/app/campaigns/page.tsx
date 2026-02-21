"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    IconDots,
    IconPlus,
    IconSearch,
    IconPlayerPlay,
    IconPlayerPause,
    IconPencil,
    IconTrash,
    IconCopy,
    IconMail,
    IconBrandWhatsapp,
    IconArchive,
} from "@tabler/icons-react";
import { useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { campaignsApi } from "@/lib/campaigns-api";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    ACTIVE: "default",
    PAUSED: "secondary",
    DRAFT: "outline",
    COMPLETED: "secondary",
};

const statusLabels: Record<string, string> = {
    ACTIVE: "Ativa",
    PAUSED: "Pausada",
    DRAFT: "Rascunho",
    COMPLETED: "Concluida",
};

const channelLabels: Record<string, string> = {
    EMAIL: "Email",
    WHATSAPP: "WhatsApp",
    MULTI_CHANNEL: "Multicanal",
};

export default function CampaignsPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [search, setSearch] = useState("");

    const { data, isLoading, refetch } = useQuery({
        queryKey: ["campaigns", search],
        queryFn: () => campaignsApi.list({ search }),
    });

    const campaigns = data?.campaigns || [];

    const stats = {
        total: campaigns.length,
        active: campaigns.filter((c) => c.status === "ACTIVE").length,
        paused: campaigns.filter((c) => c.status === "PAUSED").length,
        draft: campaigns.filter((c) => c.status === "DRAFT").length,
    };

    const handleStatusToggle = async (id: string, current: string) => {
        const next = current === "ACTIVE" ? "PAUSED" : "ACTIVE";
        try {
            await campaignsApi.updateStatus(
                id,
                next as "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED"
            );
            toast({ title: "Status atualizado" });
            refetch();
        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao atualizar status", variant: "destructive" });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Excluir esta sequencia?")) return;
        try {
            await campaignsApi.delete(id);
            toast({ title: "Sequencia removida" });
            refetch();
        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao excluir", variant: "destructive" });
        }
    };

    const handleDuplicate = (id: string) => {
        router.push(`/campaigns/new?clone=${id}`);
    };

    const handleArchive = async (id: string) => {
        try {
            await campaignsApi.updateStatus(id, "COMPLETED");
            toast({ title: "Sequencia arquivada" });
            refetch();
        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao arquivar", variant: "destructive" });
        }
    };

    return (
        <AppLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold tracking-tight">Sequencias</h2>
                    <Button asChild>
                        <Link href="/campaigns/new">
                            <IconPlus className="mr-2 h-4 w-4" />
                            Nova Sequencia
                        </Link>
                    </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Total</CardTitle>
                        </CardHeader>
                        <CardContent className="text-2xl font-bold">{stats.total}</CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Ativas</CardTitle>
                        </CardHeader>
                        <CardContent className="text-2xl font-bold">{stats.active}</CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Pausadas</CardTitle>
                        </CardHeader>
                        <CardContent className="text-2xl font-bold">{stats.paused}</CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Rascunhos</CardTitle>
                        </CardHeader>
                        <CardContent className="text-2xl font-bold">{stats.draft}</CardContent>
                    </Card>
                </div>

                <div className="flex items-center gap-2 max-w-sm">
                    <div className="relative flex-1">
                        <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar sequencias..."
                            className="pl-9"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="rounded-md border bg-white dark:bg-neutral-900 overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Metricas</TableHead>
                                <TableHead>Criada em</TableHead>
                                <TableHead className="text-right">Acoes</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        Carregando sequencias...
                                    </TableCell>
                                </TableRow>
                            ) : campaigns.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        Nenhuma sequencia encontrada. Crie sua primeira sequencia!
                                    </TableCell>
                                </TableRow>
                            ) : (
                                campaigns.map((campaign) => (
                                    <TableRow key={campaign.id}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{campaign.name}</span>
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                                    {campaign.type === "EMAIL" ? (
                                                        <IconMail className="h-3 w-3" />
                                                    ) : campaign.type === "WHATSAPP" ? (
                                                        <IconBrandWhatsapp className="h-3 w-3" />
                                                    ) : (
                                                        <>
                                                            <IconMail className="h-3 w-3" />
                                                            <IconBrandWhatsapp className="h-3 w-3" />
                                                        </>
                                                    )}
                                                    <span className="capitalize">
                                                        {channelLabels[campaign.type] || campaign.type}
                                                    </span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={statusColors[campaign.status]}>
                                                {statusLabels[campaign.status] || campaign.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-4 text-sm">
                                                <div className="flex flex-col items-center">
                                                    <span className="font-bold">
                                                        {campaign.stats?.totalLeads || 0}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        Total
                                                    </span>
                                                </div>
                                                <div className="flex flex-col items-center">
                                                    <span className="font-bold">
                                                        {campaign.stats?.completedLeads || 0}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        Completos
                                                    </span>
                                                </div>
                                                <div className="flex flex-col items-center">
                                                    <span className="font-bold">
                                                        {campaign.stats?.repliedLeads || 0}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        Respostas
                                                    </span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>{formatDate(campaign.createdAt)}</TableCell>
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
                                                    <DropdownMenuItem onClick={() => handleStatusToggle(campaign.id, campaign.status)}>
                                                        {campaign.status === "ACTIVE" ? (
                                                            <>
                                                                <IconPlayerPause className="mr-2 h-4 w-4" /> Pausar
                                                            </>
                                                        ) : (
                                                            <>
                                                                <IconPlayerPlay className="mr-2 h-4 w-4" /> Ativar
                                                            </>
                                                        )}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => router.push(`/campaigns/${campaign.id}`)}>
                                                        <IconPencil className="mr-2 h-4 w-4" /> Editar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleDuplicate(campaign.id)}>
                                                        <IconCopy className="mr-2 h-4 w-4" /> Duplicar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleArchive(campaign.id)}>
                                                        <IconArchive className="mr-2 h-4 w-4" /> Arquivar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(campaign.id)}>
                                                        <IconTrash className="mr-2 h-4 w-4" /> Excluir
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </AppLayout>
    );
}



