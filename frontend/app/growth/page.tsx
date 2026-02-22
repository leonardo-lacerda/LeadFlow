"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { distributionApi } from "@/lib/distribution-api";
import { growthApi } from "@/lib/growth-api";

export default function GrowthPage() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ["growth", "integration-status"],
    queryFn: () => growthApi.getIntegrationStatus(),
  });

  const draftsQuery = useQuery({
    queryKey: ["growth", "drafts"],
    queryFn: () => distributionApi.list({ page: 1, limit: 20, status: "APPROVED" }),
  });

  const publishTwitterMutation = useMutation({
    mutationFn: (input: { content: string; draftId?: string }) => growthApi.publishTwitter(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["growth", "drafts"] });
      await queryClient.invalidateQueries({ queryKey: ["distribution", "drafts"] });
    },
  });

  const publishLinkedinMutation = useMutation({
    mutationFn: (input: { content: string; draftId?: string }) => growthApi.publishLinkedin(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["growth", "drafts"] });
      await queryClient.invalidateQueries({ queryKey: ["distribution", "drafts"] });
    },
  });

  const approvedDrafts = draftsQuery.data?.items || [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Growth Loop</h1>
          <p className="text-muted-foreground">Publique drafts em canais sociais e acompanhe os resultados.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Conexoes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Twitter: {statusQuery.data?.twitterConnected ? "Conectado" : "Nao conectado"}</p>
              <p>LinkedIn: {statusQuery.data?.linkedinConnected ? "Conectado" : "Nao conectado"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Fila de publicacao</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{approvedDrafts.length}</p>
              <p className="text-sm text-muted-foreground">Drafts aprovados prontos para distribuir</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Publicacao rapida</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {approvedDrafts.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum draft aprovado no momento.</p>
            )}
            {approvedDrafts.map((draft) => {
              const content = draft.editedContent || draft.content;
              return (
                <div key={draft.id} className="rounded border p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {draft.format} - {draft.id}
                  </p>
                  <Input readOnly value={content.slice(0, 220)} />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => publishTwitterMutation.mutate({ draftId: draft.id, content })}
                      disabled={publishTwitterMutation.isPending}
                    >
                      Publicar no Twitter
                    </Button>
                    <Button
                      onClick={() => publishLinkedinMutation.mutate({ draftId: draft.id, content })}
                      disabled={publishLinkedinMutation.isPending}
                    >
                      Publicar no LinkedIn
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
