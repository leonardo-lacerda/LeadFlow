"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { integrationsApi } from "@/lib/integrations-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const apiKeysSchema = z.object({
    apollo: z.string().optional(),
    hunter: z.string().optional(),
    snovio: z.string().optional(),
});

interface ApiKeysProps {
    initialKeys?: Record<string, string>;
}

export function ApiKeys({ initialKeys = {} }: ApiKeysProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const form = useForm<z.infer<typeof apiKeysSchema>>({
        resolver: zodResolver(apiKeysSchema),
        defaultValues: {
            apollo: initialKeys.apollo || "",
            hunter: initialKeys.hunter || "",
            snovio: initialKeys.snovio || "",
        },
    });

    const onSubmit = async (values: z.infer<typeof apiKeysSchema>) => {
        setLoading(true);
        try {
            // Filter out empty strings
            const keys: Record<string, string> = {};
            if (values.apollo) keys.apollo = values.apollo;
            if (values.hunter) keys.hunter = values.hunter;
            if (values.snovio) keys.snovio = values.snovio;

            await integrationsApi.updateApiKeys(keys);
            toast({ title: "Chaves de API atualizadas!" });
        } catch (error) {
            console.error(error);
            toast({
                title: "Erro ao salvar chaves",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-medium">Chaves de API</h3>
                <p className="text-sm text-muted-foreground">
                    Chaves para serviços de enriquecimento de dados externos.
                </p>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-md">
                    <FormField
                        control={form.control}
                        name="apollo"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Apollo.io API Key</FormLabel>
                                <FormControl>
                                    <Input type="password" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="hunter"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Hunter.io API Key</FormLabel>
                                <FormControl>
                                    <Input type="password" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <Button type="submit" disabled={loading}>
                        {loading ? "Salvando..." : "Salvar Chaves"}
                    </Button>
                </form>
            </Form>
        </div>
    );
}
