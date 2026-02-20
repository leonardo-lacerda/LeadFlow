"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

const formSchema = z
    .object({
        password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
        confirmPassword: z.string().min(8, "A confirmacao deve ter pelo menos 8 caracteres"),
    })
    .refine((values) => values.password === values.confirmPassword, {
        path: ["confirmPassword"],
        message: "As senhas nao coincidem",
    });

export default function ResetPasswordPage() {
    const router = useRouter();
    const [token] = useState<string | null>(() => {
        if (typeof window === "undefined") {
            return null;
        }
        return new URLSearchParams(window.location.search).get("token");
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            password: "",
            confirmPassword: "",
        },
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        if (!token) {
            setError("Token de recuperacao ausente");
            return;
        }

        setLoading(true);
        setError(null);
        setMessage(null);
        try {
            await api.post("/auth/reset-password", {
                token,
                password: values.password,
            });
            setMessage("Senha atualizada com sucesso. Redirecionando para login...");
            setTimeout(() => router.push("/login"), 2000);
        } catch (err) {
            const message =
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                "Falha ao redefinir senha";
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-neutral-100 dark:bg-neutral-900 p-4">
            <div className="w-full max-w-md space-y-8 bg-white dark:bg-neutral-800 p-8 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700">
                <div className="text-center">
                    <h2 className="mt-6 text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
                        Redefinir senha
                    </h2>
                    <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                        Informe sua nova senha.
                    </p>
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nova senha</FormLabel>
                                    <FormControl>
                                        <Input type="password" placeholder="********" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="confirmPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Confirmar senha</FormLabel>
                                    <FormControl>
                                        <Input type="password" placeholder="********" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {error && (
                            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                                {error}
                            </div>
                        )}
                        {message && (
                            <div className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
                                {message}
                            </div>
                        )}

                        <Button type="submit" className="w-full" disabled={loading || !token}>
                            {loading ? "Atualizando..." : "Atualizar senha"}
                        </Button>
                    </form>
                </Form>

                <div className="text-center text-sm">
                    <Link href="/login" className="text-blue-600 hover:text-blue-500 dark:text-blue-400">
                        Voltar para login
                    </Link>
                </div>
            </div>
        </div>
    );
}

