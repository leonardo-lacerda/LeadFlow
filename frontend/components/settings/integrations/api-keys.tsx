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
import { getErrorMessage } from "@/lib/error-utils";

const apiKeysSchema = z.object({
    apollo: z.string().optional(),
    hunter: z.string().optional(),
    snovio: z.string().optional(),
    twitterAccessToken: z.string().optional(),
    linkedinAccessToken: z.string().optional(),
    linkedinAuthorUrn: z.string().optional(),
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
            twitterAccessToken: initialKeys.twitterAccessToken || "",
            linkedinAccessToken: initialKeys.linkedinAccessToken || "",
            linkedinAuthorUrn: initialKeys.linkedinAuthorUrn || "",
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
            if (values.twitterAccessToken) keys.twitterAccessToken = values.twitterAccessToken;
            if (values.linkedinAccessToken) keys.linkedinAccessToken = values.linkedinAccessToken;
            if (values.linkedinAuthorUrn) keys.linkedinAuthorUrn = values.linkedinAuthorUrn;

            await integrationsApi.updateApiKeys(keys);
            toast({ title: "Chaves de API atualizadas!" });
        } catch (error) {
            toast({
                title: "Erro ao salvar chaves",
                description: getErrorMessage(error),
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
                    <FormField
                        control={form.control}
                        name="snovio"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Snov.io API Key</FormLabel>
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

                    <div className="pt-4">
                        <p className="text-sm font-medium">Growth Loop</p>
                        <p className="text-xs text-muted-foreground mb-3">
                            Tokens para publicação em redes sociais.
                        </p>
                    </div>

                    <FormField
                        control={form.control}
                        name="twitterAccessToken"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Twitter Access Token</FormLabel>
                                <FormControl>
                                    <Input type="password" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="linkedinAccessToken"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>LinkedIn Access Token</FormLabel>
                                <FormControl>
                                    <Input type="password" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="linkedinAuthorUrn"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>LinkedIn Author URN (opcional)</FormLabel>
                                <FormControl>
                                    <Input placeholder="urn:li:person:123456789" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </form>
            </Form>
        </div>
    );
}
