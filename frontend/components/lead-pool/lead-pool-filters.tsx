import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const leadPoolFiltersSchema = z.object({
    city: z.string().default(""),
    state: z.string().default(""),
    category: z.string().default(""),
    source: z.string().default(""),
    freshnessDays: z
        .string()
        .refine((value) => value === "" || (Number.isFinite(Number(value)) && Number(value) > 0), {
            message: "Use um numero positivo",
        }),
});

export type LeadPoolFiltersValue = z.infer<typeof leadPoolFiltersSchema>;
type LeadPoolFiltersFormInput = z.input<typeof leadPoolFiltersSchema>;
type LeadPoolFiltersFormOutput = z.output<typeof leadPoolFiltersSchema>;

interface LeadPoolFiltersProps {
    initialValue: LeadPoolFiltersValue;
    onApply: (value: LeadPoolFiltersValue) => void;
    loading?: boolean;
}

export function LeadPoolFilters({ initialValue, onApply, loading }: LeadPoolFiltersProps) {
    const form = useForm<LeadPoolFiltersFormInput, unknown, LeadPoolFiltersFormOutput>({
        resolver: zodResolver(leadPoolFiltersSchema),
        values: initialValue,
    });

    const handleApply = form.handleSubmit((values) => {
        onApply(values);
    });

    const handleReset = () => {
        const cleared: LeadPoolFiltersValue = {
            city: "",
            state: "",
            category: "",
            source: "",
            freshnessDays: "",
        };
        form.reset(cleared);
        onApply(cleared);
    };

    return (
        <div className="space-y-4 rounded-lg border p-4">
            <div className="grid gap-3 md:grid-cols-5">
                <div className="space-y-1.5">
                    <Label htmlFor="lead-pool-city">Cidade</Label>
                    <Input id="lead-pool-city" placeholder="Sao Paulo" {...form.register("city")} />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="lead-pool-state">Estado</Label>
                    <Input id="lead-pool-state" placeholder="SP" {...form.register("state")} />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="lead-pool-category">Categoria</Label>
                    <Input id="lead-pool-category" placeholder="Logistica" {...form.register("category")} />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="lead-pool-source">Fonte</Label>
                    <Input id="lead-pool-source" placeholder="google_maps" {...form.register("source")} />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="lead-pool-freshness">Freshness (dias)</Label>
                    <Input
                        id="lead-pool-freshness"
                        type="number"
                        min={1}
                        placeholder="45"
                        {...form.register("freshnessDays")}
                    />
                    {form.formState.errors.freshnessDays && (
                        <p className="text-xs text-destructive">
                            {form.formState.errors.freshnessDays.message}
                        </p>
                    )}
                </div>
            </div>
            <div className="flex flex-wrap gap-2">
                <Button onClick={handleApply} disabled={loading}>
                    {loading ? "Buscando..." : "Buscar no Lead Pool"}
                </Button>
                <Button variant="outline" onClick={handleReset} disabled={loading}>
                    Limpar
                </Button>
            </div>
        </div>
    );
}
