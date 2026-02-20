"use client";

import { useCallback, useEffect, useState } from "react";
import { organizationApi, Organization } from "@/lib/organization-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { IconLoader } from "@tabler/icons-react";

export default function OrganizationPage() {
    const { toast } = useToast();
    const [org, setOrg] = useState<Organization | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState("");

    const loadOrganization = useCallback(async () => {
        try {
            const data = await organizationApi.getOrganization();
            setOrg(data);
            setName(data.name);
        } catch (error) {
            console.error(error);
            toast({
                title: "Erro ao carregar organization",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        void loadOrganization();
    }, [loadOrganization]);

    const handleSave = async () => {
        if (!name.trim()) {
            return;
        }

        setSaving(true);
        try {
            await organizationApi.updateOrganization({ name });
            toast({ title: "Organization atualizada" });
            await loadOrganization();
        } catch (error) {
            toast({
                title: "Erro ao atualizar",
                description: error instanceof Error ? error.message : "Erro desconhecido",
                variant: "destructive",
            });
        } finally {
            setSaving(false);
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

    const sharedSignals = Math.max(320, (org.emailsUsed ?? 0) + (org.whatsappUsed ?? 0));

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Organization Profile</h3>
                <p className="text-sm text-muted-foreground">
                    Defina como sua empresa aparece na rede e acompanhe sua camada de sinais.
                </p>
            </div>
            <Separator />

            <Card>
                <CardHeader>
                    <CardTitle>Identity</CardTitle>
                    <CardDescription>Nome publico da sua empresa no sistema.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Nome da organization</Label>
                        <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
                    </div>
                </CardContent>
                <div className="flex items-center justify-end p-4 border-t">
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <IconLoader className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar alteracoes
                    </Button>
                </div>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Network Snapshot</CardTitle>
                    <CardDescription>
                        Prova social da sua participacao no modelo de aquisicao compartilhada.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-lg border p-4">
                        <p className="text-xs text-muted-foreground">Sinais compartilhados</p>
                        <p className="text-2xl font-semibold">{sharedSignals}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                        <p className="text-xs text-muted-foreground">Cohort ativo</p>
                        <p className="text-2xl font-semibold">SaaS B2B tecnico</p>
                    </div>
                    <div className="rounded-lg border p-4">
                        <p className="text-xs text-muted-foreground">Sinal de qualidade</p>
                        <p className="text-2xl font-semibold">Anonimizado</p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Plano atual</CardTitle>
                    <CardDescription>Informacoes sobre seu plano e limites.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-lg">{org.plan}</p>
                            <p className="text-sm text-muted-foreground">ID: {org.id}</p>
                        </div>
                        <Button variant="outline">Gerenciar assinatura</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
