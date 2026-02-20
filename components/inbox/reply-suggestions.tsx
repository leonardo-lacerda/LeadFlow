import { InboxReplySuggestion } from "@/lib/inbox-api";
import { Sparkles } from "lucide-react";

interface ReplySuggestionsProps {
    suggestions: InboxReplySuggestion[];
    onUseSuggestion: (content: string) => void;
}

export function ReplySuggestions({
    suggestions,
    onUseSuggestion,
}: ReplySuggestionsProps) {
    if (!suggestions.length) {
        return null;
    }

    return (
        <div className="rounded-lg border bg-white p-3 dark:bg-neutral-900">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Sugestoes de resposta
            </div>

            <div className="space-y-2">
                {suggestions.map((suggestion, index) => (
                    <button
                        key={suggestion.id}
                        type="button"
                        onClick={() => onUseSuggestion(suggestion.content)}
                        className="w-full rounded-md border p-2 text-left transition-colors hover:bg-muted/40"
                    >
                        <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-muted-foreground">
                                [{index + 1}] {suggestion.label}
                            </span>
                            <span className="rounded border px-2 py-0.5 text-xs">Usar</span>
                        </div>
                        <p className="text-sm">{suggestion.content}</p>
                    </button>
                ))}
            </div>
        </div>
    );
}
