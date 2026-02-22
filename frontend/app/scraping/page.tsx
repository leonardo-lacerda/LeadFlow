"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    IconPlus,
    IconSearch,
    IconBrandGoogle,
    IconBuildingStore,
    IconBrandLinkedin,
    IconRefresh,
    IconEye,
    IconAlertCircle,
    IconCheck,
    IconClock,
    IconPlayerPlay,
    IconX,
    IconSparkles,
} from "@tabler/icons-react";
import { scrapingApi, ScrapingJob, ScrapingSource } from "@/lib/scraping-api";
import { aiApi } from "@/lib/ai-api";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import type { ComponentType } from "react";
import { useToast } from "@/hooks/use-toast";

type SourceIcon = ComponentType<{ className?: string }>;
type StatusIcon = ComponentType<{ className?: string }>;

type FormState = {
    query: string;
    location: string;
    cnpj: string;
    urls: string;
    limit: string;
};

type FieldConfig = {
    key: keyof FormState;
    label: string;
    placeholder?: string;
    helper?: string;
    type?: "text" | "number" | "textarea";
    required?: boolean;
};

type SourceAvailability = "html" | "api" | "unavailable";

const NO_API_MODE = true;

const DEFAULT_FORM_STATE: FormState = {
    query: "",
    location: "",
    cnpj: "",
    urls: "",
    limit: "100",
};

const FIELD_LABELS: Record<keyof FormState, string> = {
    query: "Busca",
    location: "Localizacao",
    cnpj: "CNPJ(s)",
    urls: "URLs",
    limit: "Limite",
};

const SOURCE_FIELDS: Record<ScrapingSource, FieldConfig[]> = {
    google_maps: [
        {
            key: "query",
            label: "Categoria ou termo",
            placeholder: "Ex: restaurante, clinica odontologica",
            required: true,
        },
        {
            key: "location",
            label: "Localizacao",
            placeholder: "Ex: Sao Paulo, SP",
            required: true,
        },
        {
            key: "limit",
            label: "Limite de resultados",
            placeholder: "100",
            type: "number",
        },
    ],
    cnpj: [
        {
            key: "cnpj",
            label: "CNPJ(s)",
            placeholder: "00.000.000/0001-91\n11.111.111/0001-11",
            helper: "Uma linha por CNPJ ou separado por virgula.",
            type: "textarea",
            required: true,
        },
        {
            key: "limit",
            label: "Limite de resultados",
            placeholder: "100",
            type: "number",
        },
    ],
    reclame_aqui: [
        {
            key: "query",
            label: "Empresa ou termo",
            placeholder: "Ex: operadora de telefonia",
            required: true,
        },
        {
            key: "limit",
            label: "Limite de resultados",
            placeholder: "100",
            type: "number",
        },
    ],
    indeed: [
        {
            key: "query",
            label: "Cargo ou termo",
            placeholder: "Ex: desenvolvedor python",
            required: true,
        },
        {
            key: "location",
            label: "Localizacao",
            placeholder: "Ex: Sao Paulo",
            required: true,
        },
        {
            key: "limit",
            label: "Limite de resultados",
            placeholder: "100",
            type: "number",
        },
    ],
    catho: [
        {
            key: "query",
            label: "Cargo ou termo",
            placeholder: "Ex: analista de dados",
            required: true,
        },
        {
            key: "location",
            label: "Localizacao",
            placeholder: "Ex: Sao Paulo",
            required: true,
        },
        {
            key: "limit",
            label: "Limite de resultados",
            placeholder: "100",
            type: "number",
        },
    ],
    mercado_livre: [
        {
            key: "query",
            label: "Termo ou vendedor",
            placeholder: "Ex: eletrodomesticos",
            required: true,
        },
        {
            key: "limit",
            label: "Limite de resultados",
            placeholder: "100",
            type: "number",
        },
    ],
    wappalyzer: [
        {
            key: "urls",
            label: "URLs",
            placeholder: "https://empresa.com\nhttps://outra.com",
            helper: "Uma URL por linha ou separado por virgula.",
            type: "textarea",
            required: true,
        },
        {
            key: "limit",
            label: "Limite de resultados",
            placeholder: "100",
            type: "number",
        },
    ],
    linkedin_dork: [
        {
            key: "query",
            label: "Dork",
            placeholder: "Ex: site:linkedin.com/in \"CEO\" \"Sao Paulo\"",
            required: true,
        },
        {
            key: "limit",
            label: "Limite de resultados",
            placeholder: "100",
            type: "number",
        },
    ],
    comprasnet: [
        {
            key: "query",
            label: "Termo",
            placeholder: "Ex: servicos de limpeza",
            required: true,
        },
        {
            key: "limit",
            label: "Limite de resultados",
            placeholder: "100",
            type: "number",
        },
    ],
};

const REQUIRED_FIELDS: Record<ScrapingSource, Array<keyof FormState>> = {
    google_maps: ["query", "location"],
    cnpj: ["cnpj"],
    reclame_aqui: ["query"],
    indeed: ["query", "location"],
    catho: ["query", "location"],
    mercado_livre: ["query"],
    wappalyzer: ["urls"],
    linkedin_dork: ["query"],
    comprasnet: ["query"],
};

const parseListInput = (value: string): string | string[] | null => {
    const items = value
        .split(/[\n,;]/)
        .map((item) => item.trim())
        .filter(Boolean);

    if (items.length === 0) {
        return null;
    }

    return items.length === 1 ? items[0] : items;
};

const buildQueryPayload = (source: ScrapingSource, data: FormState): Record<string, unknown> => {
    const payload: Record<string, unknown> = {};
    const limitValue = data.limit.trim();
    if (limitValue) {
        const parsed = Number(limitValue);
        if (!Number.isNaN(parsed) && parsed > 0) {
            payload.limit = parsed;
        }
    }

    switch (source) {
        case "google_maps":
            if (data.query.trim()) payload.query = data.query.trim();
            if (data.location.trim()) payload.location = data.location.trim();
            break;
        case "cnpj": {
            const cnpjList = parseListInput(data.cnpj);
            if (cnpjList) payload.cnpj = cnpjList;
            break;
        }
        case "reclame_aqui":
        case "mercado_livre":
        case "linkedin_dork":
        case "comprasnet":
            if (data.query.trim()) payload.query = data.query.trim();
            break;
        case "indeed":
        case "catho":
            if (data.query.trim()) payload.query = data.query.trim();
            if (data.location.trim()) payload.location = data.location.trim();
            break;
        case "wappalyzer": {
            const urlsList = parseListInput(data.urls);
            if (urlsList) payload.urls = urlsList;
            break;
        }
        default:
            break;
    }

    return payload;
};

const SOURCE_INFO: Record<
    ScrapingSource,
    { label: string; icon: SourceIcon; description: string; availability: SourceAvailability }
> = {
    google_maps: {
        label: "Google Maps",
        icon: IconBrandGoogle,
        description: "Empresas por localizacao e categoria",
        availability: "html",
    },
    cnpj: {
        label: "CNPJ Brasil",
        icon: IconBuildingStore,
        description: "Dados empresariais brasileiros",
        availability: "html",
    },
    linkedin_dork: {
        label: "LinkedIn Dork",
        icon: IconBrandLinkedin,
        description: "Profissionais via Google dorks",
        availability: "html",
    },
    reclame_aqui: {
        label: "Reclame Aqui",
        icon: IconAlertCircle,
        description: "Empresas com perfil publico",
        availability: "html",
    },
    indeed: {
        label: "Indeed",
        icon: IconSearch,
        description: "Vagas de emprego",
        availability: "html",
    },
    catho: {
        label: "Catho",
        icon: IconSearch,
        description: "Candidatos brasileiros",
        availability: "html",
    },
    mercado_livre: {
        label: "Mercado Livre",
        icon: IconBuildingStore,
        description: "Vendedores MLivre",
        availability: "html",
    },
    wappalyzer: {
        label: "Wappalyzer",
        icon: IconSearch,
        description: "Sites com tecnologias especificas",
        availability: "html",
    },
    comprasnet: {
        label: "ComprasNet",
        icon: IconBuildingStore,
        description: "Fornecedores gov",
        availability: "html",
    },
};

const STATUS_CONFIG: Record<
    ScrapingJob["status"],
    { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: StatusIcon }
> = {
    PENDING: { label: "Pendente", variant: "secondary", icon: IconClock },
    RUNNING: { label: "Em Execucao", variant: "default", icon: IconPlayerPlay },
    COMPLETED: { label: "Concluido", variant: "outline", icon: IconCheck },
    FAILED: { label: "Falhou", variant: "destructive", icon: IconX },
    CANCELLED: { label: "Cancelado", variant: "outline", icon: IconX },
};

export default function ScrapingPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [jobs, setJobs] = useState<ScrapingJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [showWizard, setShowWizard] = useState(false);
    const [wizardStep, setWizardStep] = useState(1);

    // Wizard state
    const [selectedSource, setSelectedSource] = useState<ScrapingSource | "">("");
    const [jobName, setJobName] = useState("");
    const [formData, setFormData] = useState<FormState>(DEFAULT_FORM_STATE);
    const [creating, setCreating] = useState(false);

    // AI suggestion state
    const [aiBusiness, setAiBusiness] = useState("");
    const [aiProduct, setAiProduct] = useState("");
    const [suggesting, setSuggesting] = useState(false);
    const [suggestedTerms, setSuggestedTerms] = useState<string[]>([]);

    useEffect(() => {
        loadJobs();
        const interval = setInterval(loadJobs, 2000); // Refresh every 2s
        return () => clearInterval(interval);
    }, []);

    const loadJobs = async () => {
        try {
            const data = await scrapingApi.listJobs({ limit: 50 });
            setJobs(data.jobs);
        } catch (error) {
            console.error("Failed to load jobs", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSuggestTerms = async () => {
        if (!aiBusiness.trim() || !aiProduct.trim()) {
            toast({ title: "Preencha seu negócio e o que vende", variant: "destructive" });
            return;
        }
        setSuggesting(true);
        try {
            const terms = await aiApi.suggestTerms({ business: aiBusiness, product: aiProduct });
            if (!terms || terms.length === 0) throw new Error("Sem sugestões retornadas");
            setSuggestedTerms(terms);
            toast({ title: "Termos sugeridos com sucesso!" });
        } catch (error) {
            toast({ title: "Erro ao gerar sugestões", variant: "destructive" });
        } finally {
            setSuggesting(false);
        }
    };

    const handleCreateJob = async () => {
        if (!selectedSource) {
            toast({ title: "Selecione uma fonte", variant: "destructive" });
            return;
        }


        const requiredFields = REQUIRED_FIELDS[selectedSource as ScrapingSource] || [];
        const missingFields = requiredFields.filter((field) => {
            if (field === "cnpj") {
                return !parseListInput(formData.cnpj);
            }
            if (field === "urls") {
                return !parseListInput(formData.urls);
            }
            return !formData[field].trim();
        });

        if (missingFields.length > 0) {
            toast({
                title: "Preencha os campos obrigatorios",
                description: missingFields.map((field) => FIELD_LABELS[field]).join(", "),
                variant: "destructive",
            });
            return;
        }

        const limitValue = formData.limit.trim();
        if (limitValue) {
            const parsed = Number(limitValue);
            if (Number.isNaN(parsed) || parsed <= 0) {
                toast({
                    title: "Limite invalido",
                    description: "Use um numero maior que zero.",
                    variant: "destructive",
                });
                return;
            }
        }

        setCreating(true);
        try {
            const query = buildQueryPayload(selectedSource as ScrapingSource, formData);

            await scrapingApi.createJob({
                name: jobName || undefined,
                source: selectedSource as ScrapingSource,
                query,
            });

            toast({ title: "Tarefa criada com sucesso!" });
            setShowWizard(false);
            setWizardStep(1);
            setSelectedSource("");
            setJobName("");
            setFormData(DEFAULT_FORM_STATE);
            loadJobs();
        } catch (error) {
            toast({
                title: "Erro ao criar tarefa",
                description: error instanceof Error ? error.message : "Erro desconhecido",
                variant: "destructive",
            });
        } finally {
            setCreating(false);
        }
    };

    return (
        <AppLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Descoberta de Leads</h1>
                        <p className="text-muted-foreground">
                            Descubra leads em multiplas fontes com coleta estruturada
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={loadJobs}>
                            <IconRefresh className="h-4 w-4" />
                        </Button>
                        <Button onClick={() => setShowWizard(true)}>
                            <IconPlus className="mr-2 h-4 w-4" />
                            Nova tarefa
                        </Button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Total de tarefas</CardDescription>
                            <CardTitle className="text-3xl">
                                {jobs.length}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Em Execucao</CardDescription>
                            <CardTitle className="text-3xl">
                                {jobs.filter((j) => j.status === "RUNNING").length}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Concluidos</CardDescription>
                            <CardTitle className="text-3xl">
                                {jobs.filter((j) => j.status === "COMPLETED").length}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Leads Criados</CardDescription>
                            <CardTitle className="text-3xl">
                                {jobs.reduce((sum, j) => sum + j.leadsCreated, 0)}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                </div>

                {/* Tabela de tarefas */}
                <Card>
                    <CardHeader>
                        <CardTitle>Tarefas de descoberta</CardTitle>
                        <CardDescription>Historico e status das suas tarefas</CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nome/Fonte</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Progresso</TableHead>
                                    <TableHead>Leads</TableHead>
                                    <TableHead>Criado</TableHead>
                                    <TableHead className="text-right">Acoes</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            Carregando tarefas...
                                        </TableCell>
                                    </TableRow>
                                ) : jobs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            Nenhuma tarefa encontrada.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    jobs.map((job) => {
                                        const config = STATUS_CONFIG[job.status];
                                        const Icon = config.icon;
                                        const sourceInfo = SOURCE_INFO[job.source];

                                        return (
                                            <TableRow key={job.id}>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{job.name}</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {sourceInfo?.label || job.source}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={config.variant} className="gap-1">
                                                        <Icon className="h-3 w-3" />
                                                        {config.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {job.status === "RUNNING" || job.progress > 0 ? (
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <Progress value={job.progress} className="w-24" />
                                                                <span className="text-xs text-muted-foreground">
                                                                    {job.progress}%
                                                                </span>
                                                            </div>
                                                            <span className="block text-[11px] text-muted-foreground">
                                                                {job.processedItems} / {job.totalItems || "?"} itens
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-mono text-sm">
                                                        {job.leadsCreated}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {formatDistanceToNow(new Date(job.createdAt), {
                                                        addSuffix: true,
                                                        locale: ptBR,
                                                    })}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => router.push(`/scraping/${job.id}`)}
                                                    >
                                                        <IconEye className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* Assistente de criacao de tarefa */}
            <Dialog open={showWizard} onOpenChange={setShowWizard}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Nova tarefa de descoberta</DialogTitle>
                        <DialogDescription>
                            Passo {wizardStep} de 2: {wizardStep === 1 ? "Selecione a fonte" : "Configure os parametros"}
                        </DialogDescription>
                    </DialogHeader>

                    {wizardStep === 1 && (
                        <div className="space-y-3">
                            {NO_API_MODE && (
                                <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                                    Modo sem API: usamos scraping direto dos sites, pode ser instavel.
                                </div>
                            )}
                            <div className="grid grid-cols-3 gap-3">
                                {Object.entries(SOURCE_INFO).map(([key, info]) => {
                                    const Icon = info.icon;

                                    return (
                                        <button
                                            key={key}
                                            onClick={() => {
                                                setSelectedSource(key as ScrapingSource);
                                                setFormData(DEFAULT_FORM_STATE);
                                            }}
                                            className={cn(
                                                "flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-all hover:border-primary",
                                                selectedSource === key && "border-primary bg-primary/5"
                                            )}
                                        >
                                            <Icon className="h-8 w-8" />
                                            <span className="font-medium text-sm">{info.label}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {info.description}
                                            </span>
                                            {NO_API_MODE && (
                                                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                                    Sem API
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {wizardStep === 2 && (
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="job-name">Nome da tarefa (opcional)</Label>
                                <Input
                                    id="job-name"
                                    placeholder="Ex: Restaurantes SP"
                                    value={jobName}
                                    onChange={(e) => setJobName(e.target.value)}
                                />
                            </div>

                            {selectedSource ? (
                                <div className="space-y-4">
                                    {(REQUIRED_FIELDS[selectedSource as ScrapingSource]?.includes("query")) && (
                                        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                                            <div className="flex items-center gap-2 text-primary font-medium">
                                                <IconSparkles className="h-5 w-5" />
                                                <h3>Assistente de Busca IA</h3>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Descreva seu negócio e produto para a IA sugerir os melhores termos de busca B2B para encontrar leads qualificados.
                                            </p>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Label className="text-xs">Meu negócio / Empresa</Label>
                                                    <Input
                                                        placeholder="Ex: Agência de Marketing"
                                                        value={aiBusiness}
                                                        onChange={(e) => setAiBusiness(e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs">O que eu vendo</Label>
                                                    <Input
                                                        placeholder="Ex: Consultoria em SEO"
                                                        value={aiProduct}
                                                        onChange={(e) => setAiProduct(e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="w-full text-xs"
                                                onClick={handleSuggestTerms}
                                                disabled={suggesting}
                                            >
                                                {suggesting ? "Sugerindo..." : "Gerar novos termos"}
                                            </Button>

                                            {suggestedTerms.length > 0 && (
                                                <div className="flex flex-wrap gap-2 pt-2 border-t border-primary/10">
                                                    {suggestedTerms.map((term, i) => (
                                                        <Badge
                                                            key={i}
                                                            variant="secondary"
                                                            className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                                                            onClick={() => setFormData((prev) => ({ ...prev, query: term }))}
                                                        >
                                                            {term}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {SOURCE_FIELDS[selectedSource as ScrapingSource].map((field) => {
                                        const fieldId = `field-${field.key}`;
                                        const value = formData[field.key] ?? "";

                                        return (
                                            <div key={field.key}>
                                                <Label htmlFor={fieldId}>
                                                    {field.label}
                                                    {field.required ? " *" : ""}
                                                </Label>
                                                {field.type === "textarea" ? (
                                                    <Textarea
                                                        id={fieldId}
                                                        value={value}
                                                        onChange={(e) =>
                                                            setFormData((prev) => ({
                                                                ...prev,
                                                                [field.key]: e.target.value,
                                                            }))
                                                        }
                                                        placeholder={field.placeholder}
                                                        className="text-sm"
                                                    />
                                                ) : (
                                                    <Input
                                                        id={fieldId}
                                                        type={field.type ?? "text"}
                                                        value={value}
                                                        onChange={(e) =>
                                                            setFormData((prev) => ({
                                                                ...prev,
                                                                [field.key]: e.target.value,
                                                            }))
                                                        }
                                                        placeholder={field.placeholder}
                                                        min={field.type === "number" ? 1 : undefined}
                                                    />
                                                )}
                                                {field.helper && (
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {field.helper}
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}

                                    <details className="rounded-md border bg-muted/20 p-3">
                                        <summary className="cursor-pointer text-sm text-muted-foreground">
                                            Ver JSON (avancado)
                                        </summary>
                                        <pre className="mt-2 text-xs overflow-auto font-mono">
                                            {JSON.stringify(
                                                buildQueryPayload(
                                                    selectedSource as ScrapingSource,
                                                    formData
                                                ),
                                                null,
                                                2
                                            )}
                                        </pre>
                                    </details>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Selecione uma fonte no passo anterior.
                                </p>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        {wizardStep === 2 && (
                            <Button variant="outline" onClick={() => setWizardStep(1)}>
                                Voltar
                            </Button>
                        )}
                        {wizardStep === 1 ? (
                            <Button onClick={() => setWizardStep(2)} disabled={!selectedSource}>
                                Proximo
                            </Button>
                        ) : (
                            <Button onClick={handleCreateJob} disabled={creating}>
                                {creating ? "Criando..." : "Criar tarefa"}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}



