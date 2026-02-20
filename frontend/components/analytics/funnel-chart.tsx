import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FunnelStage } from "@/lib/analytics-api";

interface FunnelChartProps {
    stages: FunnelStage[];
}

export function FunnelChart({ stages }: FunnelChartProps) {
    const maxValue = stages.reduce((max, stage) => Math.max(max, stage.value), 0);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Funil de conversao</CardTitle>
            </CardHeader>
            <CardContent>
                {stages.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Sem dados de funil.</div>
                ) : (
                    <div className="space-y-3">
                        {stages.map((stage) => {
                            const width = maxValue > 0 ? (stage.value / maxValue) * 100 : 0;
                            return (
                                <div key={stage.id} className="space-y-1">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-medium">{stage.label}</span>
                                        <span>
                                            {stage.value} ({stage.pctOfCaptured.toFixed(1)}%)
                                        </span>
                                    </div>
                                    <div className="h-2.5 rounded bg-muted">
                                        <div
                                            className="h-2.5 rounded bg-blue-600"
                                            style={{ width: `${Math.max(3, width)}%` }}
                                        />
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        Conversao da etapa anterior: {stage.pctFromPrevious.toFixed(1)}%
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
