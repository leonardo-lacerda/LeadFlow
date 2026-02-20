"use client";

import { useState } from "react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import {
    IconMail,
    IconBrandWhatsapp,
    IconClock,
    IconGitBranch,
} from "@tabler/icons-react";
import { Step, StepType } from "./types";
import { SequenceStep } from "./sequence-step";
import { v4 as uuidv4 } from "uuid";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { StepEditor } from "./step-editor";

interface SequenceBuilderProps {
    initialSteps?: Step[];
    onStepsChange?: (steps: Step[]) => void;
}

export function SequenceBuilder({ initialSteps = [], onStepsChange }: SequenceBuilderProps) {
    const [steps, setSteps] = useState<Step[]>(
        initialSteps.length > 0
            ? initialSteps
            : [
                { id: "1", type: "email", title: "Email 1: Introdução", content: "Olá {{firstName}}, ..." },
                { id: "2", type: "wait", title: "Esperar 2 dias", delay: 48 },
                { id: "3", type: "email", title: "Email 2: Follow-up", content: "Vi que você..." },
            ]
    );

    const [editingStep, setEditingStep] = useState<Step | null>(null);

    // Notify parent of steps changes
    const updateSteps = (newSteps: Step[]) => {
        setSteps(newSteps);
        onStepsChange?.(newSteps);
    };

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;

        if (active.id !== over?.id) {
            setSteps((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over?.id);
                const reordered = arrayMove(items, oldIndex, newIndex);
                onStepsChange?.(reordered);
                return reordered;
            });
        }
    }

    const addStep = (type: StepType) => {
        const newStep: Step = {
            id: uuidv4(),
            type,
            title: type === "wait" ? "Novo tempo de espera" : `Nova mensagem ${type}`,
            delay: type === "wait" ? 24 : undefined,
        };
        updateSteps([...steps, newStep]);
        setEditingStep(newStep);
    };

    const removeStep = (id: string) => {
        updateSteps(steps.filter((s) => s.id !== id));
    };

    const updateStep = (id: string, updates: Partial<Step>) => {
        const updated = steps.map((s) => (s.id === id ? { ...s, ...updates } : s));
        updateSteps(updated);
        if (editingStep?.id === id) {
            setEditingStep({ ...editingStep, ...updates });
        }
    };

    return (
        <div className="flex gap-6 h-[600px]">
            {/* Toolbox */}
            <div className="w-48 flex flex-col gap-2">
                <h3 className="text-sm font-medium mb-2 text-muted-foreground">Adicionar Passo</h3>
                <Button
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => addStep("email")}
                >
                    <IconMail className="h-4 w-4 text-blue-500" /> Email
                </Button>
                <Button
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => addStep("whatsapp")}
                >
                    <IconBrandWhatsapp className="h-4 w-4 text-green-500" /> WhatsApp
                </Button>
                <Button
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => addStep("wait")}
                >
                    <IconClock className="h-4 w-4 text-orange-500" /> Esperar
                </Button>
                <Button
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => addStep("condition")}
                >
                    <IconGitBranch className="h-4 w-4 text-purple-500" /> Condição
                </Button>
            </div>

            {/* Builder Area */}
            <div className="flex-1 bg-neutral-50 dark:bg-neutral-900 rounded-lg p-6 overflow-y-auto border-2 border-dashed border-neutral-200 dark:border-neutral-800">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext items={steps} strategy={verticalListSortingStrategy}>
                        <div className="space-y-4 max-w-2xl mx-auto">
                            {steps.map((step, index) => (
                                <SequenceStep
                                    key={step.id}
                                    step={step}
                                    index={index}
                                    onEdit={() => setEditingStep(step)}
                                    onRemove={() => removeStep(step.id)}
                                />
                            ))}

                            {steps.length === 0 && (
                                <div className="text-center py-20 text-muted-foreground">
                                    <p>Arraste passos ou clique para adicionar</p>
                                </div>
                            )}
                        </div>
                    </SortableContext>
                </DndContext>
            </div>

            {/* Editor Sheet */}
            <Sheet open={!!editingStep} onOpenChange={() => setEditingStep(null)}>
                <SheetContent className="sm:max-w-md w-full">
                    <SheetHeader>
                        <SheetTitle>Editar Passo</SheetTitle>
                        <SheetDescription>
                            Configure os detalhes deste passo da sequência.
                        </SheetDescription>
                    </SheetHeader>
                    {editingStep && (
                        <StepEditor
                            key={editingStep.id}
                            step={editingStep}
                            onUpdate={(updates) => updateStep(editingStep.id, updates)}
                        />
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}
