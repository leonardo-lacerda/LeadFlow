import { create } from 'zustand';

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
    user: User | null;
    setAuth: (user: User) => void;
    setUser: (user: User | null) => void;
    updateUser: (userUpdate: Partial<User>) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
    user: null,
    setAuth: (user) => {
        set({ user });
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
        set({ user: null });
    },
}));
