"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/store/auth-store";

export default function Providers({ children }: { children: ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000, // 1 minute
                refetchOnWindowFocus: false,
            },
        },
    }));
    const token = useAuthStore((state) => state.token);
    const organizationId = useAuthStore((state) => state.user?.organization?.id ?? null);
    const previousSessionRef = useRef<string | null>(null);

    useEffect(() => {
        const currentSession = token ? `${token}:${organizationId ?? "no-org"}` : null;

        if (previousSessionRef.current === null) {
            previousSessionRef.current = currentSession;
            return;
        }

        if (previousSessionRef.current !== currentSession) {
            queryClient.clear();
            previousSessionRef.current = currentSession;
        }
    }, [token, organizationId, queryClient]);

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
