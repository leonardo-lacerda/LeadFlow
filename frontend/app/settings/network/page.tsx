"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { organizationApi } from "@/lib/organization-api";
import { networkApi } from "@/lib/network-api";

export default function NetworkSettingsPage() {
  const queryClient = useQueryClient();

  const orgQuery = useQuery({
    queryKey: ["organization", "network-settings"],
    queryFn: () => organizationApi.getOrganization(),
  });

  const statsQuery = useQuery({
    queryKey: ["network", "stats", "settings"],
    queryFn: () => networkApi.getStats(),
  });

  const updateMutation = useMutation({
    mutationFn: (networkOptIn: boolean) => organizationApi.updateOrganization({ networkOptIn }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["organization"] }),
        queryClient.invalidateQueries({ queryKey: ["network"] }),
      ]);
    },
  });

  const networkOptIn = Boolean(orgQuery.data?.networkOptIn);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Network Layer</h3>
        <p className="text-sm text-muted-foreground">
          Compartilhe sinais anonimizados com a rede para melhorar benchmarks e recomendacoes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Opt-in de rede</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-4">
            <div>
              <Label htmlFor="network-optin">Participar da rede anonima</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Nunca compartilhamos nomes, emails, mensagens ou identificacao da sua organizacao.
              </p>
            </div>
            <Switch
              id="network-optin"
              checked={networkOptIn}
              onCheckedChange={(checked) => updateMutation.mutate(checked)}
              disabled={orgQuery.isLoading || updateMutation.isPending}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <div className="rounded border p-3">
              <p className="text-muted-foreground">Organizacoes opt-in</p>
              <p className="text-xl font-semibold">{statsQuery.data?.optedInOrganizations || 0}</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-muted-foreground">Shared leads capturados</p>
              <p className="text-xl font-semibold">{statsQuery.data?.claimedSharedLeads || 0}</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-muted-foreground">Drafts publicados</p>
              <p className="text-xl font-semibold">{statsQuery.data?.publishedDrafts || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
