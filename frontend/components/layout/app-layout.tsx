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
    IconSearch,
    IconUpload,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import ProtectedRoute from "./protected-route";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { ThemeToggle } from "./theme-toggle";

export function AppLayout({ children }: { children: React.ReactNode }) {
    const { user, logout } = useAuthStore();
    const router = useRouter();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

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

    const links = [
        {
            label: "Dashboard",
            href: "/dashboard",
            icon: (
                <IconBrandTabler className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
            ),
        },
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
            label: "Scraping",
            href: "/scraping",
            icon: (
                <IconSearch className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
            ),
        },
        {
            label: "Campaigns",
            href: "/campaigns",
            icon: (
                <IconMail className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
            ),
        },
        {
            label: "Inbox",
            href: "/inbox",
            icon: (
                <IconBrandWhatsapp className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
            ),
        },
        {
            label: "Analytics",
            href: "/analytics",
            icon: (
                <IconChartBar className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
            ),
        },
        {
            label: "Settings",
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
            label: "Time",
            href: "/settings/team",
            icon: (
                <IconUsers className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
            ),
        },
        {
            label: "Logout",
            href: "#",
            icon: (
                <IconArrowLeft className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
            ),
            onClick: logout,
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
                            {open ? <Logo /> : <LogoIcon />}
                            <div className="mt-8 flex flex-col gap-2">
                                {links.map((link, idx) => (
                                    <SidebarLink key={idx} link={link} />
                                ))}
                            </div>
                        </div>
                        <div>
                            <SidebarLink
                                link={{
                                    label: user?.name || "User",
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

export const Logo = () => {
    return (
        <Link
            href="/dashboard"
            className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20"
        >
            <div className="h-5 w-6 bg-black dark:bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
            <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-medium text-black dark:text-white whitespace-pre"
            >
                Leadflow
            </motion.span>
        </Link>
    );
};

export const LogoIcon = () => {
    return (
        <Link
            href="/dashboard"
            className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20"
        >
            <div className="h-5 w-6 bg-black dark:bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
        </Link>
    );
};
