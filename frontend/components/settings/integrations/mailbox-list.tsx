"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { integrationsApi, Mailbox } from "@/lib/integrations-api";
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
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { IconCheck, IconPlus, IconTrash } from "@tabler/icons-react";
import { getErrorMessage } from "@/lib/error-utils";

const formSchema = z.object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    email: z.string().email("Email invalido"),
    smtpHost: z.string().min(1, "Host SMTP e obrigatorio"),
    smtpPort: z.coerce.number().int().positive("Porta deve ser um numero positivo"),
    smtpUser: z.string().min(1, "Usuario SMTP e obrigatorio"),
    smtpPass: z.string().min(1, "Senha SMTP e obrigatoria"),
    imapHost: z.string().optional(),
    imapPort: z.coerce.number().int().optional(),
    imapUser: z.string().optional(),
    imapPass: z.string().optional(),
    dailyLimit: z.coerce.number().int().positive().optional(),
});

type MailboxFormInput = z.input<typeof formSchema>;
type MailboxFormValues = z.output<typeof formSchema>;

interface MailboxListProps {
    mailboxes: Mailbox[];
    onRefresh: () => void;
}

export function MailboxList({ mailboxes, onRefresh }: MailboxListProps) {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [actionId, setActionId] = useState<string | null>(null);

    const form = useForm<MailboxFormInput, unknown, MailboxFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            email: "",
            smtpHost: "smtp.gmail.com",
            smtpPort: 587,
            smtpUser: "",
            smtpPass: "",
            dailyLimit: 50,
        },
    });

    const onSubmit = async (values: MailboxFormValues) => {
        setLoading(true);
        try {
            await integrationsApi.createMailbox(values);
            toast({ title: "Caixa de entrada adicionada." });
            setOpen(false);
            form.reset();
            onRefresh();
        } catch (error) {
            toast({
                title: "Erro ao adicionar",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja remover esta caixa?")) {
            return;
        }

        try {
            await integrationsApi.deleteMailbox(id);
            toast({ title: "Caixa removida." });
            onRefresh();
        } catch (error) {
            toast({
                title: "Erro ao remover",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        }
    };

    const handleToggleActive = async (mailbox: Mailbox) => {
        try {
            setActionId(mailbox.id);
            await integrationsApi.updateMailbox(mailbox.id, { isActive: !mailbox.isActive });
            toast({
                title: mailbox.isActive ? "Caixa desativada" : "Caixa ativada",
            });
            onRefresh();
        } catch (error) {
            toast({
                title: "Erro ao atualizar status",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        } finally {
            setActionId(null);
        }
    };

    const handleTest = async (mailbox: Mailbox) => {
        try {
            setActionId(mailbox.id);
            await integrationsApi.testMailbox(mailbox.id);
            toast({ title: "Teste de caixa executado" });
        } catch (error) {
            toast({
                title: "Erro ao testar caixa",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        } finally {
            setActionId(null);
        }
    };

    const handleWarmup = async (mailbox: Mailbox) => {
        try {
            setActionId(mailbox.id);
            await integrationsApi.advanceMailboxWarmup(mailbox.id);
            toast({ title: "Warmup avancado com sucesso" });
            onRefresh();
        } catch (error) {
            toast({
                title: "Erro ao avancar warmup",
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
                    <h3 className="text-lg font-medium">Contas de Email</h3>
                    <p className="text-sm text-muted-foreground">
                        Configure as contas usadas para envio das sequencias.
                    </p>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <IconPlus className="mr-2 h-4 w-4" />
                            Adicionar Email
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Adicionar nova conta</DialogTitle>
                            <DialogDescription>
                                Configure as credenciais SMTP/IMAP do seu provedor.
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Nome identificador</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Ex: Joao Vendas" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Endereco de email</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="joao@empresa.com" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="smtpHost"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Host SMTP</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="smtpPort"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Porta SMTP</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        name={field.name}
                                                        ref={field.ref}
                                                        value={typeof field.value === "number" ? field.value : ""}
                                                        onBlur={field.onBlur}
                                                        onChange={(event) =>
                                                            field.onChange(event.target.value)
                                                        }
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="smtpUser"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Usuario SMTP</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="smtpPass"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Senha SMTP</FormLabel>
                                                <FormControl>
                                                    <Input type="password" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="dailyLimit"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Limite diario de envios</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    name={field.name}
                                                    ref={field.ref}
                                                    value={typeof field.value === "number" ? field.value : ""}
                                                    onBlur={field.onBlur}
                                                    onChange={(event) =>
                                                        field.onChange(event.target.value)
                                                    }
                                                />
                                            </FormControl>
                                            <FormDescription>
                                                Limite de seguranca para evitar bloqueios.
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <DialogFooter>
                                    <Button type="submit" disabled={loading}>
                                        {loading ? "Salvando..." : "Salvar configuracao"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="rounded-md border overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>SMTP</TableHead>
                            <TableHead>Limite</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Acoes</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mailboxes.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    Nenhum email configurado.
                                </TableCell>
                            </TableRow>
                        )}
                        {mailboxes.map((mailbox) => (
                            <TableRow key={mailbox.id}>
                                <TableCell className="font-medium">{mailbox.name}</TableCell>
                                <TableCell>{mailbox.email}</TableCell>
                                <TableCell>{mailbox.smtpHost}:{mailbox.smtpPort}</TableCell>
                                <TableCell>{mailbox.dailyLimit}/dia</TableCell>
                                <TableCell>
                                    {mailbox.isActive ? (
                                        <Badge
                                            variant="outline"
                                            className="border-green-200 bg-green-50 text-green-700"
                                        >
                                            <IconCheck className="mr-1 h-3 w-3" />
                                            Ativo
                                        </Badge>
                                    ) : (
                                        <Badge variant="secondary">Inativo</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleTest(mailbox)}
                                            disabled={actionId === mailbox.id}
                                        >
                                            Testar
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleWarmup(mailbox)}
                                            disabled={actionId === mailbox.id}
                                        >
                                            Warmup +1
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleToggleActive(mailbox)}
                                            disabled={actionId === mailbox.id}
                                        >
                                            {mailbox.isActive ? "Desativar" : "Ativar"}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                            onClick={() => handleDelete(mailbox.id)}
                                        >
                                            <IconTrash className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
