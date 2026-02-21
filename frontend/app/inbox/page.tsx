"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { InboxConversation, inboxApi } from "@/lib/inbox-api";
import { signalsApi } from "@/lib/signals-api";
import { LeadTemperatureBadge } from "@/components/leads/lead-temperature";
import { ObjectionBadge } from "@/components/inbox/objection-badge";
import { HotLeadAlert } from "@/components/inbox/hot-lead-alert";
import { ReplySuggestions } from "@/components/inbox/reply-suggestions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    IconBrandWhatsapp,
    IconMail,
    IconSearch,
    IconSend,
    IconBolt,
} from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

function getInitials(name: string) {
    return name
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

const WEEKDAY_LABEL: Record<string, string> = {
    monday: "Seg",
    tuesday: "Ter",
    wednesday: "Qua",
    thursday: "Qui",
    friday: "Sex",
    saturday: "Sab",
    sunday: "Dom",
};

export default function InboxPage() {
    const [selectedLead, setSelectedLead] = useState<string | null>(() => {
        if (typeof window === "undefined") {
            return null;
        }
        const params = new URLSearchParams(window.location.search);
        return params.get("leadId");
    });
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"UNREAD" | "ALL">("ALL");
    const [channelFilter, setChannelFilter] = useState<"EMAIL" | "WHATSAPP" | undefined>();
    const [messageContent, setMessageContent] = useState("");
    const [messageSubject, setMessageSubject] = useState("");
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: conversationsData, isLoading: conversationsLoading } = useQuery({
        queryKey: ["inbox", "conversations", search, statusFilter, channelFilter],
        queryFn: () =>
            inboxApi.listConversations({
                search,
                status: statusFilter,
                channel: channelFilter,
            }),
        refetchInterval: 20000,
    });

    const conversations = conversationsData?.conversations || [];

    const { data: threadData, isLoading: threadLoading } = useQuery({
        queryKey: ["inbox", "thread", selectedLead],
        queryFn: () => inboxApi.getThread(selectedLead!),
        enabled: !!selectedLead,
        refetchInterval: 20000,
    });

    const { data: intelligenceData } = useQuery({
        queryKey: ["inbox", "intelligence", selectedLead],
        queryFn: () => inboxApi.getIntelligence(selectedLead!),
        enabled: !!selectedLead,
        refetchInterval: 20000,
    });

    const { data: signalRecommendation } = useQuery({
        queryKey: ["signals", "lead-recommendation", selectedLead],
        queryFn: () => signalsApi.getLeadRecommendation(selectedLead!),
        enabled: !!selectedLead,
        refetchInterval: 20000,
    });

    const { data: signalAlerts } = useQuery({
        queryKey: ["signals", "alerts", "inbox"],
        queryFn: () => signalsApi.getActionableAlerts(5),
        refetchInterval: 30000,
    });

    const sendMessageMutation = useMutation({
        mutationFn: (data: { content: string; type: "EMAIL" | "WHATSAPP"; subject?: string }) =>
            inboxApi.sendMessage(selectedLead!, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["inbox", "thread", selectedLead] });
            queryClient.invalidateQueries({ queryKey: ["inbox", "conversations"] });
            queryClient.invalidateQueries({ queryKey: ["inbox", "intelligence", selectedLead] });
            setMessageContent("");
            setMessageSubject("");
        },
    });

    const markAsReadMutation = useMutation({
        mutationFn: (leadId: string) => inboxApi.markAsRead(leadId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["inbox", "conversations"] });
        },
    });

    const handleSelectConversation = (conversation: InboxConversation) => {
        setSelectedLead(conversation.lead.id);
        const params = new URLSearchParams(window.location.search);
        params.set("leadId", conversation.lead.id);
        window.history.replaceState({}, "", `/inbox?${params.toString()}`);

        if (conversation.unreadCount > 0) {
            markAsReadMutation.mutate(conversation.lead.id);
        }
    };

    const handleSendMessage = () => {
        if (!messageContent.trim() || !selectedLead || !threadData) {
            return;
        }

        const latestType = threadData.messages[threadData.messages.length - 1]?.type;
        const messageType =
            latestType || (threadData.lead.email ? "EMAIL" : "WHATSAPP");

        sendMessageMutation.mutate({
            content: messageContent,
            type: messageType,
            subject: messageType === "EMAIL" ? messageSubject : undefined,
        });
    };

    const handleUseSuggestion = (content: string) => {
        setMessageContent((previous) => (previous.trim() ? `${previous}\n\n${content}` : content));
        toast({
            title: "Sugestao aplicada",
            description: "A sugestao foi adicionada na caixa de mensagem.",
        });
    };

    return (
        <AppLayout>
            <div className="flex h-[calc(100vh-4rem)]">
                <div className="w-96 border-r bg-white dark:bg-neutral-900 flex flex-col">
                    <div className="p-4 border-b space-y-3">
                        <h2 className="text-xl font-bold">Caixa de entrada</h2>

                        <div className="relative">
                            <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar conversas..."
                                className="pl-9"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                            />
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant={statusFilter === "ALL" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setStatusFilter("ALL")}
                            >
                                Todas
                            </Button>
                            <Button
                                variant={statusFilter === "UNREAD" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setStatusFilter("UNREAD")}
                            >
                                Nao lidas
                            </Button>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant={!channelFilter ? "default" : "outline"}
                                size="sm"
                                onClick={() => setChannelFilter(undefined)}
                            >
                                Todos
                            </Button>
                            <Button
                                variant={channelFilter === "EMAIL" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setChannelFilter("EMAIL")}
                            >
                                Email
                            </Button>
                            <Button
                                variant={channelFilter === "WHATSAPP" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setChannelFilter("WHATSAPP")}
                            >
                                WhatsApp
                            </Button>
                        </div>
                    </div>

                    <ScrollArea className="flex-1">
                        {conversationsLoading ? (
                            <div className="p-4 text-center text-muted-foreground">Carregando...</div>
                        ) : conversations.length === 0 ? (
                            <div className="p-4 text-center text-muted-foreground">
                                Nenhuma conversa encontrada
                            </div>
                        ) : (
                            <div>
                                {conversations.map((conversation) => (
                                    <button
                                        key={conversation.lead.id}
                                        type="button"
                                        onClick={() => handleSelectConversation(conversation)}
                                        className={cn(
                                            "w-full p-4 text-left hover:bg-muted/50 transition-colors border-b",
                                            selectedLead === conversation.lead.id && "bg-muted",
                                            conversation.unreadCount > 0 &&
                                                "bg-blue-50/50 dark:bg-blue-900/10"
                                        )}
                                    >
                                        <div className="flex items-start gap-3">
                                            <Avatar>
                                                <AvatarFallback>
                                                    {getInitials(conversation.lead.fullName || "Lead")}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                    <span
                                                        className={cn(
                                                            "font-medium text-sm truncate",
                                                            conversation.unreadCount > 0 && "font-bold"
                                                        )}
                                                    >
                                                        {conversation.lead.fullName || "Sem nome"}
                                                    </span>
                                                    {conversation.unreadCount > 0 && (
                                                        <Badge
                                                            variant="default"
                                                            className="h-5 min-w-5 justify-center rounded-full px-1.5 text-xs"
                                                        >
                                                            {conversation.unreadCount}
                                                        </Badge>
                                                    )}
                                                </div>

                                                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                                                    {conversation.lead.temperature && (
                                                        <LeadTemperatureBadge
                                                            temperature={conversation.lead.temperature}
                                                            className="h-5"
                                                        />
                                                    )}
                                                    {conversation.lead.temperature === "HOT" &&
                                                        conversation.lastMessage?.direction === "INBOUND" && (
                                                            <Badge className="h-5 border-red-300 bg-red-100 text-red-800">
                                                                Resposta quente
                                                            </Badge>
                                                        )}
                                                </div>

                                                {conversation.lead.companyName && (
                                                    <div className="text-xs text-muted-foreground mb-1 truncate">
                                                        {conversation.lead.companyName}
                                                    </div>
                                                )}

                                                {conversation.lastMessage && (
                                                    <>
                                                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                                            {conversation.lastMessage.type === "EMAIL" ? (
                                                                <IconMail className="h-3 w-3" />
                                                            ) : (
                                                                <IconBrandWhatsapp className="h-3 w-3" />
                                                            )}
                                                            <span>
                                                                {formatDistanceToNow(
                                                                    new Date(
                                                                        conversation.lastMessage.createdAt
                                                                    ),
                                                                    {
                                                                        addSuffix: true,
                                                                        locale: ptBR,
                                                                    }
                                                                )}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground truncate">
                                                            {conversation.lastMessage.content}
                                                        </p>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>

                <div className="flex-1 flex flex-col bg-gray-50 dark:bg-neutral-950">
                    {!selectedLead ? (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground">
                            <div className="text-center">
                                <IconMail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p>Selecione uma conversa para visualizar.</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="p-4 bg-white dark:bg-neutral-900 border-b">
                                {threadLoading ? (
                                    <div>Carregando...</div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10">
                                            <AvatarFallback>
                                                {getInitials(threadData?.lead?.fullName || "Lead")}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                            <h3 className="font-semibold truncate">
                                                {threadData?.lead?.fullName || "Sem nome"}
                                            </h3>
                                            <div className="text-sm text-muted-foreground truncate">
                                                {threadData?.lead?.email || threadData?.lead?.whatsapp || "Sem contato"}
                                                {threadData?.lead?.companyName
                                                    ? ` | ${threadData.lead.companyName}`
                                                    : ""}
                                            </div>
                                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                                {intelligenceData?.temperature && (
                                                    <LeadTemperatureBadge
                                                        temperature={intelligenceData.temperature}
                                                    />
                                                )}
                                                {signalRecommendation && (
                                                    <Badge variant="outline">
                                                        Score {signalRecommendation.sharedScore}
                                                    </Badge>
                                                )}
                                                {signalRecommendation && (
                                                    <Badge variant="outline">
                                                        {signalRecommendation.recommendedChannel === "whatsapp"
                                                            ? "Canal: WhatsApp"
                                                            : "Canal: Email"}
                                                    </Badge>
                                                )}
                                                {signalRecommendation && (
                                                    <Badge variant="outline">
                                                        Janela: {WEEKDAY_LABEL[signalRecommendation.bestWindow.dayOfWeek] || signalRecommendation.bestWindow.dayOfWeek}{" "}
                                                        {String(signalRecommendation.bestWindow.hour).padStart(2, "0")}h
                                                    </Badge>
                                                )}
                                                <ObjectionBadge
                                                    objection={intelligenceData?.objection || null}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <ScrollArea className="flex-1 p-4">
                                <div className="space-y-4">
                                    <HotLeadAlert
                                        hotLead={Boolean(intelligenceData?.hotLead)}
                                        leadName={threadData?.lead?.fullName || undefined}
                                        followup={intelligenceData?.followup}
                                    />

                                    {signalAlerts && signalAlerts.length > 0 && (
                                        <div className="rounded-lg border bg-white dark:bg-neutral-900 p-3">
                                            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                                                <IconBolt className="h-4 w-4 text-amber-500" />
                                                Alertas acionaveis da rede
                                            </div>
                                            <div className="space-y-2">
                                                {signalAlerts.slice(0, 3).map((alert) => (
                                                    <div key={alert.id} className="rounded-md border p-2">
                                                        <div className="text-sm font-medium">{alert.title}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {alert.recommendedAction}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {threadLoading ? (
                                        <div className="text-center text-muted-foreground">
                                            Carregando mensagens...
                                        </div>
                                    ) : (
                                        threadData?.messages?.map((message) => (
                                            <div
                                                key={message.id}
                                                className={cn(
                                                    "flex",
                                                    message.direction === "OUTBOUND"
                                                        ? "justify-end"
                                                        : "justify-start"
                                                )}
                                            >
                                                <div
                                                    className={cn(
                                                        "max-w-[70%] rounded-lg p-3",
                                                        message.direction === "OUTBOUND"
                                                            ? "bg-indigo-600 text-white"
                                                            : "bg-white dark:bg-neutral-900 border"
                                                    )}
                                                >
                                                    {message.subject && (
                                                        <div className="font-semibold mb-1 text-sm">
                                                            {message.subject}
                                                        </div>
                                                    )}
                                                    <div className="text-sm whitespace-pre-wrap">
                                                        {message.content}
                                                    </div>
                                                    <div
                                                        className={cn(
                                                            "text-xs mt-2 flex items-center gap-1",
                                                            message.direction === "OUTBOUND"
                                                                ? "text-indigo-100"
                                                                : "text-muted-foreground"
                                                        )}
                                                    >
                                                        {message.type === "EMAIL" ? (
                                                            <IconMail className="h-3 w-3" />
                                                        ) : (
                                                            <IconBrandWhatsapp className="h-3 w-3" />
                                                        )}
                                                        <span>
                                                            {formatDistanceToNow(
                                                                new Date(message.createdAt),
                                                                {
                                                                    addSuffix: true,
                                                                    locale: ptBR,
                                                                }
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </ScrollArea>

                            <div className="p-4 bg-white dark:bg-neutral-900 border-t space-y-3">
                                <ReplySuggestions
                                    suggestions={intelligenceData?.suggestions || []}
                                    onUseSuggestion={handleUseSuggestion}
                                />

                                {threadData?.lead?.email && (
                                    <Input
                                        placeholder="Assunto (opcional)"
                                        value={messageSubject}
                                        onChange={(event) => setMessageSubject(event.target.value)}
                                    />
                                )}

                                <div className="flex gap-2">
                                    <Textarea
                                        placeholder="Digite sua mensagem..."
                                        value={messageContent}
                                        onChange={(event) => setMessageContent(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                                                handleSendMessage();
                                            }
                                        }}
                                        className="flex-1 resize-none"
                                        rows={3}
                                    />
                                    <Button
                                        onClick={handleSendMessage}
                                        disabled={!messageContent.trim() || sendMessageMutation.isPending}
                                        size="icon"
                                        className="h-auto"
                                    >
                                        <IconSend className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="text-xs text-muted-foreground">
                                    Pressione Ctrl+Enter para enviar.
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

