import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface LeadPoolStatsProps {
    sharedLeads: number;
    sharedLeads30d: number;
    orgClaims: number;
    claimedWithLead: number;
}

export function LeadPoolStats({
    sharedLeads,
    sharedLeads30d,
    orgClaims,
    claimedWithLead,
}: LeadPoolStatsProps) {
    return (
        <div className="grid gap-4 md:grid-cols-4">
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Leads Compartilhados</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">{sharedLeads}</CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Ultimos 30 dias</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">{sharedLeads30d}</CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Claims da Organizacao</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">{orgClaims}</CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Claims com Lead</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">{claimedWithLead}</CardContent>
            </Card>
        </div>
    );
}
