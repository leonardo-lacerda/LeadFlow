"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import {
    IconArrowLeft,
    IconBrandLinkedin,
    IconBrandWhatsapp,
    IconBuilding,
    IconMail,
    IconMapPin,
    IconPhone,
    IconEdit,
    IconPlus,
    IconX,
} from "@tabler/icons-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useMemo, useState } from "react";
import { leadsApi, Lead, LeadInput } from "@/lib/leads-api";
import { notesApi, LeadNote } from "@/lib/notes-api";
import { useToast } from "@/hooks/use-toast";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inboxApi } from "@/lib/inbox-api";
import { EnrichmentCard } from "@/components/leads/enrichment-card";
import { LeadTemperatureBadge } from "@/components/leads/lead-temperature";

interface LeadActivity {
    id: string;
    description: string;
    createdAt: string;
    type: string;
}

interface LeadMessage {
    id: string;
    content: string;
    createdAt: string;
    direction: string;
    type: string;
    subject?: string | null;
}

interface LeadDetails extends Lead {
    city?: string | null;
    state?: string | null;
    linkedinUrl?: string | null;
    activities?: LeadActivity[];
    messages?: LeadMessage[];
}

type LeadEnrichmentData = {
    website?: unknown;
    socials?: unknown;
    maps?: unknown;
    contacts?: unknown;
};

const STATUS_OPTIONS = [
    "NEW",
    "ENRICHING",
    "ENRICHED",
    "CONTACTED",
    "REPLIED",
    "INTERESTED",
    "MEETING_SCHEDULED",
    "CONVERTED",
    "NOT_INTERESTED",
    "BOUNCED",
    "UNSUBSCRIBED",
];

const LEAD_STATUS_LABELS: Record<string, string> = {
    NEW: "Novo",
    ENRICHING: "Enriquecendo",
    ENRICHED: "Enriquecido",
    CONTACTED: "Contatado",
    REPLIED: "Respondeu",
    INTERESTED: "Interessado",
    MEETING_SCHEDULED: "Reuniao agendada",
    CONVERTED: "Convertido",
    NOT_INTERESTED: "Sem interesse",
    BOUNCED: "Erro de entrega",
    UNSUBSCRIBED: "Descadastrado",
};

const MESSAGE_TYPE_LABELS: Record<string, string> = {
    EMAIL: "Email",
    WHATSAPP: "WhatsApp",
};

const MESSAGE_DIRECTION_LABELS: Record<string, string> = {
    INBOUND: "Entrada",
    OUTBOUND: "Saida",
};

export default function LeadDetailsPage() {
    const params = useParams<{ id: string | string[] }>();
    const leadId = Array.isArray(params.id) ? params.id[0] : params.id;
    const { toast } = useToast();
    const [editOpen, setEditOpen] = useState(false);
    const [editForm, setEditForm] = useState({
        fullName: "",
        email: "",
        companyName: "",
        jobTitle: "",
    });
    const [noteText, setNoteText] = useState("");
    const [notes, setNotes] = useState<LeadNote[]>([]);
    const [notesLoading, setNotesLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [messageModal, setMessageModal] = useState<{
        open: boolean;
        channel: "EMAIL" | "WHATSAPP";
    }>({ open: false, channel: "EMAIL" });
    const [messageSubject, setMessageSubject] = useState("");
    const [messageContent, setMessageContent] = useState("");
    const [newTag, setNewTag] = useState("");

    const { data: lead, isLoading, refetch } = useQuery({
        queryKey: ["lead", leadId],
        queryFn: async () => {
            if (!leadId) {
                throw new Error("Lead id ausente");
            }
            const response = await leadsApi.getById(leadId);
            return response as LeadDetails;
        },
        enabled: !!leadId,
    });

    const initials = useMemo(() => {
        if (!lead?.fullName) return "";
        return lead.fullName
            .split(" ")
            .map((p) => p[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();
    }, [lead?.fullName]);

    const enriched = useMemo(() => {
        const data = (lead?.enrichmentData || {}) as LeadEnrichmentData;
        const maps = (data.maps || {}) as Record<string, unknown>;
        const socialsRaw = (data.socials || {}) as Record<string, unknown>;
        const contactsRaw = (data.contacts || {}) as Record<string, unknown>;

        const website =
            typeof data.website === "string" && data.website.length > 0 ? data.website : null;
        const mapCandidates = [
            typeof maps.url === "string" && maps.url.length > 0 ? maps.url : null,
            typeof maps.rawUrl === "string" && maps.rawUrl.length > 0 ? maps.rawUrl : null,
            typeof maps.osmUrl === "string" && maps.osmUrl.length > 0 ? maps.osmUrl : null,
            lead?.source === "google_maps" && typeof lead.sourceUrl === "string" && lead.sourceUrl.length > 0
                ? lead.sourceUrl
                : null,
        ];
        const mapUrl =
            mapCandidates.find(
                (url): url is string =>
                    !!url &&
                    /(maps\.google|google\.[^/]+\/maps|openstreetmap\.org)/i.test(url)
            ) || null;

        const socials = Object.entries(socialsRaw).filter(
            ([, value]) => typeof value === "string" && value.length > 0
        ) as Array<[string, string]>;

        const emails = Array.isArray(contactsRaw.emails)
            ? contactsRaw.emails.filter((item): item is string => typeof item === "string")
            : [];
        const phones = Array.isArray(contactsRaw.phones)
            ? contactsRaw.phones.filter((item): item is string => typeof item === "string")
            : [];

        return { website, mapUrl, socials, emails, phones };
    }, [lead?.enrichmentData, lead?.source, lead?.sourceUrl]);

    const scoreDimensions = useMemo(() => {
        if (!lead?.scoreBreakdown) {
            return [];
        }

        return [
            {
                key: "enrichment",
                label: "Enriquecimento",
                value: lead.scoreBreakdown.enrichment,
                max: 25,
            },
            {
                key: "interaction",
                label: "Interacao",
                value: lead.scoreBreakdown.interaction,
                max: 30,
            },
            {
                key: "timing",
                label: "Timing",
                value: lead.scoreBreakdown.timing,
                max: 20,
            },
            {
                key: "icp",
                label: "ICP Fit",
                value: lead.scoreBreakdown.icp,
                max: 25,
            },
        ];
    }, [lead?.scoreBreakdown]);

    const loadNotes = async () => {
        if (!lead?.id) return;
        setNotesLoading(true);
        try {
            const data = await notesApi.list(lead.id);
            setNotes(data);
        } catch (error) {
            console.error(error);
        } finally {
            setNotesLoading(false);
        }
    };

    const handleSaveNote = async () => {
        if (!lead?.id || !noteText.trim()) return;
        try {
            const created = await notesApi.create(lead.id, noteText.trim());
            setNotes((prev) => [created, ...prev]);
            setNoteText("");
        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao salvar nota", variant: "destructive" });
        }
    };

    const handleStatusChange = async (value: string) => {
        if (!lead?.id) return;
        try {
            await leadsApi.update(lead.id, { status: value } as Partial<LeadInput>);
            refetch();
        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao atualizar status", variant: "destructive" });
        }
    };

    const openEdit = () => {
        setEditForm({
            fullName: lead?.fullName || "",
            email: lead?.email || "",
            companyName: lead?.companyName || "",
            jobTitle: lead?.jobTitle || "",
        });
        setEditOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!lead?.id) return;
        try {
            await leadsApi.update(lead.id, editForm);
            toast({ title: "Lead atualizado" });
            setEditOpen(false);
            refetch();
        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao atualizar lead", variant: "destructive" });
        }
    };

    const handleSaveTag = async () => {
        if (!lead?.id || !newTag.trim()) return;
        const updatedTags = Array.from(new Set([...(lead.tags || []), newTag.trim()]));
        try {
            await leadsApi.update(lead.id, { tags: updatedTags } as Partial<LeadInput>);
            setNewTag("");
            refetch();
        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao adicionar tag", variant: "destructive" });
        }
    };

    const handleRemoveTag = async (tag: string) => {
        if (!lead?.id) return;
        const updatedTags = (lead.tags || []).filter((t) => t !== tag);
        try {
            await leadsApi.update(lead.id, { tags: updatedTags } as Partial<LeadInput>);
            refetch();
        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao remover tag", variant: "destructive" });
        }
    };

    const handleSendMessage = async () => {
        if (!lead?.id || !messageContent.trim()) return;
        setSending(true);
        try {
            await inboxApi.sendMessage(lead.id, {
                content: messageContent,
                type: messageModal.channel,
                subject: messageModal.channel === "EMAIL" ? messageSubject : undefined,
            });
            toast({ title: "Mensagem enviada" });
            setMessageContent("");
            setMessageSubject("");
            setMessageModal({ open: false, channel: "EMAIL" });
        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao enviar mensagem", variant: "destructive" });
        } finally {
            setSending(false);
        }
    };

    if (isLoading) {
        return (
            <AppLayout>
                <div className="flex-1 p-8 pt-6 flex items-center justify-center">
                    <p>Carregando...</p>
                </div>
            </AppLayout>
        );
    }

    if (!lead) {
        return (
            <AppLayout>
                <div className="flex-1 p-8 pt-6 flex flex-col items-center justify-center gap-4">
                    <p>Lead nao encontrado</p>
                    <Button asChild>
                        <Link href="/leads">Voltar para Leads</Link>
                    </Button>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center gap-4 flex-wrap">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/leads">
                            <IconArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <h2 className="text-3xl font-bold tracking-tight">{lead.fullName}</h2>
                    <Badge>{LEAD_STATUS_LABELS[lead.status] || lead.status}</Badge>
                    {lead.temperature && <LeadTemperatureBadge temperature={lead.temperature} />}
                    <Select value={lead.status} onValueChange={handleStatusChange}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            {STATUS_OPTIONS.map((status) => (
                                <SelectItem key={status} value={status}>
                                    {LEAD_STATUS_LABELS[status] || status}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={openEdit}>
                        <IconEdit className="mr-2 h-4 w-4" /> Editar
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="md:col-span-1">
                        <CardHeader>
                            <div className="flex items-center gap-4">
                                <Avatar className="h-16 w-16">
                                    <AvatarImage src={`https://ui-avatars.com/api/?name=${lead.fullName}`} />
                                    <AvatarFallback>{initials}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <CardTitle>{lead.fullName}</CardTitle>
                                    <CardDescription>{lead.jobTitle}</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <IconMail className="h-4 w-4" />
                                    <span>{lead.email}</span>
                                </div>
                                {lead.phone && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <IconPhone className="h-4 w-4" />
                                        <span>{lead.phone}</span>
                                    </div>
                                )}
                                {lead.linkedinUrl && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <IconBrandLinkedin className="h-4 w-4" />
                                        <a href={lead.linkedinUrl} target="_blank" rel="noreferrer" className="hover:underline">
                                            LinkedIn
                                        </a>
                                    </div>
                                )}
                                {enriched.website && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <IconBuilding className="h-4 w-4" />
                                        <a href={enriched.website} target="_blank" rel="noreferrer" className="hover:underline">
                                            Site da empresa
                                        </a>
                                    </div>
                                )}
                                {enriched.mapUrl && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <IconMapPin className="h-4 w-4" />
                                        <a href={enriched.mapUrl} target="_blank" rel="noreferrer" className="hover:underline">
                                            Abrir no mapa
                                        </a>
                                    </div>
                                )}
                                {enriched.emails
                                    .filter((email) => email !== lead.email)
                                    .slice(0, 2)
                                    .map((email) => (
                                        <div key={email} className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <IconMail className="h-4 w-4" />
                                            <span>{email}</span>
                                        </div>
                                    ))}
                                {enriched.phones
                                    .filter((phone) => phone !== lead.phone)
                                    .slice(0, 2)
                                    .map((phone) => (
                                        <div key={phone} className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <IconPhone className="h-4 w-4" />
                                            <span>{phone}</span>
                                        </div>
                                    ))}
                                {enriched.socials.slice(0, 4).map(([network, url]) => (
                                    <div key={`${network}-${url}`} className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <IconBrandLinkedin className="h-4 w-4" />
                                        <a href={url} target="_blank" rel="noreferrer" className="hover:underline">
                                            {network}
                                        </a>
                                    </div>
                                ))}
                            </div>

                            <Separator />

                            <div className="space-y-2">
                                <h4 className="font-semibold text-sm">Empresa</h4>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <IconBuilding className="h-4 w-4" />
                                    <span>{lead.companyName}</span>
                                </div>
                                {(lead.city || lead.state) && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <IconMapPin className="h-4 w-4" />
                                        <span>{lead.city}, {lead.state}</span>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 flex gap-2">
                                <Button className="w-full" onClick={() => setMessageModal({ open: true, channel: "EMAIL" })}>
                                    <IconMail className="mr-2 h-4 w-4" /> Email
                                </Button>
                                <Button variant="outline" className="w-full" onClick={() => setMessageModal({ open: true, channel: "WHATSAPP" })}>
                                    <IconBrandWhatsapp className="mr-2 h-4 w-4" /> WhatsApp
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="md:col-span-2">
                        <Card className="mb-4">
                            <CardHeader>
                                <CardTitle>Lead Intelligence</CardTitle>
                                <CardDescription>Score atual e composicao em 4 dimensoes.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-4xl font-bold">{lead.score ?? 0}</span>
                                    {lead.temperature && (
                                        <LeadTemperatureBadge temperature={lead.temperature} />
                                    )}
                                </div>
                                {scoreDimensions.length > 0 ? (
                                    <div className="space-y-3">
                                        {scoreDimensions.map((dimension) => {
                                            const pct = Math.max(
                                                0,
                                                Math.min(100, (dimension.value / dimension.max) * 100)
                                            );
                                            return (
                                                <div key={dimension.key} className="space-y-1">
                                                    <div className="flex items-center justify-between text-sm">
                                                        <span>{dimension.label}</span>
                                                        <span className="font-medium">
                                                            {dimension.value}/{dimension.max}
                                                        </span>
                                                    </div>
                                                    <div className="h-2 rounded bg-muted">
                                                        <div
                                                            className="h-2 rounded bg-primary transition-all"
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        Score breakdown ainda nao calculado para este lead.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                        <div className="mb-4">
                            <EnrichmentCard lead={lead} />
                        </div>
                        <Tabs defaultValue="activity">
                            <TabsList>
                                <TabsTrigger value="activity">Atividade</TabsTrigger>
                                <TabsTrigger value="notes" onClick={loadNotes}>Notas</TabsTrigger>
                                <TabsTrigger value="emails">Mensagens</TabsTrigger>
                            </TabsList>
                            <TabsContent value="activity" className="space-y-4 mt-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Linha do tempo</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-8">
                                            {lead.activities && lead.activities.length > 0 ? (
                                                lead.activities.map((activity) => (
                                                    <div key={activity.id} className="flex gap-4">
                                                        <div className="relative mt-1">
                                                            <div className="h-2 w-2 rounded-full bg-primary ring-4 ring-background" />
                                                            <div className="absolute left-1 top-3 h-full w-[1px] -translate-x-1/2 bg-border" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-sm font-medium leading-none">
                                                                {activity.description}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {formatDate(activity.createdAt)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-sm text-muted-foreground">Nenhuma atividade recente.</p>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="notes" className="space-y-4 mt-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Notas</CardTitle>
                                        <CardDescription>Registre observacoes importantes sobre o lead.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="Adicionar nota..."
                                                value={noteText}
                                                onChange={(e) => setNoteText(e.target.value)}
                                            />
                                            <Button onClick={handleSaveNote}>
                                                <IconPlus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        {notesLoading ? (
                                            <p className="text-sm text-muted-foreground">Carregando notas...</p>
                                        ) : notes.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">Nenhuma nota registrada.</p>
                                        ) : (
                                            <div className="space-y-3">
                                                {notes.map((note) => (
                                                    <div key={note.id} className="p-3 border rounded-md">
                                                        <p className="text-sm">{note.content}</p>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            {formatDate(note.createdAt)}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="emails" className="space-y-4 mt-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Mensagens</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {lead.messages && lead.messages.length > 0 ? (
                                                lead.messages.map((msg) => (
                                                    <div key={msg.id} className="p-3 border rounded-md">
                                                        <p className="text-xs text-muted-foreground">
                                                            {MESSAGE_TYPE_LABELS[msg.type] || msg.type} -{" "}
                                                            {MESSAGE_DIRECTION_LABELS[msg.direction] || msg.direction} -{" "}
                                                            {formatDate(msg.createdAt)}
                                                        </p>
                                                        {msg.subject && <p className="font-medium">{msg.subject}</p>}
                                                        <p className="text-sm text-muted-foreground">{msg.content}</p>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-sm text-muted-foreground">Nenhuma mensagem registrada.</p>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Tags</CardTitle>
                        <CardDescription>Organize leads com etiquetas personalizadas.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-2">
                            <Input
                                placeholder="Nova tag"
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                            />
                            <Button onClick={handleSaveTag}>
                                <IconPlus className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {lead.tags && lead.tags.length > 0 ? (
                                lead.tags.map((tag) => (
                                    <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                                        {tag}
                                        <button onClick={() => handleRemoveTag(tag)}>
                                            <IconX className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground">Nenhuma tag.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Modal de edicao */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md w-11/12">
                    <DialogHeader>
                        <DialogTitle>Editar Lead</DialogTitle>
                        <DialogDescription>Atualize os dados do lead.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Nome</Label>
                            <Input
                                value={editForm.fullName}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, fullName: e.target.value }))}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Email</Label>
                            <Input
                                value={editForm.email}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Empresa</Label>
                            <Input
                                value={editForm.companyName}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, companyName: e.target.value }))}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Cargo</Label>
                            <Input
                                value={editForm.jobTitle}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, jobTitle: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)}>
                            Fechar
                        </Button>
                        <Button onClick={handleSaveEdit}>Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de envio de mensagem */}
            <Dialog open={messageModal.open} onOpenChange={(open) => setMessageModal((prev) => ({ ...prev, open }))}>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md w-11/12">
                    <DialogHeader>
                        <DialogTitle>
                            Enviar {messageModal.channel === "EMAIL" ? "Email" : "WhatsApp"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        {messageModal.channel === "EMAIL" && (
                            <div>
                                <Label>Assunto</Label>
                                <Input value={messageSubject} onChange={(e) => setMessageSubject(e.target.value)} />
                            </div>
                        )}
                        <div>
                            <Label>Mensagem</Label>
                            <Textarea
                                value={messageContent}
                                onChange={(e) => setMessageContent(e.target.value)}
                                placeholder="Digite sua mensagem"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMessageModal({ open: false, channel: "EMAIL" })}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSendMessage} disabled={sending}>
                            {sending ? "Enviando..." : "Enviar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}


