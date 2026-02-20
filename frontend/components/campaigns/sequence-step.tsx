"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    IconGripVertical,
    IconMail,
    IconBrandWhatsapp,
    IconClock,
    IconGitBranch,
    IconPencil,
    IconTrash,
} from "@tabler/icons-react";
import { Step } from "./types";
import { Badge } from "@/components/ui/badge";

interface SequenceStepProps {
    step: Step;
    index: number;
    onEdit: () => void;
    onRemove: () => void;
}

export function SequenceStep({ step, index, onEdit, onRemove }: SequenceStepProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: step.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const getIcon = () => {
        switch (step.type) {
            case "email":
                return <IconMail className="text-blue-500" />;
            case "whatsapp":
                return <IconBrandWhatsapp className="text-green-500" />;
            case "wait":
                return <IconClock className="text-orange-500" />;
            case "condition":
                return <IconGitBranch className="text-purple-500" />;
        }
    };

    return (
        <div ref={setNodeRef} style={style} className="relative group">
            {/* Connector Line */}
            {index > 0 && (
                <div className="absolute left-8 -top-4 w-0.5 h-4 bg-border -z-10" />
            )}

            <Card className={`border-l-4 ${step.type === "email" ? "border-l-blue-500" :
                step.type === "whatsapp" ? "border-l-green-500" :
                    step.type === "wait" ? "border-l-orange-500" :
                        "border-l-purple-500"
                }`}>
                <div className="flex items-center p-4 gap-4">
                    <div
                        {...attributes}
                        {...listeners}
                        className="cursor-move text-muted-foreground hover:text-foreground"
                    >
                        <IconGripVertical className="h-5 w-5" />
                    </div>

                    <div className="h-10 w-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                        {getIcon()}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm truncate">{step.title}</span>
                            <Badge variant="outline" className="text-[10px] uppercase">
                                {step.type}
                            </Badge>
                        </div>
                        {step.content && (
                            <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                                {step.content}
                            </p>
                        )}
                        {step.delay && (
                            <p className="text-xs text-muted-foreground">
                                Aguardar {step.delay} horas
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={onEdit}>
                            <IconPencil className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-600"
                            onClick={onRemove}
                        >
                            <IconTrash className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Connector Line Bottom */}
            <div className="absolute left-8 -bottom-4 w-0.5 h-4 bg-border -z-10 last:hidden" />
        </div>
    );
}
