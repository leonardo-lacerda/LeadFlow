"use client";

import { useEffect, useMemo, useState } from "react";
import { organizationApi } from "@/lib/organization-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { IconLoader, IconPlus, IconTrash } from "@tabler/icons-react";

type CustomRuleOperator = "eq" | "neq" | "gte" | "lte" | "contains" | "in";

interface CustomRule {
    field: string;
    operator: CustomRuleOperator;
    value: string;
}

interface IcpConfig {
    industries: string[];
    companySizes: string[];
    seniorityLevels: string[];
    locations: string[];
    technologies: string[];
    customRules: CustomRule[];
}

const EMPTY_CONFIG: IcpConfig = {
    industries: [],
    companySizes: [],
    seniorityLevels: [],
    locations: [],
    technologies: [],
    customRules: [],
};

function toStringList(value: unknown): string[] {
    if (!value) {
        return [];
    }
    if (typeof value === "string") {
        return value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
    }
    if (Array.isArray(value)) {
        return value
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean);
    }
    return [];
}

function normalizeIcpDefinition(value: unknown): IcpConfig {
    if (!value || typeof value !== "object") {
        return EMPTY_CONFIG;
    }

    const raw = value as Record<string, unknown>;
    const customRulesRaw = Array.isArray(raw.customRules) ? raw.customRules : [];

    const customRules = customRulesRaw
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
        .map((entry): CustomRule => {
            const operator: CustomRuleOperator =
                entry.operator === "eq" ||
                entry.operator === "neq" ||
                entry.operator === "gte" ||
                entry.operator === "lte" ||
                entry.operator === "contains" ||
                entry.operator === "in"
                    ? entry.operator
                    : "eq";

            return {
                field: typeof entry.field === "string" ? entry.field : "",
                operator,
                value: typeof entry.value === "string" ? entry.value : String(entry.value ?? ""),
            };
        })
        .filter((rule) => rule.field.trim().length > 0);

    return {
        industries: toStringList(raw.industries),
        companySizes: toStringList(raw.companySizes),
        seniorityLevels: toStringList(raw.seniorityLevels),
        locations: toStringList(raw.locations),
        technologies: toStringList(raw.technologies),
        customRules,
    };
}

function listToInput(value: string[]): string {
    return value.join(", ");
}

function inputToList(value: string): string[] {
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

export default function IcpSettingsPage() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState<IcpConfig>(EMPTY_CONFIG);

    useEffect(() => {
        const load = async () => {
            try {
                const org = await organizationApi.getOrganization();
                setConfig(normalizeIcpDefinition(org.icpDefinition));
            } catch (error) {
                console.error(error);
                toast({ title: "Erro ao carregar ICP", variant: "destructive" });
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [toast]);

    const totalSignals = useMemo(
        () =>
            config.industries.length +
            config.companySizes.length +
            config.seniorityLevels.length +
            config.locations.length +
            config.technologies.length +
            config.customRules.length,
        [config]
    );

    const handleSave = async () => {
        setSaving(true);
        try {
            await organizationApi.updateOrganization({
                icpDefinition: {
                    industries: config.industries,
                    companySizes: config.companySizes,
                    seniorityLevels: config.seniorityLevels,
                    locations: config.locations,
                    technologies: config.technologies,
                    customRules: config.customRules.filter(
                        (rule) => rule.field.trim() && rule.value.trim()
                    ),
                },
            });
            toast({ title: "ICP atualizado com sucesso" });
        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao salvar ICP", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const updateRule = (index: number, field: keyof CustomRule, value: string) => {
        setConfig((prev) => ({
            ...prev,
            customRules: prev.customRules.map((rule, ruleIndex) =>
                ruleIndex === index ? { ...rule, [field]: value } : rule
            ),
        }));
    };

    const addRule = () => {
        setConfig((prev) => ({
            ...prev,
            customRules: [
                ...prev.customRules,
                { field: "companyRevenue", operator: "gte", value: "1M" },
            ],
        }));
    };

    const removeRule = (index: number) => {
        setConfig((prev) => ({
            ...prev,
            customRules: prev.customRules.filter((_, ruleIndex) => ruleIndex !== index),
        }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Perfil ICP</h3>
                <p className="text-sm text-muted-foreground">
                    Defina o cliente ideal para melhorar classificacao e priorizacao dos leads.
                </p>
            </div>
            <Separator />

            <Card>
                <CardHeader>
                    <CardTitle>Segmentacao Principal</CardTitle>
                    <CardDescription>
                        Use valores separados por virgula. Exemplo: saas, fintech, tecnologia.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label>Industries</Label>
                        <Input
                            value={listToInput(config.industries)}
                            onChange={(event) =>
                                setConfig((prev) => ({
                                    ...prev,
                                    industries: inputToList(event.target.value),
                                }))
                            }
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Company Sizes</Label>
                        <Input
                            placeholder="11-50, 51-200"
                            value={listToInput(config.companySizes)}
                            onChange={(event) =>
                                setConfig((prev) => ({
                                    ...prev,
                                    companySizes: inputToList(event.target.value),
                                }))
                            }
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Seniority Levels</Label>
                        <Input
                            placeholder="director, c-level, vp"
                            value={listToInput(config.seniorityLevels)}
                            onChange={(event) =>
                                setConfig((prev) => ({
                                    ...prev,
                                    seniorityLevels: inputToList(event.target.value),
                                }))
                            }
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Locations</Label>
                        <Input
                            placeholder="SP, RJ, MG"
                            value={listToInput(config.locations)}
                            onChange={(event) =>
                                setConfig((prev) => ({
                                    ...prev,
                                    locations: inputToList(event.target.value),
                                }))
                            }
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Technologies</Label>
                        <Input
                            placeholder="hubspot, salesforce, rdstation"
                            value={listToInput(config.technologies)}
                            onChange={(event) =>
                                setConfig((prev) => ({
                                    ...prev,
                                    technologies: inputToList(event.target.value),
                                }))
                            }
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Regras Customizadas</CardTitle>
                    <CardDescription>
                        Crie regras extras para aumentar a precisao do ICP fit.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {config.customRules.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Nenhuma regra customizada.
                        </p>
                    ) : (
                        config.customRules.map((rule, index) => (
                            <div key={index} className="grid grid-cols-12 gap-2">
                                <Input
                                    className="col-span-4"
                                    placeholder="field"
                                    value={rule.field}
                                    onChange={(event) =>
                                        updateRule(index, "field", event.target.value)
                                    }
                                />
                                <Select
                                    value={rule.operator}
                                    onValueChange={(value) =>
                                        updateRule(index, "operator", value as CustomRuleOperator)
                                    }
                                >
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="eq">eq</SelectItem>
                                        <SelectItem value="neq">neq</SelectItem>
                                        <SelectItem value="gte">gte</SelectItem>
                                        <SelectItem value="lte">lte</SelectItem>
                                        <SelectItem value="contains">contains</SelectItem>
                                        <SelectItem value="in">in</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Input
                                    className="col-span-4"
                                    placeholder="value"
                                    value={rule.value}
                                    onChange={(event) =>
                                        updateRule(index, "value", event.target.value)
                                    }
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="col-span-1"
                                    onClick={() => removeRule(index)}
                                >
                                    <IconTrash className="h-4 w-4" />
                                </Button>
                            </div>
                        ))
                    )}
                    <Button type="button" variant="outline" onClick={addRule}>
                        <IconPlus className="mr-2 h-4 w-4" />
                        Adicionar Regra
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="flex items-center justify-between py-4">
                    <p className="text-sm text-muted-foreground">
                        Sinais configurados: <span className="font-medium text-foreground">{totalSignals}</span>
                    </p>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <IconLoader className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar ICP
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
