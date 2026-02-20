"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { campaignsApi, Campaign } from "@/lib/campaigns-api";

export default function CampaignEditPage() {
    const params = useParams<{ id: string | string[] }>();
    const campaignId = Array.isArray(params.id) ? params.id[0] : params.id;
    const router = useRouter();
    const [campaign, setCampaign] = useState<Campaign | null>(null);

    useEffect(() => {
        if (!campaignId) {
            return;
        }
        const load = async () => {
            try {
                const data = await campaignsApi.getById(campaignId);
                setCampaign(data);
            } catch (error) {
                console.error(error);
            }
        };
        load();
    }, [campaignId]);

    return (
        <AppLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold">Editar Campanha</h1>
                    <Button variant="outline" onClick={() => router.push(`/campaigns/${campaignId}`)}>
                        Voltar
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>{campaign?.name || "Carregando..."}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-muted-foreground">
                            A edição avançada de campanhas (steps, audiência e agendamento) estará disponível em breve.
                        </p>
                        <Button onClick={() => router.push(`/campaigns/new?clone=${campaignId}`)}>
                            Duplicar e editar
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
