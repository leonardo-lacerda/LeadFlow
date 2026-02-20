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
    { value: "EMAIL_OPENED", label: "Prospect abriu o email" },
    { value: "EMAIL_REPLIED", label: "Prospect respondeu o email" },
    { value: "EMAIL_CLICKED", label: "Prospect clicou em um link" },
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
                <span>Se a condicao for verdadeira, continua sequence. Caso contrario, pausa.</span>
            </div>

            <div className="space-y-2">
                <Label>Tipo de condicao</Label>
                <Select value={conditionType} onValueChange={handleTypeChange}>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecione a condicao" />
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
                                    <li>Sistema aguarda ate 48h para verificar abertura</li>
                                    <li>Se abriu: continua para proximo passo</li>
                                    <li>Se nao abriu: pausa a sequence</li>
                                </>
                            )}
                            {conditionType === "EMAIL_REPLIED" && (
                                <>
                                    <li>Sistema aguarda ate 7 dias para verificar resposta</li>
                                    <li>Se respondeu: marca como interessado e pausa</li>
                                    <li>Se nao respondeu: continua sequence</li>
                                </>
                            )}
                            {conditionType === "EMAIL_CLICKED" && (
                                <>
                                    <li>Sistema verifica se houve clique em qualquer link</li>
                                    <li>Se clicou: marca como engajado</li>
                                    <li>Se nao clicou: continua normalmente</li>
                                </>
                            )}
                            {conditionType === "WAIT_TIME" && (
                                <>
                                    <li>Aguarda tempo configurado antes de prosseguir</li>
                                    <li>Util para criar pausas estrategicas</li>
                                </>
                            )}
                        </ul>
                    </div>
                </CardContent>
            </Card>

            <div className="text-xs text-muted-foreground bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-md p-3">
                <strong>Nota:</strong> Condicoes sao verificadas automaticamente pelo sistema.
                Prospects que nao atenderem as condicoes ficam pausados ate acao manual.
            </div>
        </div>
    );
}
