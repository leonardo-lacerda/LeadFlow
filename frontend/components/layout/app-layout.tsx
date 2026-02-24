"use client";

import { useState, useEffect } from "react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import {
    IconArrowLeft,
    IconBrandTabler,
    IconSettings,
    IconUsers,
    IconMail,
    IconBrandWhatsapp,
    IconChartBar,
    IconBulb,
    IconSearch,
    IconUpload,
    IconShare3,
    IconTrendingUp,
    IconDatabase,
    IconSparkles,
    IconActivityHeartbeat,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { api } from "@/lib/api";
import ProtectedRoute from "./protected-route";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { ThemeToggle } from "./theme-toggle";

export function AppLayout({ children }: { children: React.ReactNode }) {
    const { user, logout } = useAuthStore();
    const router = useRouter();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    const handleLogout = () => {
        void (async () => {
            try {
                await api.post("/auth/logout");
            } catch {
                // Always clear local session state even if server logout fails.
            } finally {
                logout();
                router.replace("/login");
            }
        })();
    };

    useEffect(() => {
        if (!user?.organization) {
            return;
        }

        const onboardingCompleted = Boolean(user.organization.onboardingCompleted);
        if (!onboardingCompleted && pathname !== "/onboarding") {
            router.replace("/onboarding");
            return;
        }

        if (onboardingCompleted && pathname === "/onboarding") {
            router.replace("/dashboard");
        }
    }, [user, pathname, router]);

    const navSections = [
        {
            title: "Inicio",
            links: [
                {
                    label: "Painel",
                    href: "/dashboard",
                    icon: (
                        <IconBrandTabler className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                    ),
                },
            ],
        },
        {
            title: "Leads e Prospeccao",
            links: [
                {
                    label: "Leads",
                    href: "/leads",
                    icon: (
                        <IconUsers className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                    ),
                },
                {
                    label: "Importar Leads",
                    href: "/leads/import",
                    icon: (
                        <IconUpload className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                    ),
                },
                {
                    label: "Descoberta de Leads",
                    href: "/scraping",
                    icon: (
                        <IconSearch className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                    ),
                },
                {
                    label: "Lead Pool",
                    href: "/lead-pool",
                    icon: (
                        <IconDatabase className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                    ),
                },
            ],
        },
        {
            title: "Execucao",
            links: [
                {
                    label: "Sequencias",
                    href: "/campaigns",
                    icon: (
                        <IconMail className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                    ),
                },
                {
                    label: "Caixa de entrada",
                    href: "/inbox",
                    icon: (
                        <IconBrandWhatsapp className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                    ),
                },
            ],
        },
        {
            title: "Inteligencia e Conteudo",
            links: [
                {
                    label: "Inteligencia",
                    href: "/analytics",
                    icon: (
                        <IconChartBar className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                    ),
                },
                {
                    label: "Signal Engine",
                    href: "/signals",
                    icon: (
                        <IconBulb className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                    ),
                },
                {
                    label: "AI Workspace",
                    href: "/ai",
                    icon: (
                        <IconSparkles className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                    ),
                },
                {
                    label: "Distribution",
                    href: "/distribution",
                    icon: (
                        <IconShare3 className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                    ),
                },
                {
                    label: "Growth Loop",
                    href: "/growth",
                    icon: (
                        <IconTrendingUp className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                    ),
                },
            ],
        },
        {
            title: "Administracao",
            links: [
                {
                    label: "Configuracoes",
                    href: "/settings",
                    icon: (
                        <IconSettings className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                    ),
                },
                {
                    label: "Integracoes",
                    href: "/settings/integrations",
                    icon: (
                        <IconSettings className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                    ),
                },
                {
                    label: "Agente IA",
                    href: "/settings/agent",
                    icon: (
                        <IconSparkles className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                    ),
                },
                {
                    label: "Time",
                    href: "/settings/team",
                    icon: (
                        <IconUsers className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                    ),
                },
                {
                    label: "Observabilidade",
                    href: "/settings/observability",
                    icon: (
                        <IconActivityHeartbeat className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                    ),
                },
            ],
        },
    ];

    const accountLinks = [
        {
            label: "Sair",
            href: "/login",
            icon: (
                <IconArrowLeft className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
            ),
            onClick: handleLogout,
        },
    ];

    return (
        <ProtectedRoute>
            <div
                className={cn(
                    "flex min-h-screen w-full flex-col overflow-hidden bg-gray-100 dark:bg-neutral-800 md:flex-row"
                )}
            >
                <Sidebar open={open} setOpen={setOpen}>
                    <SidebarBody className="justify-between gap-10">
                        <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
                            <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
                                <Logo open={open} />
                                <div className="mt-8 flex flex-col gap-1">
                                    {navSections.map((section) => (
                                        <div key={section.title} className="mb-2">
                                            <motion.p
                                                animate={{
                                                    height: open ? "auto" : 0,
                                                    opacity: open ? 1 : 0,
                                                    marginBottom: open ? 4 : 0,
                                                }}
                                                className="px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400 overflow-hidden whitespace-nowrap"
                                            >
                                                {section.title}
                                            </motion.p>
                                            <div className="flex flex-col gap-1">
                                                {section.links.map((link) => (
                                                    <SidebarLink key={link.href} link={link} />
                                                ))}
                                            </div>
                                        </div>
                                    ))}

                                    <div className="my-2 h-px bg-neutral-200 dark:bg-neutral-700" />

                                    <motion.p
                                        animate={{
                                            height: open ? "auto" : 0,
                                            opacity: open ? 1 : 0,
                                            marginBottom: open ? 4 : 0,
                                        }}
                                        className="px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400 overflow-hidden whitespace-nowrap"
                                    >
                                        Conta
                                    </motion.p>
                                    {accountLinks.map((link) => (
                                        <SidebarLink key={link.label} link={link} />
                                    ))}
                                </div>
                            </div>
                            <div>
                                <SidebarLink
                                    link={{
                                        label: user?.name || "Usuario",
                                        href: "/settings",
                                        icon: (
                                            <Image
                                                src="https://assets.aceternity.com/manu.png"
                                                className="h-7 w-7 flex-shrink-0 rounded-full"
                                                width={50}
                                                height={50}
                                                alt="Avatar"
                                            />
                                        ),
                                    }}
                                />
                            </div>
                        </div>
                    </SidebarBody>
                </Sidebar>
                <div className="flex flex-1 flex-col h-full overflow-hidden">
                    <header className="h-14 border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex items-center justify-end px-4 gap-2 flex-shrink-0">
                        <ThemeToggle />
                        <NotificationCenter />
                    </header>
                    <div className="p-2 md:p-10 flex-1 overflow-y-auto bg-white dark:bg-neutral-900">
                        {children}
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}

export const Logo = ({ open = true }: { open?: boolean }) => {
    return (
        <Link
            href="/dashboard"
            className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20 overflow-hidden"
        >
            <div className="h-5 w-6 bg-black dark:bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
            <motion.span
                animate={{
                    opacity: open ? 1 : 0,
                    width: open ? "auto" : 0,
                    display: open ? "inline-block" : "none",
                }}
                className="font-medium text-black dark:text-white whitespace-pre"
            >
                Lastreia
            </motion.span>
        </Link>
    );
};
