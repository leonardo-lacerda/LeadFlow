"use client";

import { useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { IconPlus, IconQrcode, IconRefresh, IconTrash } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { integrationsApi, WhatsappInstance } from "@/lib/integrations-api";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/error-utils";

const formSchema = z.object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    instanceName: z.string().optional(),
    dailyLimit: z.coerce.number().int().positive().optional(),
});

type WhatsappFormInput = z.input<typeof formSchema>;
type WhatsappFormValues = z.output<typeof formSchema>;

interface WhatsappListProps {
    instances: WhatsappInstance[];
    onRefresh: () => void;
}

export function WhatsappList({ instances, onRefresh }: WhatsappListProps) {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [qrOpen, setQrOpen] = useState(false);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [refreshingQr, setRefreshingQr] = useState(false);
    const [actionId, setActionId] = useState<string | null>(null);

    const form = useForm<WhatsappFormInput, unknown, WhatsappFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            dailyLimit: 100,
        },
    });

    const onSubmit = async (values: WhatsappFormValues) => {
        setLoading(true);
        try {
            await integrationsApi.createWhatsapp(values);
            toast({ title: "Instancia WhatsApp criada" });
            setOpen(false);
            form.reset();
            onRefresh();
        } catch (error) {
            toast({
                title: "Erro ao criar instancia",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja remover esta instancia?")) {
            return;
        }
        try {
            await integrationsApi.deleteWhatsapp(id);
            toast({ title: "Instancia removida" });
            onRefresh();
        } catch (error) {
            toast({
                title: "Erro ao remover instancia",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        }
    };

    const handleShowQr = async (id: string) => {
        setQrOpen(true);
        setQrCode(null);
        setRefreshingQr(true);
        try {
            const code = await integrationsApi.getQrCode(id);
            setQrCode(code);
        } catch (error) {
            toast({
                title: "Erro ao carregar QR code",
                description: getErrorMessage(error),
                variant: "destructive",
            });
            setQrOpen(false);
        } finally {
            setRefreshingQr(false);
        }
    };

    const handleToggleActive = async (instance: WhatsappInstance) => {
        try {
            setActionId(instance.id);
            await integrationsApi.updateWhatsapp(instance.id, {
                isActive: !instance.isActive,
            });
            toast({
                title: instance.isActive ? "Instancia desativada" : "Instancia ativada",
            });
            onRefresh();
        } catch (error) {
            toast({
                title: "Erro ao atualizar instancia",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        } finally {
            setActionId(null);
        }
    };

    const handleRefreshStatus = async (instance: WhatsappInstance) => {
        try {
            setActionId(instance.id);
            const status = await integrationsApi.getWhatsappStatus(instance.id);
            toast({ title: `Status atual: ${status}` });
            onRefresh();
        } catch (error) {
            toast({
                title: "Erro ao consultar status",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        } finally {
            setActionId(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">WhatsApp</h3>
                    <p className="text-sm text-muted-foreground">
                        Conecte instancias para envio de mensagens.
                    </p>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline">
                            <IconPlus className="mr-2 h-4 w-4" />
                            Nova Instancia
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md w-11/12">
                        <DialogHeader>
                            <DialogTitle>Nova Instancia WhatsApp</DialogTitle>
                            <DialogDescription>
                                Crie uma nova sessao para conectar seu telefone.
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nome da instancia</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Ex: Vendas 01" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="dailyLimit"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Limite diario</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    name={field.name}
                                                    ref={field.ref}
                                                    value={typeof field.value === "number" ? field.value : ""}
                                                    onBlur={field.onBlur}
                                                    onChange={(event) => field.onChange(event.target.value)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <DialogFooter>
                                    <Button type="submit" disabled={loading}>
                                        {loading ? "Criando..." : "Criar instancia"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            <Dialog open={qrOpen} onOpenChange={setQrOpen}>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md w-11/12">
                    <DialogHeader>
                        <DialogTitle>Escanear QR code</DialogTitle>
                        <DialogDescription>
                            Abra o WhatsApp no celular e escaneie o codigo abaixo.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center justify-center rounded-lg bg-white p-4">
                        {refreshingQr ? (
                            <div className="flex flex-col items-center py-8">
                                <IconRefresh className="mb-2 h-8 w-8 animate-spin text-primary" />
                                <span className="text-sm text-muted-foreground">Carregando codigo...</span>
                            </div>
                        ) : qrCode ? (
                            <Image
                                src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                                alt="WhatsApp QR code"
                                width={256}
                                height={256}
                                className="h-64 w-64 object-contain"
                                unoptimized
                            />
                        ) : (
                            <div className="py-8 text-center text-muted-foreground">
                                Nao foi possivel carregar o QR code.
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <div className="rounded-md border overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Instancia ID</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Ativa</TableHead>
                            <TableHead className="text-right">Acoes</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {instances.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    Nenhuma instancia WhatsApp conectada.
                                </TableCell>
                            </TableRow>
                        ) : (
                            instances.map((instance) => (
                                <TableRow key={instance.id}>
                                    <TableCell className="font-medium">{instance.name}</TableCell>
                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                        {instance.instanceName}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={instance.status === "CONNECTED" ? "default" : "secondary"}
                                            className={instance.status === "CONNECTED" ? "bg-green-600" : ""}
                                        >
                                            {instance.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {instance.isActive ? (
                                            <Badge variant="outline">Ativa</Badge>
                                        ) : (
                                            <Badge variant="secondary">Inativa</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleRefreshStatus(instance)}
                                                disabled={actionId === instance.id}
                                            >
                                                Status
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleToggleActive(instance)}
                                                disabled={actionId === instance.id}
                                            >
                                                {instance.isActive ? "Desativar" : "Ativar"}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleShowQr(instance.id)}
                                                disabled={instance.status === "CONNECTED" || actionId === instance.id}
                                            >
                                                <IconQrcode className="mr-2 h-4 w-4" />
                                                QR code
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                onClick={() => handleDelete(instance.id)}
                                            >
                                                <IconTrash className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
