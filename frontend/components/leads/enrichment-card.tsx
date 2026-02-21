import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Lead } from "@/lib/leads-api";

interface EnrichmentCardProps {
    lead: Lead;
}

const maturityLabel: Record<string, string> = {
    EARLY_STAGE: "Early Stage",
    GROWING: "Growing",
    ESTABLISHED: "Established",
    ENTERPRISE: "Enterprise",
};

function toPercent(value: number, total: number) {
    if (total <= 0) {
        return 0;
    }
    return Math.round((value / total) * 100);
}

export function EnrichmentCard({ lead }: EnrichmentCardProps) {
    const level1Signals = [
        Boolean(lead.email),
        Boolean(lead.phone || lead.whatsapp),
        Boolean(lead.linkedinUrl),
    ];
    const level2Signals = [
        Boolean(lead.companyCnpj),
        Boolean(lead.companySize || lead.companyEmployees),
        Boolean(lead.companyRevenue),
        Boolean(lead.industry),
    ];
    const level3Signals = [
        (lead.technologies || []).length > 0,
        Boolean(lead.maturityLevel),
    ];
    const level4Signals = [
        typeof lead.icpMatch === "number",
        (lead.icpReasons || []).length > 0,
    ];

    const level1 = toPercent(level1Signals.filter(Boolean).length, level1Signals.length);
    const level2 = toPercent(level2Signals.filter(Boolean).length, level2Signals.length);
    const level3 = toPercent(level3Signals.filter(Boolean).length, level3Signals.length);
    const level4 = toPercent(level4Signals.filter(Boolean).length, level4Signals.length);

    const overall = Math.round((level1 + level2 + level3 + level4) / 4);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Enrichment Inteligente</CardTitle>
                <CardDescription>
                    Progresso dos 4 niveis de enriquecimento e classificacao ICP.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                        <span>Progresso Geral</span>
                        <span className="font-medium">{overall}%</span>
                    </div>
                    <Progress value={overall} />
                </div>

                <div className="space-y-3">
                    <div>
                        <div className="mb-1 flex items-center justify-between text-sm">
                            <span>Nivel 1: Dados Basicos</span>
                            <span>{level1}%</span>
                        </div>
                        <Progress value={level1} />
                    </div>
                    <div>
                        <div className="mb-1 flex items-center justify-between text-sm">
                            <span>Nivel 2: Empresa</span>
                            <span>{level2}%</span>
                        </div>
                        <Progress value={level2} />
                    </div>
                    <div>
                        <div className="mb-1 flex items-center justify-between text-sm">
                            <span>Nivel 3: Inteligencia</span>
                            <span>{level3}%</span>
                        </div>
                        <Progress value={level3} />
                    </div>
                    <div>
                        <div className="mb-1 flex items-center justify-between text-sm">
                            <span>Nivel 4: ICP</span>
                            <span>{level4}%</span>
                        </div>
                        <Progress value={level4} />
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {lead.maturityLevel && (
                        <Badge variant="outline">
                            Maturidade: {maturityLabel[lead.maturityLevel] || lead.maturityLevel}
                        </Badge>
                    )}
                    {typeof lead.icpMatch === "number" && (
                        <Badge variant="outline">Aderencia ICP: {Math.round(lead.icpMatch * 100)}%</Badge>
                    )}
                    {(lead.technologies || []).slice(0, 4).map((tech) => (
                        <Badge key={tech} variant="secondary">
                            {tech}
                        </Badge>
                    ))}
                </div>

                {(lead.icpReasons || []).length > 0 && (
                    <div className="rounded-md border p-3 text-sm">
                        <p className="mb-2 font-medium">Razoes de Match ICP</p>
                        <div className="flex flex-wrap gap-2">
                            {lead.icpReasons?.map((reason) => (
                                <Badge key={reason} variant="secondary">
                                    {reason}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

