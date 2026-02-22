"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    IconCode,
    IconDeviceDesktop,
    IconDeviceMobile,
    IconEye,
    IconSparkles,
    IconTemplate,
    IconVariable,
} from "@tabler/icons-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

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
    { key: "industry", label: "Industria" },
    { key: "city", label: "Cidade" },
];

const SAMPLE_DATA = {
    firstName: "Roberto",
    lastName: "Silva",
    companyName: "TechCorp",
    jobTitle: "CEO",
    industry: "Tecnologia",
    city: "Sao Paulo",
};

const TEMPLATE_LIBRARY = [
    {
        id: 1,
        name: "Abordagem inicial simples",
        category: "Prospeccao",
        content:
            "<p>Ola <strong>{{firstName}}</strong>,</p><p><br></p><p>Vi que voce e <strong>{{jobTitle}}</strong> na <strong>{{companyName}}</strong> e achei que poderiamos conversar sobre como ajudamos empresas de <strong>{{industry}}</strong> a aumentar previsibilidade de receita.</p><p><br></p><p>Tem 15 minutos esta semana para uma conversa rapida?</p><p><br></p><p>Abs,</p>",
    },
    {
        id: 2,
        name: "Retomada da primeira mensagem",
        category: "Retomada",
        content:
            "<p>Oi <strong>{{firstName}}</strong>,</p><p><br></p><p>Te escrevi alguns dias atras sobre uma forma de melhorar a aquisicao da <strong>{{companyName}}</strong>. Sei que a agenda fica corrida.</p><p><br></p><p>Se fizer sentido, posso te mostrar em 10 minutos como outras empresas parecidas estao usando essa abordagem.</p>",
    },
    {
        id: 3,
        name: "Proposta de valor",
        category: "Apresentacao",
        content:
            "<p>Ola <strong>{{firstName}}</strong>,</p><p><br></p><p>Empresas de <strong>{{industry}}</strong> em <strong>{{city}}</strong> costumam enfrentar tres desafios:</p><ul><li>Priorizacao de leads por sinais reais</li><li>Consistencia na execucao de contato</li><li>Conversao de resposta em reuniao</li></ul><p><br></p><p>Posso te mostrar como resolvemos isso em operacoes parecidas.</p>",
    },
    {
        id: 4,
        name: "Agradecimento de reuniao",
        category: "Pos-venda",
        content:
            "<p>Oi <strong>{{firstName}}</strong>,</p><p><br></p><p>Obrigado pela reuniao de hoje. Foi otimo entender melhor os desafios da <strong>{{companyName}}</strong>.</p><p><br></p><p>Como combinado, vou enviar os proximos passos e ficarei a disposicao para qualquer duvida.</p><p><br></p><p>Abracos,</p>",
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

    const formats = ["header", "bold", "italic", "underline", "strike", "list", "bullet", "link"];

    const insertVariable = (varKey: string) => {
        onChange(`${value}{{${varKey}}}`);
    };

    const handleGenerateAI = async () => {
        setIsGenerating(true);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const aiGenerated =
            "<p>Ola <strong>{{firstName}}</strong>,</p><p><br></p><p>Espero que esteja tudo bem. Notei que a <strong>{{companyName}}</strong> esta crescendo no setor de <strong>{{industry}}</strong>.</p><p><br></p><p>Gostaria de compartilhar uma estrategia que pode reduzir o tempo do seu time em tarefas repetitivas e melhorar taxa de resposta.</p><p><br></p><p>Quando podemos conversar?</p>";
        onChange(aiGenerated);
        setIsGenerating(false);
    };

    const loadTemplate = (template: (typeof TEMPLATE_LIBRARY)[0]) => {
        onChange(template.content);
    };

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
            <div className="flex flex-wrap items-center justify-between gap-2">
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
                                Modelos
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Biblioteca de modelos</DialogTitle>
                                <DialogDescription>
                                    Escolha um modelo pronto para comecar.
                                </DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="h-[400px] pr-4">
                                <div className="grid gap-3">
                                    {TEMPLATE_LIBRARY.map((template) => (
                                        <div
                                            key={template.id}
                                            className="cursor-pointer rounded-lg border p-4 transition hover:bg-accent"
                                            onClick={() => loadTemplate(template)}
                                        >
                                            <div className="mb-2 flex items-start justify-between">
                                                <div>
                                                    <h4 className="font-medium">{template.name}</h4>
                                                    <p className="text-xs text-muted-foreground">
                                                        {template.category}
                                                    </p>
                                                </div>
                                                <Button size="sm" variant="ghost">
                                                    Usar
                                                </Button>
                                            </div>
                                            <div
                                                className="line-clamp-2 text-sm text-muted-foreground"
                                                dangerouslySetInnerHTML={{
                                                    __html: template.content.replace(/<[^>]*>/g, " "),
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange}>
                <TabsList className={`grid w-full ${showPreview ? "grid-cols-3" : "grid-cols-2"}`}>
                    <TabsTrigger value="editor">
                        <IconCode className="mr-2 h-4 w-4" />
                        Editor
                    </TabsTrigger>
                    {showPreview && (
                        <TabsTrigger value="preview">
                            <IconEye className="mr-2 h-4 w-4" />
                            Previa
                        </TabsTrigger>
                    )}
                    <TabsTrigger value="html">HTML</TabsTrigger>
                </TabsList>

                <TabsContent value="editor" className="mt-4">
                    <div className="overflow-hidden rounded-md border">
                        <ReactQuill
                            theme="snow"
                            value={value}
                            onChange={onChange}
                            modules={modules}
                            formats={formats}
                            className="min-h-[300px] bg-white dark:bg-neutral-900"
                            placeholder="Digite o conteudo da mensagem aqui..."
                        />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                        Use as variaveis acima para personalizar a mensagem. Exemplo:{" "}
                        <code>{"{{firstName}}"}</code>
                    </p>
                </TabsContent>

                {showPreview && (
                    <TabsContent value="preview" className="mt-4">
                        <div className="mb-4 flex gap-2">
                            <Button
                                type="button"
                                size="sm"
                                variant={previewDevice === "desktop" ? "default" : "outline"}
                                onClick={() => setPreviewDevice("desktop")}
                                className="gap-1"
                            >
                                <IconDeviceDesktop className="h-4 w-4" />
                                Computador
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={previewDevice === "mobile" ? "default" : "outline"}
                                onClick={() => setPreviewDevice("mobile")}
                                className="gap-1"
                            >
                                <IconDeviceMobile className="h-4 w-4" />
                                Celular
                            </Button>
                        </div>

                        <div className="flex justify-center">
                            <div
                                className={`rounded-lg border bg-white transition-all dark:bg-neutral-900 ${
                                    previewDevice === "mobile" ? "w-[375px]" : "w-full"
                                }`}
                            >
                                <div className="prose max-w-none p-6 dark:prose-invert">
                                    <div dangerouslySetInnerHTML={{ __html: previewHTML }} />
                                </div>
                            </div>
                        </div>

                        <p className="mt-2 text-center text-xs text-muted-foreground">
                            Previa com dados de exemplo: {SAMPLE_DATA.firstName} {SAMPLE_DATA.lastName} (
                            {SAMPLE_DATA.companyName})
                        </p>
                    </TabsContent>
                )}

                <TabsContent value="html" className="mt-4">
                    <textarea
                        value={value}
                        onChange={(event) => onChange(event.target.value)}
                        className="h-[300px] w-full rounded-md border bg-white p-4 font-mono text-sm dark:bg-neutral-900"
                        placeholder="<p>Codigo HTML...</p>"
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                        Edicao manual do HTML. Revise o resultado antes de enviar.
                    </p>
                </TabsContent>
            </Tabs>
        </div>
    );
}
