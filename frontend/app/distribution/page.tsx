"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { distributionApi, DraftFormat, DraftStatus } from "@/lib/distribution-api";
import { signalsApi } from "@/lib/signals-api";

const FORMAT_OPTIONS: DraftFormat[] = ["TWEET", "THREAD", "CHART", "MICRO_CASE", "INSIGHT"];

export default function DistributionPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"ALL" | DraftStatus>("ALL");
  const [format, setFormat] = useState<"ALL" | DraftFormat>("ALL");
  const [selectedSignalId, setSelectedSignalId] = useState("");

  const draftsQuery = useQuery({
    queryKey: ["distribution", "drafts", page, status, format],
    queryFn: () =>
      distributionApi.list({
        page,
        limit: 12,
        status: status === "ALL" ? undefined : status,
        format: format === "ALL" ? undefined : format,
      }),
  });

  const signalsQuery = useQuery({
    queryKey: ["signals", "for-distribution"],
    queryFn: () => signalsApi.listSignals({ page: 1, limit: 40, minConfidence: 40 }),
  });

  const generateMutation = useMutation({
    mutationFn: (input: { signalId: string; formats?: DraftFormat[] }) => distributionApi.generate(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["distribution", "drafts"] });
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => distributionApi.publish(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["distribution", "drafts"] });
    },
  });

  const signals = useMemo(() => signalsQuery.data?.items ?? [], [signalsQuery.data?.items]);
  const selectedSignal = useMemo(
    () => signals.find((signal) => signal.id === selectedSignalId),
    [signals, selectedSignalId]
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Distribution Engine</h1>
            <p className="text-muted-foreground">Transforme sinais em conteudos prontos para publicacao.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Gerar drafts por sinal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Select value={selectedSignalId} onValueChange={setSelectedSignalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um sinal" />
                </SelectTrigger>
                <SelectContent>
                  {signals.map((signal) => (
                    <SelectItem key={signal.id} value={signal.id}>
                      {signal.type} - {signal.confidence}% - {signal.insight.slice(0, 64)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() =>
                  selectedSignalId &&
                  generateMutation.mutate({
                    signalId: selectedSignalId,
                    formats: ["TWEET", "THREAD", "INSIGHT"],
                  })
                }
                disabled={!selectedSignalId || generateMutation.isPending}
              >
                {generateMutation.isPending ? "Gerando..." : "Gerar drafts"}
              </Button>
            </div>
            {selectedSignal && (
              <div className="rounded border p-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Insight selecionado</p>
                <p>{selectedSignal.insight}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value as "ALL" | DraftStatus);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos status</SelectItem>
                {["DRAFT", "APPROVED", "PUBLISHED", "ARCHIVED"].map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={format}
              onValueChange={(value) => {
                setFormat(value as "ALL" | DraftFormat);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Formato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos formatos</SelectItem>
                {FORMAT_OPTIONS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input value={String(draftsQuery.data?.meta.total || 0)} readOnly className="font-semibold" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Drafts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Formato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Plataforma</TableHead>
                    <TableHead>Conteudo</TableHead>
                    <TableHead>Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draftsQuery.isLoading && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        Carregando drafts...
                      </TableCell>
                    </TableRow>
                  )}
                  {!draftsQuery.isLoading && (draftsQuery.data?.items || []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        Nenhum draft encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                  {(draftsQuery.data?.items || []).map((draft) => (
                    <TableRow key={draft.id}>
                      <TableCell>{draft.format}</TableCell>
                      <TableCell>{draft.status}</TableCell>
                      <TableCell>{draft.platform || "-"}</TableCell>
                      <TableCell className="max-w-[420px] truncate">{draft.editedContent || draft.content}</TableCell>
                      <TableCell className="space-x-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/distribution/${draft.id}`}>Abrir</Link>
                        </Button>
                        {draft.status !== "PUBLISHED" && (
                          <Button
                            size="sm"
                            onClick={() => publishMutation.mutate(draft.id)}
                            disabled={publishMutation.isPending}
                          >
                            Publicar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {draftsQuery.data?.meta.totalPages && draftsQuery.data.meta.totalPages > 1 && (
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= draftsQuery.data.meta.totalPages}
                  onClick={() => setPage((prev) => prev + 1)}
                >
                  Proxima
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
