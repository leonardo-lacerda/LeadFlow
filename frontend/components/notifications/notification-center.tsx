"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { notificationsApi, Notification } from "@/lib/notifications-api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconBell } from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

function isHotLeadReplyNotification(notification: Notification) {
    const title = notification.title.toLowerCase();
    return title.includes("lead quente respondeu") || title.includes("prospect quente respondeu");
}

export function NotificationCenter() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [open, setOpen] = useState(false);
    const initialized = useRef(false);
    const seenIdsRef = useRef<Set<string>>(new Set());
    const router = useRouter();
    const { toast } = useToast();

    const byId = useMemo(
        () => new Map(notifications.map((notification) => [notification.id, notification])),
        [notifications]
    );

    const loadNotifications = useCallback(async () => {
        try {
            const result = await notificationsApi.list();
            const fetched = result.data;
            setNotifications(fetched);
            setUnreadCount(result.meta.unreadCount);

            if (!initialized.current) {
                for (const notification of fetched) {
                    seenIdsRef.current.add(notification.id);
                }
                initialized.current = true;
                return;
            }

            const unseen = fetched.filter((notification) => !seenIdsRef.current.has(notification.id));
            for (const notification of unseen) {
                seenIdsRef.current.add(notification.id);
            }

            for (const notification of unseen) {
                if (!notification.read && isHotLeadReplyNotification(notification)) {
                    toast({
                        title: "Prospect quente respondeu",
                        description: notification.message,
                    });
                }
            }
        } catch (error) {
            console.debug("Failed to load notifications:", error);
        }
    }, [toast]);

    useEffect(() => {
        const initTimer = setTimeout(() => {
            loadNotifications();
        }, 500);

        const interval = setInterval(loadNotifications, 30000);

        return () => {
            clearTimeout(initTimer);
            clearInterval(interval);
        };
    }, [loadNotifications]);

    const handleMarkRead = async (id: string, currentlyRead: boolean) => {
        if (currentlyRead) {
            return;
        }
        try {
            await notificationsApi.markRead(id);
            setNotifications((previous) =>
                previous.map((notification) =>
                    notification.id === id ? { ...notification, read: true } : notification
                )
            );
            setUnreadCount((previous) => Math.max(0, previous - 1));
        } catch (error) {
            console.error(error);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await notificationsApi.markAllRead();
            setNotifications((previous) =>
                previous.map((notification) => ({ ...notification, read: true }))
            );
            setUnreadCount(0);
        } catch (error) {
            console.error(error);
        }
    };

    const handleNotificationClick = async (notificationId: string) => {
        const notification = byId.get(notificationId);
        if (!notification) {
            return;
        }

        await handleMarkRead(notification.id, notification.read);

        if (notification.link) {
            router.push(notification.link);
            setOpen(false);
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <IconBell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 h-3 w-3 rounded-full bg-red-500 border-2 border-white dark:border-neutral-900" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between p-4 border-b">
                    <h4 className="font-semibold">Notificacoes</h4>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-auto py-1"
                            onClick={handleMarkAllRead}
                        >
                            Marcar tudo como lido
                        </Button>
                    )}
                </div>

                <ScrollArea className="h-[300px]">
                    {notifications.length === 0 ? (
                        <div className="flex items-center justify-center h-20 text-muted-foreground text-sm">
                            Nenhuma notificacao.
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {notifications.map((notification) => (
                                <button
                                    key={notification.id}
                                    type="button"
                                    className={cn(
                                        "flex flex-col items-start gap-1 p-4 text-left hover:bg-muted/50 transition-colors border-b last:border-0",
                                        !notification.read && "bg-blue-50/50 dark:bg-blue-900/10"
                                    )}
                                    onClick={() => handleNotificationClick(notification.id)}
                                >
                                    <div className="flex w-full justify-between items-start">
                                        <span
                                            className={cn(
                                                "text-sm font-medium",
                                                !notification.read && "text-primary"
                                            )}
                                        >
                                            {notification.title}
                                        </span>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                            {formatDistanceToNow(new Date(notification.createdAt), {
                                                addSuffix: true,
                                                locale: ptBR,
                                            })}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                        {notification.message}
                                    </p>
                                </button>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
