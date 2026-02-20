"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Image from "next/image";
import { integrationsApi, WhatsappInstance } from "@/lib/integrations-api";
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { IconPlus, IconTrash, IconQrcode, IconRefresh } from "@tabler/icons-react";

const formSchema = z.object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    instanceName: z.string().optional(), // Auto-generated if empty
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
            toast({ title: "Instância WhatsApp criada!" });
            setOpen(false);
            form.reset();
            onRefresh();
        } catch (error) {
            console.error(error);
            toast({
                title: "Erro ao criar",
                description: error instanceof Error ? error.message : "Erro desconhecido",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja remover esta instância?")) return;
        try {
            await integrationsApi.deleteWhatsapp(id);
            toast({ title: "Instância removida!" });
            onRefresh();
        } catch (error) {
            console.error(error);
            toast({
                title: "Erro ao remover",
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
            console.error(error);
            toast({
                title: "Erro ao carregar QR Code",
                variant: "destructive",
            });
            setQrOpen(false);
        } finally {
            setRefreshingQr(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium">WhatsApp</h3>
                    <p className="text-sm text-muted-foreground">
                        Conecte instâncias do WhatsApp para envio de mensagens.
                    </p>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline">
                            <IconPlus className="mr-2 h-4 w-4" />
                            Nova Instância
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Nova Instância WhatsApp</DialogTitle>
                            <DialogDescription>
                                Crie uma nova sessão para conectar seu telefone.
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nome da Instância</FormLabel>
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
                                            <FormLabel>Limite Diário</FormLabel>
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
                                        {loading ? "Criando..." : "Criar Instância"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>

                {/* QR Code Dialog */}
                <Dialog open={qrOpen} onOpenChange={setQrOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Escanear QR Code</DialogTitle>
                            <DialogDescription>
                                Abra o WhatsApp no seu celular e escaneie o código abaixo.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex items-center justify-center p-4 bg-white rounded-lg">
                            {refreshingQr ? (
                                <div className="flex flex-col items-center py-8">
                                    <IconRefresh className="animate-spin h-8 w-8 text-primary mb-2" />
                                    <span className="text-sm text-muted-foreground">Carregando código...</span>
                                </div>
                            ) : qrCode ? (
                                <Image
                                    src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                                    alt="WhatsApp QR Code"
                                    width={256}
                                    height={256}
                                    className="w-64 h-64 object-contain"
                                    unoptimized
                                />
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    Não foi possível carregar o QR Code.
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Instância ID</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {instances.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                    Nenhuma instância WhatsApp conectada.
                                </TableCell>
                            </TableRow>
                        )}
                        {instances.map((instance) => (
                            <TableRow key={instance.id}>
                                <TableCell className="font-medium">{instance.name}</TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                    {instance.instanceName}
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant={instance.status === 'CONNECTED' ? 'default' : 'secondary'}
                                        className={instance.status === 'CONNECTED' ? 'bg-green-600' : ''}
                                    >
                                        {instance.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right flex justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleShowQr(instance.id)}
                                        disabled={instance.status === 'CONNECTED'}
                                    >
                                        <IconQrcode className="h-4 w-4 mr-2" />
                                        QR Code
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => handleDelete(instance.id)}
                                    >
                                        <IconTrash className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
