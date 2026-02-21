"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { IconUpload, IconFileSpreadsheet } from "@tabler/icons-react";
import { useToast } from "@/hooks/use-toast";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { leadsApi, LeadInput } from "@/lib/leads-api";
import Papa from "papaparse";
import * as XLSX from "xlsx";

const LEAD_FIELDS = [
    { value: "ignore", label: "Ignorar" },
    { value: "fullName", label: "Nome Completo" },
    { value: "firstName", label: "Nome" },
    { value: "lastName", label: "Sobrenome" },
    { value: "email", label: "Email" },
    { value: "phone", label: "Telefone" },
    { value: "companyName", label: "Empresa" },
    { value: "jobTitle", label: "Cargo" },
    { value: "city", label: "Cidade" },
    { value: "state", label: "Estado" },
    { value: "country", label: "Paï¿½s" },
    { value: "linkedinUrl", label: "LinkedIn" },
    { value: "source", label: "Fonte" },
];

type RowData = Record<string, string>;
type LeadFieldKey = Exclude<(typeof LEAD_FIELDS)[number]["value"], "ignore">;

export default function ImportLeadsPage() {
    const [file, setFile] = useState<File | null>(null);
    const [headers, setHeaders] = useState<string[]>([]);
    const [rows, setRows] = useState<RowData[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [errors, setErrors] = useState<string[]>([]);
    const { toast } = useToast();

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;
        const file = e.target.files[0];
        setFile(file);
        setErrors([]);
        setProgress(0);

        const ext = file.name.split(".").pop()?.toLowerCase();
        if (ext === "csv") {
            parseCsv(file);
        } else if (ext === "xlsx" || ext === "xls") {
            parseExcel(file);
        } else {
            toast({ title: "Formato nï¿½o suportado", variant: "destructive" });
        }
    };

    const parseCsv = (file: File) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (result) => {
                const data = result.data as RowData[];
                if (data.length === 0) return;
                setRows(data);
                const cols = Object.keys(data[0]);
                setHeaders(cols);
                const initialMapping: Record<string, string> = {};
                cols.forEach((col) => {
                    const normalized = col.toLowerCase();
                    if (normalized.includes("email")) initialMapping[col] = "email";
                    else if (normalized.includes("nome")) initialMapping[col] = "fullName";
                    else if (normalized.includes("empresa")) initialMapping[col] = "companyName";
                    else if (normalized.includes("cargo")) initialMapping[col] = "jobTitle";
                    else initialMapping[col] = "ignore";
                });
                setMapping(initialMapping);
            },
        });
    };

    const parseExcel = (file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json<RowData>(sheet, { defval: "" });
            if (json.length === 0) return;
            setRows(json);
            const cols = Object.keys(json[0]);
            setHeaders(cols);
            const initialMapping: Record<string, string> = {};
            cols.forEach((col) => {
                const normalized = col.toLowerCase();
                if (normalized.includes("email")) initialMapping[col] = "email";
                else if (normalized.includes("nome")) initialMapping[col] = "fullName";
                else if (normalized.includes("empresa")) initialMapping[col] = "companyName";
                else if (normalized.includes("cargo")) initialMapping[col] = "jobTitle";
                else initialMapping[col] = "ignore";
            });
            setMapping(initialMapping);
        };
        reader.readAsArrayBuffer(file);
    };

    const buildLeads = () => {
        const mapped = rows.map((row) => {
            const lead: LeadInput = {};
            headers.forEach((header) => {
                const targetField = mapping[header] as LeadFieldKey | "ignore" | undefined;
                if (!targetField || targetField === "ignore") return;
                (lead as Record<LeadFieldKey, string>)[targetField] = row[header];
            });
            return lead;
        });

        const invalidRows = mapped
            .map((lead, index) => ({ lead, index }))
            .filter(({ lead }) => !lead.email);

        if (invalidRows.length > 0) {
            setErrors([
                `Encontramos ${invalidRows.length} linhas sem email. Elas serï¿½o ignoradas.`,
            ]);
        }

        return mapped.filter((lead) => lead.email);
    };

    const handleImport = async () => {
        if (!file || rows.length === 0) return;
        setUploading(true);
        setProgress(0);

        const leadsToImport = buildLeads();
        const chunkSize = 100;
        let imported = 0;

        try {
            for (let i = 0; i < leadsToImport.length; i += chunkSize) {
                const chunk = leadsToImport.slice(i, i + chunkSize);
                await leadsApi.bulkCreate(chunk);
                imported += chunk.length;
                setProgress(Math.round((imported / leadsToImport.length) * 100));
            }

            toast({
                title: "Importaï¿½ï¿½o concluï¿½da",
                description: `${imported} leads importados com sucesso.`,
            });
        } catch (error) {
            console.error(error);
            toast({
                title: "Erro ao importar",
                variant: "destructive",
            });
        } finally {
            setUploading(false);
        }
    };

    return (
        <AppLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <h2 className="text-3xl font-bold tracking-tight">Importar Leads</h2>

                <Card>
                    <CardHeader>
                        <CardTitle>Upload de CSV/Excel</CardTitle>
                        <CardDescription>
                            Importe leads em massa usando arquivos .csv ou .xlsx.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid w-full max-w-sm items-center gap-1.5">
                            <Label htmlFor="file">Arquivo de Leads</Label>
                            <div className="flex items-center gap-4">
                                <Input
                                    id="file"
                                    type="file"
                                    accept=".csv, .xlsx, .xls"
                                    onChange={handleFileChange}
                                />
                            </div>
                        </div>

                        {file && (
                            <div className="flex items-center gap-4 p-4 border rounded-lg bg-neutral-50 dark:bg-neutral-800">
                                <IconFileSpreadsheet className="h-8 w-8 text-green-600" />
                                <div className="flex-1">
                                    <p className="font-medium text-sm">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {(file.size / 1024).toFixed(2)} KB
                                    </p>
                                </div>
                            </div>
                        )}

                        {headers.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="font-semibold">Mapeamento de Colunas</h3>
                                <div className="grid md:grid-cols-2 gap-4">
                                    {headers.map((header) => (
                                        <div key={header} className="flex items-center gap-2">
                                            <span className="text-sm font-medium w-32 truncate">{header}</span>
                                            <Select
                                                value={mapping[header]}
                                                onValueChange={(value) =>
                                                    setMapping((prev) => ({ ...prev, [header]: value }))
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecionar campo" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {LEAD_FIELDS.map((field) => (
                                                        <SelectItem key={field.value} value={field.value}>
                                                            {field.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {rows.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="font-semibold">Prï¿½-visualizaï¿½ï¿½o</h3>
                                <div className="border rounded-md p-4 max-h-64 overflow-auto text-sm">
                                    <pre>{JSON.stringify(rows.slice(0, 3), null, 2)}</pre>
                                </div>
                            </div>
                        )}

                        {errors.length > 0 && (
                            <div className="space-y-2">
                                {errors.map((err, idx) => (
                                    <p key={idx} className="text-sm text-red-600">{err}</p>
                                ))}
                            </div>
                        )}

                        {uploading && <Progress value={progress} />}

                        <div className="flex justify-end">
                            <Button onClick={handleImport} disabled={!file || uploading}>
                                {uploading ? "Importando..." : (
                                    <>
                                        <IconUpload className="mr-2 h-4 w-4" />
                                        Importar Leads
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}



