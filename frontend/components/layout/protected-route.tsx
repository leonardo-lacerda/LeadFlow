'use client';

import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { token, user, hydrated, setUser, logout } = useAuthStore();
    const router = useRouter();
    const isBootstrapping = useRef(false);

    useEffect(() => {
        if (!hydrated) {
            return;
        }
        if (!token) {
            router.replace('/login');
        }
    }, [hydrated, token, router]);

    useEffect(() => {
        if (!hydrated || !token || user || isBootstrapping.current) {
            return;
        }

        isBootstrapping.current = true;
        api.get('/auth/me')
            .then((response) => {
                if (response.data?.success && response.data?.data) {
                    setUser(response.data.data);
                    return;
                }
                logout();
                router.replace('/login');
            })
            .catch(() => {
                logout();
                router.replace('/login');
            })
            .finally(() => {
                isBootstrapping.current = false;
            });
    }, [hydrated, token, user, setUser, logout, router]);

    if (!hydrated || !token || !user) {
        return null;
    }

    return <>{children}</>;
}
