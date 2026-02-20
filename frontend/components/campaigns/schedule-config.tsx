"use client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconClock, IconCalendar, IconMail } from "@tabler/icons-react";

export interface ScheduleSettings {
    timezone: string;
    respectBusinessHours: boolean;
    businessHoursStart: string;
    businessHoursEnd: string;
    dailyLimit: number;
    respectReplies: boolean;
    sendOnWeekends: boolean;
}

interface ScheduleConfigProps {
    value: ScheduleSettings;
    onChange: (settings: ScheduleSettings) => void;
}

const TIMEZONES = [
    { value: "America/Sao_Paulo", label: "São Paulo (BRT/UTC-3)" },
    { value: "America/New_York", label: "New York (EST/UTC-5)" },
    { value: "Europe/London", label: "London (GMT/UTC+0)" },
    { value: "Asia/Tokyo", label: "Tokyo (JST/UTC+9)" },
];

export function ScheduleConfig({ value, onChange }: ScheduleConfigProps) {
    const updateSetting = <K extends keyof ScheduleSettings>(
        key: K,
        newValue: ScheduleSettings[K]
    ) => {
        onChange({ ...value, [key]: newValue });
    };

    return (
        <div className="space-y-6">
            {/* Timezone */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <IconCalendar className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">Timezone</CardTitle>
                    </div>
                    <CardDescription>
                        Defina o fuso horário para envio de mensagens.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Select value={value.timezone} onValueChange={(v) => updateSetting("timezone", v)}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione o timezone" />
                        </SelectTrigger>
                        <SelectContent>
                            {TIMEZONES.map((tz) => (
                                <SelectItem key={tz.value} value={tz.value}>
                                    {tz.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {/* Business Hours */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <IconClock className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">Horário Comercial</CardTitle>
                    </div>
                    <CardDescription>
                        Configure o horário de envio de mensagens.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <Label>Respeitar horário comercial</Label>
                            <p className="text-xs text-muted-foreground">
                                Enviar apenas dentro do horário configurado
                            </p>
                        </div>
                        <Switch
                            checked={value.respectBusinessHours}
                            onCheckedChange={(checked) => updateSetting("respectBusinessHours", checked)}
                        />
                    </div>

                    {value.respectBusinessHours && (
                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <div className="space-y-2">
                                <Label htmlFor="start">Início</Label>
                                <Input
                                    id="start"
                                    type="time"
                                    value={value.businessHoursStart}
                                    onChange={(e) => updateSetting("businessHoursStart", e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="end">Fim</Label>
                                <Input
                                    id="end"
                                    type="time"
                                    value={value.businessHoursEnd}
                                    onChange={(e) => updateSetting("businessHoursEnd", e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                        <div className="space-y-1">
                            <Label>Enviar nos fins de semana</Label>
                            <p className="text-xs text-muted-foreground">
                                Incluir sábado e domingo
                            </p>
                        </div>
                        <Switch
                            checked={value.sendOnWeekends}
                            onCheckedChange={(checked) => updateSetting("sendOnWeekends", checked)}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Send Limits */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <IconMail className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">Limites de Envio</CardTitle>
                    </div>
                    <CardDescription>
                        Configure limites diários e comportamento.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="dailyLimit">Mensagens por dia</Label>
                        <Input
                            id="dailyLimit"
                            type="number"
                            min="1"
                            max="1000"
                            value={value.dailyLimit}
                            onChange={(e) => updateSetting("dailyLimit", parseInt(e.target.value) || 50)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Limite de mensagens enviadas por dia (recomendado: 50-200)
                        </p>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <Label>Pausar se receber resposta</Label>
                            <p className="text-xs text-muted-foreground">
                                Interromper sequência ao receber uma resposta
                            </p>
                        </div>
                        <Switch
                            checked={value.respectReplies}
                            onCheckedChange={(checked) => updateSetting("respectReplies", checked)}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
