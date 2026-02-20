import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SourcePerformanceItem } from "@/lib/analytics-api";

interface SourceChartProps {
    items: SourcePerformanceItem[];
}

export function SourceChart({ items }: SourceChartProps) {
    const maxRate = items.reduce((max, item) => Math.max(max, item.replyRate), 0);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Performance por fonte</CardTitle>
            </CardHeader>
            <CardContent>
                {items.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Sem dados por fonte.</div>
                ) : (
                    <div className="space-y-3">
                        {items.map((item) => {
                            const width =
                                maxRate > 0 ? Math.max(4, (item.replyRate / maxRate) * 100) : 4;
                            return (
                                <div key={item.source} className="space-y-1">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-medium">{item.source}</span>
                                        <span className="text-muted-foreground">
                                            {item.replyRate.toFixed(1)}% reply
                                        </span>
                                    </div>
                                    <div className="h-2 w-full rounded bg-muted">
                                        <div
                                            className="h-2 rounded bg-emerald-500"
                                            style={{ width: `${width}%` }}
                                        />
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {item.repliedLeads}/{item.contactedLeads} responderam
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
