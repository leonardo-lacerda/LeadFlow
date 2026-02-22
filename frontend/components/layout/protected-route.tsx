'use client';

import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, setUser, logout } = useAuthStore();
    const router = useRouter();
    const isBootstrapping = useRef(false);
    const [sessionChecked, setSessionChecked] = useState(false);

    useEffect(() => {
        if (isBootstrapping.current || sessionChecked) {
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
            })
            .catch(() => {
                logout();
            })
            .finally(() => {
                setSessionChecked(true);
                isBootstrapping.current = false;
            });
    }, [sessionChecked, setUser, logout]);

    useEffect(() => {
        if (sessionChecked && !user) {
            router.replace('/login');
        }
    }, [sessionChecked, user, router]);

    if (!sessionChecked || !user) {
        return null;
    }

    return <>{children}</>;
}
