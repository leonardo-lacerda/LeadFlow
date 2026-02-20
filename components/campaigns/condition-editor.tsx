"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { IconGitBranch } from "@tabler/icons-react";

export type ConditionType =
    | "EMAIL_OPENED"
    | "EMAIL_REPLIED"
    | "EMAIL_CLICKED"
    | "WAIT_TIME";

interface ConditionEditorProps {
    value?: {
        type: ConditionType;
        waitHours?: number;
    };
    onChange: (value: { type: ConditionType; waitHours?: number }) => void;
}

const CONDITION_OPTIONS = [
    { value: "EMAIL_OPENED", label: "Lead abriu o email" },
    { value: "EMAIL_REPLIED", label: "Lead respondeu o email" },
    { value: "EMAIL_CLICKED", label: "Lead clicou em um link" },
    { value: "WAIT_TIME", label: "Tempo de espera passou" },
];

export function ConditionEditor({ value, onChange }: ConditionEditorProps) {
    const [conditionType, setConditionType] = useState<ConditionType>(
        value?.type || "EMAIL_OPENED"
    );

    const handleTypeChange = (type: ConditionType) => {
        setConditionType(type);
        onChange({ type, waitHours: type === "WAIT_TIME" ? 24 : undefined });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <IconGitBranch className="h-4 w-4" />
                <span>Se a condição for verdadeira, continua sequência. Caso contrário, pausa.</span>
            </div>

            <div className="space-y-2">
                <Label>Tipo de Condição</Label>
                <Select value={conditionType} onValueChange={handleTypeChange}>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecione a condição" />
                    </SelectTrigger>
                    <SelectContent>
                        {CONDITION_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <Card className="bg-muted/30">
                <CardContent className="pt-6">
                    <div className="space-y-2 text-sm">
                        <p className="font-medium">Como funciona?</p>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                            {conditionType === "EMAIL_OPENED" && (
                                <>
                                    <li>Sistema aguarda até 48h para verificar abertura</li>
                                    <li>Se aberto: continua para próximo passo</li>
                                    <li>Se não abriu: pausa a sequência</li>
                                </>
                            )}
                            {conditionType === "EMAIL_REPLIED" && (
                                <>
                                    <li>Sistema aguarda até 7 dias para verificar resposta</li>
                                    <li>Se respondeu: marca como &quot;Interessado&quot; e pausa</li>
                                    <li>Se não respondeu: continua sequência</li>
                                </>
                            )}
                            {conditionType === "EMAIL_CLICKED" && (
                                <>
                                    <li>Sistema verifica se houve clique em qualquer link</li>
                                    <li>Se clicou: marca como &quot;Engajado&quot;</li>
                                    <li>Se não clicou: continua normalmente</li>
                                </>
                            )}
                            {conditionType === "WAIT_TIME" && (
                                <>
                                    <li>Aguarda tempo configurado antes de prosseguir</li>
                                    <li>Útil para criar pausas estratégicas</li>
                                </>
                            )}
                        </ul>
                    </div>
                </CardContent>
            </Card>

            <div className="text-xs text-muted-foreground bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-md p-3">
                <strong>Nota:</strong> Condições são verificadas automaticamente pelo sistema.
                Leads que não atenderem as condições ficarão pausados até ação manual.
            </div>
        </div>
    );
}
