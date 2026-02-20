"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import "react-quill/dist/quill.snow.css";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IconVariable, IconEye, IconCode, IconDeviceMobile, IconDeviceDesktop, IconSparkles, IconTemplate } from "@tabler/icons-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });

interface TemplateEditorProps {
    value: string;
    onChange: (value: string) => void;
    showPreview?: boolean;
}

const VARIABLES = [
    { key: "firstName", label: "Nome" },
    { key: "lastName", label: "Sobrenome" },
    { key: "companyName", label: "Empresa" },
    { key: "jobTitle", label: "Cargo" },
    { key: "industry", label: "Indústria" },
    { key: "city", label: "Cidade" },
];

const SAMPLE_DATA = {
    firstName: "Roberto",
    lastName: "Silva",
    companyName: "TechCorp",
    jobTitle: "CEO",
    industry: "Tecnologia",
    city: "São Paulo",
};

const TEMPLATE_LIBRARY = [
    {
        id: 1,
        name: "Cold Outreach Simples",
        category: "Prospecção",
        content: "<p>Olá <strong>{{firstName}}</strong>,</p><p><br></p><p>Vi que você é <strong>{{jobTitle}}</strong> na <strong>{{companyName}}</strong> e achei que poderíamos conversar sobre como ajudamos empresas de <strong>{{industry}}</strong> a aumentar suas vendas em até 40%.</p><p><br></p><p>Tem 15 minutos essa semana para um café virtual?</p><p><br></p><p>Abs,</p>",
    },
    {
        id: 2,
        name: "Follow-up Primeira Mensagem",
        category: "Follow-up",
        content: "<p>Oi <strong>{{firstName}}</strong>,</p><p><br></p><p>Enviei um email há alguns dias sobre nossa solução para <strong>{{companyName}}</strong>. Sei que sua agenda deve estar lotada!</p><p><br></p><p>Apenas queria reforçar que já ajudamos mais de 50 empresas como a sua. Vale uma conversa rápida?</p>",
    },
    {
        id: 3,
        name: "Proposta de Valor",
        category: "Apresentação",
        content: "<p>Olá <strong>{{firstName}}</strong>,</p><p><br></p><p>Empresas de <strong>{{industry}}</strong> em <strong>{{city}}</strong> estão enfrentando 3 desafios principais:</p><ul><li>Geração de leads qualificados</li><li>Automação de processos</li><li>Conversão de oportunidades</li></ul><p><br></p><p>Nossa plataforma resolve os 3. Posso mostrar como?</p>",
    },
    {
        id: 4,
        name: "Agradecimento Reunião",
        category: "Pós-venda",
        content: "<p>Oi <strong>{{firstName}}</strong>,</p><p><br></p><p>Muito obrigado pela reunião hoje! Foi ótimo conhecer mais sobre os desafios da <strong>{{companyName}}</strong>.</p><p><br></p><p>Conforme combinamos, segue em anexo a proposta personalizada. Qualquer dúvida, estou à disposição!</p><p><br></p><p>Abraços,</p>",
    },
];

type EditorTab = "editor" | "preview" | "html";

export function TemplateEditor({ value, onChange, showPreview = true }: TemplateEditorProps) {
    const [activeTab, setActiveTab] = useState<EditorTab>("editor");
    const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
    const [isGenerating, setIsGenerating] = useState(false);

    const modules = useMemo(
        () => ({
            toolbar: [
                [{ header: [1, 2, 3, false] }],
                ["bold", "italic", "underline", "strike"],
                [{ list: "ordered" }, { list: "bullet" }],
                ["link"],
                ["clean"],
            ],
        }),
        []
    );

    const formats = [
        "header",
        "bold",
        "italic",
        "underline",
        "strike",
        "list",
        "bullet",
        "link",
    ];

    const insertVariable = (varKey: string) => {
        const placeholder = `{{${varKey}}}`;
        onChange(value + placeholder);
    };

    const handleGenerateAI = async () => {
        setIsGenerating(true);
        // Simulating AI generation - replace with actual API call
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const aiGenerated = `<p>Olá <strong>{{firstName}}</strong>,</p><p><br></p><p>Espero que esteja tudo bem! Notei que a <strong>{{companyName}}</strong> está crescendo bastante no setor de <strong>{{industry}}</strong>.</p><p><br></p><p>Gostaria de apresentar uma solução que pode ajudar sua equipe a economizar até 15 horas por semana em tarefas repetitivas.</p><p><br></p><p>Quando podemos conversar?</p>`;

        onChange(aiGenerated);
        setIsGenerating(false);
    };

    const loadTemplate = (template: typeof TEMPLATE_LIBRARY[0]) => {
        onChange(template.content);
    };

    // Generate preview with sample data
    const previewHTML = useMemo(() => {
        let html = value;
        Object.entries(SAMPLE_DATA).forEach(([key, val]) => {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
            html = html.replace(regex, `<strong class="text-primary">${val}</strong>`);
        });
        return html;
    }, [value]);

    const handleTabChange = (tab: string) => {
        if (tab === "editor" || tab === "preview" || tab === "html") {
            if (!showPreview && tab === "preview") {
                setActiveTab("editor");
                return;
            }
            setActiveTab(tab);
        }
    };

    return (
        <div className="space-y-4">
            {/* Top Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Variable Insertion Buttons */}
                <div className="flex flex-wrap gap-2">
                    {VARIABLES.map((variable) => (
                        <Button
                            key={variable.key}
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => insertVariable(variable.key)}
                            className="gap-1"
                        >
                            <IconVariable className="h-3 w-3" />
                            {variable.label}
                        </Button>
                    ))}
                </div>

                {/* AI Generate & Template Library */}
                <div className="flex gap-2">
                    <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={handleGenerateAI}
                        disabled={isGenerating}
                        className="gap-1"
                    >
                        <IconSparkles className="h-4 w-4" />
                        {isGenerating ? "Gerando..." : "Gerar com IA"}
                    </Button>

                    <Dialog>
                        <DialogTrigger asChild>
                            <Button type="button" size="sm" variant="outline" className="gap-1">
                                <IconTemplate className="h-4 w-4" />
                                Templates
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Biblioteca de Templates</DialogTitle>
                                <DialogDescription>
                                    Escolha um template pronto para começar
                                </DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="h-[400px] pr-4">
                                <div className="grid gap-3">
                                    {TEMPLATE_LIBRARY.map((template) => (
                                        <div
                                            key={template.id}
                                            className="border rounded-lg p-4 hover:bg-accent cursor-pointer transition"
                                            onClick={() => loadTemplate(template)}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <h4 className="font-medium">{template.name}</h4>
                                                    <p className="text-xs text-muted-foreground">{template.category}</p>
                                                </div>
                                                <Button size="sm" variant="ghost">Usar</Button>
                                            </div>
                                            <div
                                                className="text-sm text-muted-foreground line-clamp-2"
                                                dangerouslySetInnerHTML={{ __html: template.content.replace(/<[^>]*>/g, ' ') }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Tabs for Editor/Preview/HTML */}
            <Tabs value={activeTab} onValueChange={handleTabChange}>
                <TabsList className={`grid w-full ${showPreview ? "grid-cols-3" : "grid-cols-2"}`}>
                    <TabsTrigger value="editor">
                        <IconCode className="h-4 w-4 mr-2" /> Editor
                    </TabsTrigger>
                    {showPreview && (
                        <TabsTrigger value="preview">
                            <IconEye className="h-4 w-4 mr-2" /> Preview
                        </TabsTrigger>
                    )}
                    <TabsTrigger value="html">
                        HTML
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="editor" className="mt-4">
                    <div className="border rounded-md overflow-hidden">
                        <ReactQuill
                            theme="snow"
                            value={value}
                            onChange={onChange}
                            modules={modules}
                            formats={formats}
                            className="bg-white dark:bg-neutral-900 min-h-[300px]"
                            placeholder="Digite o conteúdo da mensagem aqui..."
                        />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        Use as variáveis acima para personalizar a mensagem. Ex: <code>{"{{firstName}}"}</code>
                    </p>
                </TabsContent>

                {showPreview && (
                    <TabsContent value="preview" className="mt-4">
                    {/* Device Toggle */}
                    <div className="flex gap-2 mb-4">
                        <Button
                            type="button"
                            size="sm"
                            variant={previewDevice === "desktop" ? "default" : "outline"}
                            onClick={() => setPreviewDevice("desktop")}
                            className="gap-1"
                        >
                            <IconDeviceDesktop className="h-4 w-4" />
                            Desktop
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant={previewDevice === "mobile" ? "default" : "outline"}
                            onClick={() => setPreviewDevice("mobile")}
                            className="gap-1"
                        >
                            <IconDeviceMobile className="h-4 w-4" />
                            Mobile
                        </Button>
                    </div>

                    {/* Preview Container */}
                    <div className="flex justify-center">
                        <div
                            className={`border rounded-lg bg-white dark:bg-neutral-900 transition-all ${previewDevice === "mobile" ? "w-[375px]" : "w-full"
                                }`}
                        >
                            <div className="p-6 prose dark:prose-invert max-w-none">
                                <div dangerouslySetInnerHTML={{ __html: previewHTML }} />
                            </div>
                        </div>
                    </div>

                    <p className="text-xs text-muted-foreground mt-2 text-center">
                        Preview com dados de exemplo: {SAMPLE_DATA.firstName} {SAMPLE_DATA.lastName} ({SAMPLE_DATA.companyName})
                    </p>
                    </TabsContent>
                )}

                <TabsContent value="html" className="mt-4">
                    <textarea
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full h-[300px] p-4 border rounded-md font-mono text-sm bg-white dark:bg-neutral-900"
                        placeholder="<p>HTML source...</p>"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                        Edição manual do código HTML. Cuidado ao modificar diretamente.
                    </p>
                </TabsContent>
            </Tabs>
        </div>
    );
}
