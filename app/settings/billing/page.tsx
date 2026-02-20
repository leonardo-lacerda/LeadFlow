"use client";

import { useEffect, useState } from "react";
import { organizationApi, Organization } from "@/lib/organization-api";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { IconLoader } from "@tabler/icons-react";

export default function BillingPage() {
    const [org, setOrg] = useState<Organization | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        organizationApi.getOrganization().then(setOrg).finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <IconLoader className="animate-spin h-6 w-6 text-muted-foreground" />
            </div>
        );
    }

    if (!org) return null;

    // Simulate usage stats since backend might not be populating them fully yet
    // Assuming backend returns leadsUsed, etc.
    const limits = {
        leads: 1000,
        emails: 5000,
        whatsapp: 1000,
        enrichments: 500
    };

    // Fallbacks if backend fields are missing
    const usage = {
        leads: org.leadsUsed || 0,
        emails: org.emailsUsed || 0,
        whatsapp: org.whatsappUsed || 0,
        enrichments: org.enrichmentsUsed || 0
    };

    const getPercentage = (used: number, limit: number) => Math.min(100, Math.round((used / limit) * 100));

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Cobrança e Planos</h3>
                <p className="text-sm text-muted-foreground">
                    Gerencie sua assinatura, métodos de pagamento e faturas.
                </p>
            </div>
            <Separator />

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-primary/20 bg-primary/5">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle>Plano Atual: {org.plan}</CardTitle>
                                <CardDescription>Renova em 01/03/2026</CardDescription>
                            </div>
                            <Badge variant="default" className="bg-primary">Ativo</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Leads Gerados</span>
                                <span className="font-medium">{usage.leads} / {limits.leads}</span>
                            </div>
                            <Progress value={getPercentage(usage.leads, limits.leads)} className="h-2" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Emails Enviados</span>
                                <span className="font-medium">{usage.emails} / {limits.emails}</span>
                            </div>
                            <Progress value={getPercentage(usage.emails, limits.emails)} className="h-2" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Mensagens WhatsApp</span>
                                <span className="font-medium">{usage.whatsapp} / {limits.whatsapp}</span>
                            </div>
                            <Progress value={getPercentage(usage.whatsapp, limits.whatsapp)} className="h-2" />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full">Fazer Upgrade de Plano</Button>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Método de Pagamento</CardTitle>
                        <CardDescription>Seus cartões salvos no Stripe.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center space-x-4 p-4 border rounded-md">
                            <div className="h-8 w-12 bg-gray-200 rounded flex items-center justify-center text-xs font-bold">
                                VISA
                            </div>
                            <div className="flex-1">
                                <p className="font-medium">Terminado em 4242</p>
                                <p className="text-sm text-muted-foreground">Expira em 12/28</p>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button variant="outline" className="w-full">Adicionar Novo Cartão</Button>
                    </CardFooter>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Histórico de Faturas</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-sm text-muted-foreground text-center py-8">
                        Nenhuma fatura gerada ainda.
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
