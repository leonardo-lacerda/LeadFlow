"use client";

import { useEffect, useState } from "react";
import { integrationsApi, Mailbox, WhatsappInstance } from "@/lib/integrations-api";
import { organizationApi } from "@/lib/organization-api";
import { MailboxList } from "@/components/settings/integrations/mailbox-list";
import { WhatsappList } from "@/components/settings/integrations/whatsapp-list";
import { ApiKeys } from "@/components/settings/integrations/api-keys";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IconLoader } from "@tabler/icons-react";

export default function IntegrationsPage() {
    const [loading, setLoading] = useState(true);
    const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
    const [instances, setInstances] = useState<WhatsappInstance[]>([]);
    const [apiKeys, setApiKeys] = useState<Record<string, string>>({});

    useEffect(() => {
        void loadAll();
    }, []);

    const loadAll = async () => {
        try {
            const [emailsData, whatsappData, orgData] = await Promise.all([
                integrationsApi.listMailboxes(),
                integrationsApi.listWhatsapp(),
                organizationApi.getOrganization(),
            ]);

            setMailboxes(emailsData);
            setInstances(whatsappData);
            setApiKeys(orgData.apiKeys || {});
        } catch (error) {
            console.error("Failed to load integrations", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <IconLoader className="animate-spin h-6 w-6 text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Canais e Provedores</h3>
                <p className="text-sm text-muted-foreground">
                    Gerencie os canais que alimentam seus sinais e servicos externos de enrichment.
                </p>
            </div>
            <Separator />

            <Tabs defaultValue="channels" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="channels">Canais de contato</TabsTrigger>
                    <TabsTrigger value="enrichment">Provedores de dados</TabsTrigger>
                </TabsList>

                <TabsContent value="channels" className="space-y-8">
                    <MailboxList mailboxes={mailboxes} onRefresh={loadAll} />
                    <Separator />
                    <WhatsappList instances={instances} onRefresh={loadAll} />
                </TabsContent>

                <TabsContent value="enrichment">
                    <ApiKeys initialKeys={apiKeys} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

