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

const formSchema = z.object({
    email: z.string().email("Email invalido"),
});

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [debugResetUrl, setDebugResetUrl] = useState<string | null>(null);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { email: "" },
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setLoading(true);
        setMessage(null);
        setDebugResetUrl(null);
        try {
            const response = await api.post("/auth/forgot-password", values);
            const resetUrl = response.data?.data?.resetUrl;
            if (typeof resetUrl === "string" && resetUrl.length > 0) {
                setDebugResetUrl(resetUrl);
            }
        } catch {
            // Keep same response behavior to avoid account enumeration.
        } finally {
            setLoading(false);
            setMessage("Se o email existir, enviaremos instrucoes para redefinir sua senha.");
            setTimeout(() => router.push("/login"), 3000);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-neutral-100 dark:bg-neutral-900 p-4">
            <div className="w-full max-w-md space-y-8 bg-white dark:bg-neutral-800 p-8 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700">
                <div className="text-center">
                    <h2 className="mt-6 text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
                        Recuperar senha
                    </h2>
                    <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                        Enviaremos um link de recuperacao para o seu email.
                    </p>
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Input placeholder="seu@email.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {message && (
                            <div className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
                                {message}
                            </div>
                        )}
                        {debugResetUrl && (
                            <div className="text-xs break-all p-3 rounded-md bg-muted text-muted-foreground">
                                <strong>Link de reset (dev): </strong>
                                <Link href={debugResetUrl} className="underline">
                                    {debugResetUrl}
                                </Link>
                            </div>
                        )}
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "Enviando..." : "Enviar link de recuperacao"}
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
