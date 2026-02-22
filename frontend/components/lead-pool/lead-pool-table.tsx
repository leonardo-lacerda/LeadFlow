import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SharedLeadItem } from "@/lib/lead-pool-api";

interface LeadPoolTableProps {
    items: SharedLeadItem[];
    loading?: boolean;
    claimingId?: string | null;
    onClaim: (item: SharedLeadItem) => void;
    onClaimAndCreateCampaign: (item: SharedLeadItem) => void;
}

export function LeadPoolTable({
    items,
    loading,
    claimingId,
    onClaim,
    onClaimAndCreateCampaign,
}: LeadPoolTableProps) {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Empresa/Lead</TableHead>
                        <TableHead>Cidade</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Fonte</TableHead>
                        <TableHead>Qualidade</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                Carregando leads compartilhados...
                            </TableCell>
                        </TableRow>
                    ) : items.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                Nenhum lead encontrado com os filtros atuais.
                            </TableCell>
                        </TableRow>
                    ) : (
                        items.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>
                                    <div className="font-medium">{item.companyName || item.fullName || "Lead sem nome"}</div>
                                    <div className="text-xs text-muted-foreground">{item.email || item.phone || "-"}</div>
                                </TableCell>
                                <TableCell>{[item.city, item.state].filter(Boolean).join(", ") || "-"}</TableCell>
                                <TableCell>{item.category || "-"}</TableCell>
                                <TableCell>{item.source}</TableCell>
                                <TableCell>{Math.round(item.quality)}</TableCell>
                                <TableCell>
                                    {item.claimed ? (
                                        <Badge variant="outline">Claimed</Badge>
                                    ) : (
                                        <Badge variant="secondary">Disponivel</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        {item.claimed && item.claimedLeadId ? (
                                            <Button asChild variant="outline" size="sm">
                                                <Link href={`/leads/${item.claimedLeadId}`}>Abrir Lead</Link>
                                            </Button>
                                        ) : (
                                            <>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => onClaim(item)}
                                                    disabled={claimingId === item.id}
                                                >
                                                    {claimingId === item.id ? "Claim..." : "Claim"}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={() => onClaimAndCreateCampaign(item)}
                                                    disabled={claimingId === item.id}
                                                >
                                                    Claim + Sequencia
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
