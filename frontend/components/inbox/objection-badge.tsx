import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { InboxObjection } from "@/lib/inbox-api";

const objectionConfig: Record<
    InboxObjection["type"],
    { label: string; className: string }
> = {
    PRICE: {
        label: "Preco",
        className: "border-rose-200 bg-rose-50 text-rose-700",
    },
    TIMING: {
        label: "Timing",
        className: "border-amber-200 bg-amber-50 text-amber-700",
    },
    AUTHORITY: {
        label: "Decisao",
        className: "border-orange-200 bg-orange-50 text-orange-700",
    },
    COMPETITOR: {
        label: "Concorrente",
        className: "border-violet-200 bg-violet-50 text-violet-700",
    },
    NO_INTEREST: {
        label: "Sem interesse",
        className: "border-slate-300 bg-slate-100 text-slate-700",
    },
    TRUST: {
        label: "Confianca",
        className: "border-sky-200 bg-sky-50 text-sky-700",
    },
    OTHER: {
        label: "Outro",
        className: "border-zinc-300 bg-zinc-100 text-zinc-700",
    },
};

interface ObjectionBadgeProps {
    objection: InboxObjection | null;
    className?: string;
}

export function ObjectionBadge({ objection, className }: ObjectionBadgeProps) {
    if (!objection) {
        return null;
    }

    const config = objectionConfig[objection.type];

    return (
        <Badge
            variant="outline"
            className={cn("inline-flex items-center gap-1.5", config.className, className)}
        >
            Objecao: {config.label} ({Math.round(objection.confidence * 100)}%)
        </Badge>
    );
}
