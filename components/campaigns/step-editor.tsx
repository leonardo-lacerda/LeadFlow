"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Step } from "./types";
import { ConditionEditor } from "./condition-editor";
import { TemplateEditor } from "./template-editor";
import { useState } from "react";

interface StepEditorProps {
    step: Step;
    onUpdate: (updates: Partial<Step>) => void;
}

export function StepEditor({ step, onUpdate }: StepEditorProps) {
    const [formData, setFormData] = useState({
        title: step.title,
        content: step.content || "",
        delay: step.delay?.toString() || "24",
    });

    const handleChange = (field: keyof typeof formData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));

        // Auto-save changes
        if (field === "title") onUpdate({ title: value });
        if (field === "content") onUpdate({ content: value });
        if (field === "delay") {
            const numValue = parseInt(value);
            if (!isNaN(numValue)) onUpdate({ delay: numValue });
        }
    };

    // Condition step
    if (step.type === "condition") {
        return (
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="title">Nome da Condição</Label>
                    <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => handleChange("title", e.target.value)}
                    />
                </div>
                <ConditionEditor
                    value={step.condition}
                    onChange={(condition) => onUpdate({ condition })}
                />
            </div>
        );
    }

    // Wait step
    if (step.type === "wait") {
        return (
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="title">Nome do Passo</Label>
                    <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => handleChange("title", e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="delay">Tempo de Espera (horas)</Label>
                    <Input
                        id="delay"
                        type="number"
                        min="1"
                        value={formData.delay}
                        onChange={(e) => handleChange("delay", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                        O sistema vai aguardar este tempo antes de prosseguir para o próximo passo.
                    </p>
                </div>
            </div>
        );
    }

    // Email/WhatsApp step with rich editor
    return (
        <div className="space-y-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="title">Assunto / Nome</Label>
                <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleChange("title", e.target.value)}
                />
            </div>

            <div className="space-y-2">
                <Label>Conteúdo da Mensagem</Label>
                <TemplateEditor
                    value={formData.content}
                    onChange={(value) => handleChange("content", value)}
                />
            </div>
        </div>
    );
}
