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

    const limits = {
        signals: 100000,
        prospects: 2000,
        emailSignals: 50000,
        whatsappSignals: 20000,
    };

    const usage = {
        prospects: org.leadsUsed || 0,
        emailSignals: org.emailsUsed || 0,
        whatsappSignals: org.whatsappUsed || 0,
        enrichments: org.enrichmentsUsed || 0,
    };

    const totalSignals = usage.emailSignals + usage.whatsappSignals + usage.enrichments;

    const getPercentage = (used: number, limit: number) =>
        Math.min(100, Math.round((used / limit) * 100));

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Billing and Plan</h3>
                <p className="text-sm text-muted-foreground">
                    Seu plano e medido por sinais consumidos e volume de operacao.
                </p>
            </div>
            <Separator />

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-primary/20 bg-primary/5">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle>Plano atual: {org.plan}</CardTitle>
                                <CardDescription>Renovacao estimada em 01/03/2026</CardDescription>
                            </div>
                            <Badge variant="default" className="bg-primary">Ativo</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Sinais consumidos</span>
                                <span className="font-medium">{totalSignals} / {limits.signals}</span>
                            </div>
                            <Progress value={getPercentage(totalSignals, limits.signals)} className="h-2" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Prospects ativos</span>
                                <span className="font-medium">{usage.prospects} / {limits.prospects}</span>
                            </div>
                            <Progress value={getPercentage(usage.prospects, limits.prospects)} className="h-2" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Signals de email</span>
                                <span className="font-medium">{usage.emailSignals} / {limits.emailSignals}</span>
                            </div>
                            <Progress value={getPercentage(usage.emailSignals, limits.emailSignals)} className="h-2" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Signals de WhatsApp</span>
                                <span className="font-medium">{usage.whatsappSignals} / {limits.whatsappSignals}</span>
                            </div>
                            <Progress value={getPercentage(usage.whatsappSignals, limits.whatsappSignals)} className="h-2" />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full">Upgrade para mais sinais</Button>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Metodo de pagamento</CardTitle>
                        <CardDescription>Cartoes salvos no provedor de pagamento.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center space-x-4 p-4 border rounded-md">
                            <div className="h-8 w-12 bg-gray-200 rounded flex items-center justify-center text-xs font-bold">
                                VISA
                            </div>
                            <div className="flex-1">
                                <p className="font-medium">Final 4242</p>
                                <p className="text-sm text-muted-foreground">Expira em 12/28</p>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button variant="outline" className="w-full">Adicionar cartao</Button>
                    </CardFooter>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Historico de faturas</CardTitle>
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
