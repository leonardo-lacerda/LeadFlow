"use client";

import { useCallback, useEffect, useState } from "react";
import { organizationApi, Organization, User } from "@/lib/organization-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { IconLoader, IconPlus, IconTrash } from "@tabler/icons-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function TeamPage() {
    const { toast } = useToast();
    const [org, setOrg] = useState<Organization | null>(null);
    const [loading, setLoading] = useState(true);
    const [inviteOpen, setInviteOpen] = useState(false);

    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
    const [inviting, setInviting] = useState(false);

    const loadOrganization = useCallback(async () => {
        try {
            const data = await organizationApi.getOrganization();
            setOrg(data);
        } catch (error) {
            console.error(error);
            toast({
                title: "Erro ao carregar equipe",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        void loadOrganization();
    }, [loadOrganization]);

    const handleInvite = async () => {
        if (!inviteEmail) {
            return;
        }

        setInviting(true);
        try {
            const invite = await organizationApi.inviteUser({
                email: inviteEmail,
                role: inviteRole,
            });
            toast({
                title: "Convite gerado com sucesso",
                description: `Link: ${invite.inviteUrl}`,
            });
            setInviteOpen(false);
            setInviteEmail("");
            await loadOrganization();
        } catch (error) {
            toast({
                title: "Erro ao convidar",
                description: error instanceof Error ? error.message : "Erro desconhecido",
                variant: "destructive",
            });
        } finally {
            setInviting(false);
        }
    };

    const handleRemoveUser = async (user: User) => {
        if (!confirm(`Tem certeza que deseja remover ${user.name}?`)) {
            return;
        }

        try {
            await organizationApi.removeUser(user.id);
            toast({ title: "Usuario removido com sucesso" });
            await loadOrganization();
        } catch (error) {
            toast({
                title: "Erro ao remover usuario",
                description: error instanceof Error ? error.message : "Erro desconhecido",
                variant: "destructive",
            });
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <IconLoader className="animate-spin h-6 w-6 text-muted-foreground" />
            </div>
        );
    }

    if (!org) {
        return null;
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Equipe Go-to-Market</h3>
                <p className="text-sm text-muted-foreground">
                    Gerencie quem pode operar sequencias, canais e configuracoes de sinais.
                </p>
            </div>
            <Separator />

            <div className="flex justify-end">
                <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <IconPlus className="mr-2 h-4 w-4" />
                            Convidar integrante
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Convidar integrante</DialogTitle>
                            <DialogDescription>
                                Gere um link de convite para adicionar um novo membro.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    placeholder="email@exemplo.com"
                                    value={inviteEmail}
                                    onChange={(event) => setInviteEmail(event.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="role">Funcao</Label>
                                <Select
                                    value={inviteRole}
                                    onValueChange={(value) => setInviteRole(value as "ADMIN" | "MEMBER")}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione uma funcao" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MEMBER">Membro</SelectItem>
                                        <SelectItem value="ADMIN">Administrador</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setInviteOpen(false)}>
                                Cancelar
                            </Button>
                            <Button onClick={handleInvite} disabled={inviting}>
                                {inviting ? "Enviando..." : "Gerar convite"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Membros ({org.users.length})</CardTitle>
                    <CardDescription>Lista de usuarios com acesso a organizacao.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome / Email</TableHead>
                                <TableHead>Funcao</TableHead>
                                <TableHead>Entrou em</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {org.users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{user.name}</span>
                                            <span className="text-xs text-muted-foreground">{user.email}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={user.role === "OWNER" ? "default" : "secondary"}>
                                            {user.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {format(new Date(user.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {user.role !== "OWNER" && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => handleRemoveUser(user)}
                                            >
                                                <IconTrash className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

