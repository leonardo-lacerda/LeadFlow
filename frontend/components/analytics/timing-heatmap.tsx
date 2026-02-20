import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimingHeatmapResponse } from "@/lib/analytics-api";
import { cn } from "@/lib/utils";

interface TimingHeatmapProps {
    data: TimingHeatmapResponse;
}

function hourLabel(hour: number) {
    return `${String(hour).padStart(2, "0")}h`;
}

export function TimingHeatmap({ data }: TimingHeatmapProps) {
    const cellMap = new Map(
        data.cells.map((cell) => [`${cell.industry}|${cell.hour}`, cell] as const)
    );

    const hours = data.hours;
    const industries = data.industries;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Melhor horario por segmento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {industries.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Sem dados de horario.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px] border-collapse text-xs">
                            <thead>
                                <tr>
                                    <th className="sticky left-0 bg-card px-2 py-2 text-left font-semibold">
                                        Segmento
                                    </th>
                                    {hours.map((hour) => (
                                        <th key={hour} className="px-1 py-2 text-center font-medium">
                                            {hourLabel(hour)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {industries.map((industry) => (
                                    <tr key={industry} className="border-t">
                                        <td className="sticky left-0 bg-card px-2 py-2 font-medium">
                                            {industry}
                                        </td>
                                        {hours.map((hour) => {
                                            const cell = cellMap.get(`${industry}|${hour}`);
                                            const strength = Math.min(
                                                1,
                                                (cell?.weightedScore ?? cell?.replyRate ?? 0) / 100
                                            );
                                            return (
                                                <td key={`${industry}-${hour}`} className="px-1 py-1">
                                                    <div
                                                        className={cn(
                                                            "flex h-7 items-center justify-center rounded border text-[10px]"
                                                        )}
                                                        style={{
                                                            backgroundColor: `rgba(16, 185, 129, ${0.08 + strength * 0.55})`,
                                                        }}
                                                        title={
                                                            cell
                                                                ? `${industry} ${hourLabel(hour)} | score ${(
                                                                      cell.weightedScore || 0
                                                                  ).toFixed(1)} | ${cell.replyRate.toFixed(
                                                                      1
                                                                  )}% reply`
                                                                : `${industry} ${hourLabel(hour)}`
                                                        }
                                                    >
                                                        {cell ? `${(cell.weightedScore || 0).toFixed(0)}` : "-"}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {data.bestWindows.length > 0 && (
                    <div className="rounded-md border p-3">
                        <div className="mb-2 text-sm font-semibold">Janelas com melhor resposta</div>
                        {data.weights ? (
                            <div className="mb-2 text-[11px] text-muted-foreground">
                                Pesos: reply {Math.round(data.weights.replyRate * 100)}% | open{" "}
                                {Math.round(data.weights.openRate * 100)}% | volume{" "}
                                {Math.round(data.weights.volume * 100)}%
                            </div>
                        ) : null}
                        <div className="grid gap-1 text-xs text-muted-foreground md:grid-cols-2">
                            {data.bestWindows.slice(0, 6).map((window, index) => (
                                <div key={`${window.industry}-${window.hour}-${index}`}>
                                    {window.industry} {hourLabel(window.hour)}:{" "}
                                    score {(window.weightedScore || 0).toFixed(1)} |{" "}
                                    {window.replyRate.toFixed(1)}% reply ({window.sent} envios)
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
