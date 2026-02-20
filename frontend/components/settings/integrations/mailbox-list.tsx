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
import { IconPlus, IconTrash, IconCheck } from "@tabler/icons-react";

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
            toast({ title: "Caixa de entrada adicionada!" });
            setOpen(false);
            form.reset();
            onRefresh();
        } catch (error) {
            console.error(error);
            toast({
                title: "Erro ao adicionar",
                description: error instanceof Error ? error.message : "Erro desconhecido",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja remover esta caixa?")) return;
        try {
            await integrationsApi.deleteMailbox(id);
            toast({ title: "Caixa removida!" });
            onRefresh();
        } catch (error) {
            console.error(error);
            toast({
                title: "Erro ao remover",
                variant: "destructive",
            });
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium">Contas de Email</h3>
                    <p className="text-sm text-muted-foreground">
                        Configure as contas usadas para envio de sequences.
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
                            <DialogTitle>Adicionar Nova Conta</DialogTitle>
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
                                                <FormLabel>Nome Identificador</FormLabel>
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
                                                <FormLabel>Endereco de Email</FormLabel>
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
                                                <FormLabel>SMTP Host</FormLabel>
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
                                                <FormLabel>SMTP Port</FormLabel>
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
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="smtpUser"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>SMTP User</FormLabel>
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
                                                <FormLabel>SMTP Password</FormLabel>
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
                                            <FormLabel>Limite Diario de Envios</FormLabel>
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
                                            <FormDescription>
                                                Limite de seguranca para evitar bloqueios.
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <DialogFooter>
                                    <Button type="submit" disabled={loading}>
                                        {loading ? "Salvando..." : "Salvar Configuracao"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Host SMTP</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Acoes</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mailboxes.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                    Nenhum email configurado.
                                </TableCell>
                            </TableRow>
                        )}
                        {mailboxes.map((mailbox) => (
                            <TableRow key={mailbox.id}>
                                <TableCell className="font-medium">{mailbox.name}</TableCell>
                                <TableCell>{mailbox.email}</TableCell>
                                <TableCell>{mailbox.smtpHost}:{mailbox.smtpPort}</TableCell>
                                <TableCell>
                                    {mailbox.isActive ? (
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                            <IconCheck className="w-3 h-3 mr-1" /> Ativo
                                        </Badge>
                                    ) : (
                                        <Badge variant="secondary">Inativo</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => handleDelete(mailbox.id)}
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


