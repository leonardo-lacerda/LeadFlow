import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { InboxFollowup } from "@/lib/inbox-api";
import { Flame, Timer } from "lucide-react";

interface HotLeadAlertProps {
    hotLead: boolean;
    leadName?: string;
    followup?: InboxFollowup | null;
    className?: string;
}

export function HotLeadAlert({
    hotLead,
    leadName,
    followup,
    className,
}: HotLeadAlertProps) {
    if (!hotLead) {
        return null;
    }

    const showOverdue = followup?.overdue === true;
    const firstName = (leadName || "").split(" ")[0] || "Prospect";

    return (
        <div
            className={cn(
                "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900",
                className
            )}
        >
            <div className="flex items-center gap-2 font-semibold">
                <Flame className="h-4 w-4" />
                Prospect quente ativo
                <Badge className="ml-1 border-red-300 bg-white text-red-800">HOT</Badge>
            </div>
            <div className="mt-1">
                {firstName} respondeu e exige prioridade de atendimento.
            </div>
            {followup && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                    <Timer className="h-3.5 w-3.5" />
                    {showOverdue
                        ? "Follow-up recomendado agora."
                        : `Regra de follow-up: ${followup.delayHours}h.`}
                </div>
            )}
        </div>
    );
}
