"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AppLayout } from "@/components/layout/app-layout";
import {
    IconBuilding,
    IconUsers,
    IconCreditCard,
    IconPlug,
} from "@tabler/icons-react";

interface SettingsLayoutProps {
    children: React.ReactNode;
}

const sidebarNavItems = [
    {
        title: "Organization",
        href: "/settings/organization",
        icon: IconBuilding,
    },
    {
        title: "Team",
        href: "/settings/team",
        icon: IconUsers,
    },
    {
        title: "Channels",
        href: "/settings/integrations",
        icon: IconPlug,
    },
    {
        title: "ICP + Cohort",
        href: "/settings/icp",
        icon: IconBuilding,
    },
    {
        title: "Billing",
        href: "/settings/billing",
        icon: IconCreditCard,
    },
];

export default function SettingsLayout({ children }: SettingsLayoutProps) {
    const pathname = usePathname();

    return (
        <AppLayout>
            <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
                <aside className="-mx-4 lg:w-1/5">
                    <nav className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
                        {sidebarNavItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-2 justify-start rounded-md p-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                                    pathname === item.href
                                        ? "bg-accent text-accent-foreground"
                                        : "text-muted-foreground"
                                )}
                            >
                                <item.icon className="h-4 w-4" />
                                {item.title}
                            </Link>
                        ))}
                    </nav>
                </aside>
                <div className="flex-1 lg:max-w-2xl">{children}</div>
            </div>
        </AppLayout>
    );
}
