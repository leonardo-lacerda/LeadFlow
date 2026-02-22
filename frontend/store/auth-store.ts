import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface User {
    id: string;
    email: string;
    name: string;
    organization: {
        id: string;
        name: string;
        onboardingCompleted: boolean;
        [key: string]: unknown;
    };
    role?: "OWNER" | "ADMIN" | "MEMBER";
    [key: string]: unknown;
}

interface AuthState {
    token: string | null;
    user: User | null;
    hydrated: boolean;
    setAuth: (token: string, user: User) => void;
    setUser: (user: User | null) => void;
    updateUser: (userUpdate: Partial<User>) => void;
    logout: () => void;
    setHydrated: (hydrated: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            user: null,
            hydrated: false,
            setAuth: (token, user) => {
                set({ token, user });
            },
            setUser: (user) => {
                set({ user });
            },
            updateUser: (userUpdate) =>
                set((state) => {
                    if (!state.user) {
                        return state;
                    }
                    return {
                        user: {
                            ...state.user,
                            ...userUpdate,
                        },
                    };
                }),
            logout: () => {
                set({ token: null, user: null });
            },
            setHydrated: (hydrated) => {
                set({ hydrated });
            },
        }),
        {
            name: 'lastreia-auth',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                token: state.token,
                user: state.user,
            }),
            onRehydrateStorage: () => (state) => {
                state?.setHydrated(true);
            },
        }
    )
);
