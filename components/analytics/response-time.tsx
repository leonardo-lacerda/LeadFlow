import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponseTimeResponse } from "@/lib/analytics-api";

interface ResponseTimeProps {
    data: ResponseTimeResponse;
}

function formatDuration(seconds: number) {
    if (seconds >= 3600) {
        return `${(seconds / 3600).toFixed(1)}h`;
    }
    if (seconds >= 60) {
        return `${Math.round(seconds / 60)}m`;
    }
    return `${seconds}s`;
}

export function ResponseTimeMetric({ data }: ResponseTimeProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Tempo medio ate resposta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">Media</div>
                        <div className="text-xl font-semibold">
                            {formatDuration(data.summary.avgSeconds)}
                        </div>
                    </div>
                    <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">Mediana</div>
                        <div className="text-xl font-semibold">
                            {formatDuration(data.summary.medianSeconds)}
                        </div>
                    </div>
                    <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">P75</div>
                        <div className="text-xl font-semibold">
                            {formatDuration(data.summary.p75Seconds)}
                        </div>
                    </div>
                    <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">Amostras</div>
                        <div className="text-xl font-semibold">{data.summary.count}</div>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="text-sm font-semibold">Por canal</div>
                    {data.byChannel.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                            Sem amostras com resposta.
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {data.byChannel.map((item) => (
                                <div
                                    key={item.channel}
                                    className="flex items-center justify-between rounded border px-3 py-2 text-sm"
                                >
                                    <span>{item.channel}</span>
                                    <span className="font-medium">{formatDuration(item.avgSeconds)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
