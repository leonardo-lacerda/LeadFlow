import { api } from "@/lib/api";

export interface AnalyticsStats {
    totalLeads: number;
    emailsSent: number;
    whatsappSent: number;
    responseRate: string;
    changes: {
        leads: string;
        emails: string;
        whatsapp: string;
        responseRate: string;
    };
}

export interface SourcePerformanceItem {
    source: string;
    totalLeads: number;
    contactedLeads: number;
    repliedLeads: number;
    meetingLeads: number;
    convertedLeads: number;
    replyRate: number;
    meetingRate: number;
    conversionRate: number;
}

export interface SourcePerformanceResponse {
    items: SourcePerformanceItem[];
    totalLeads: number;
}

export interface MessagePerformanceItem {
    channel: "EMAIL" | "WHATSAPP";
    templateId: string | null;
    templateName: string;
    industry: string;
    sent: number;
    opened: number;
    replied: number;
    bounced: number;
    openRate: number;
    replyRate: number;
    bounceRate: number;
}

export interface MessagePerformanceResponse {
    items: MessagePerformanceItem[];
    windowDays: number;
    totalMessages: number;
}

export interface TimingHeatmapCell {
    industry: string;
    hour: number;
    sent: number;
    opened: number;
    replied: number;
    openRate: number;
    replyRate: number;
    volumeScore?: number;
    weightedScore?: number;
}

export interface TimingHeatmapResponse {
    windowDays: number;
    industries: string[];
    hours: number[];
    cells: TimingHeatmapCell[];
    bestWindows: TimingHeatmapCell[];
    weights?: {
        replyRate: number;
        openRate: number;
        volume: number;
    };
}

export interface ResponseTimeStats {
    count: number;
    avgSeconds: number;
    avgHours: number;
    medianSeconds: number;
    p75Seconds: number;
    minSeconds: number;
    maxSeconds: number;
}

export interface ResponseTimeByChannel extends ResponseTimeStats {
    channel: string;
}

export interface ResponseTimeBySource extends ResponseTimeStats {
    source: string;
}

export interface ResponseTimeResponse {
    windowDays: number;
    summary: ResponseTimeStats;
    byChannel: ResponseTimeByChannel[];
    bySource: ResponseTimeBySource[];
}

export interface ScoreCorrelationItem {
    bucket: string;
    totalLeads: number;
    contactedLeads: number;
    repliedLeads: number;
    convertedLeads: number;
    replyRate: number;
    conversionRate: number;
}

export interface ScoreCorrelationResponse {
    items: ScoreCorrelationItem[];
}

export interface FunnelStage {
    id: string;
    label: string;
    value: number;
    pctOfCaptured: number;
    pctFromPrevious: number;
}

export interface FunnelResponse {
    stages: FunnelStage[];
}

export interface RecentActivity {
    id: string;
    type: string;
    description: string;
    leadId: string;
    leadName: string;
    leadEmail: string;
    timestamp: string;
}

export interface CampaignAnalytics {
    id: string;
    name: string;
    type: string;
    status: string;
    stats: {
        sent: number;
        opened: number;
        replied: number;
    };
    metrics?: Record<string, unknown> | null;
    lastMetricsAt?: string | null;
    createdAt: string;
}

export const analyticsApi = {
    async getStats(): Promise<AnalyticsStats> {
        const response = await api.get("/analytics/stats");
        return response.data.data;
    },

    async getSourcePerformance(): Promise<SourcePerformanceResponse> {
        const response = await api.get("/analytics/source-performance");
        return response.data.data;
    },

    async getMessagePerformance(days = 60): Promise<MessagePerformanceResponse> {
        const response = await api.get("/analytics/message-performance", {
            params: { days },
        });
        return response.data.data;
    },

    async getTimingHeatmap(days = 60): Promise<TimingHeatmapResponse> {
        const response = await api.get("/analytics/timing-heatmap", {
            params: { days },
        });
        return response.data.data;
    },

    async getResponseTime(days = 120): Promise<ResponseTimeResponse> {
        const response = await api.get("/analytics/response-time", {
            params: { days },
        });
        return response.data.data;
    },

    async getScoreCorrelation(): Promise<ScoreCorrelationResponse> {
        const response = await api.get("/analytics/score-correlation");
        return response.data.data;
    },

    async getFunnel(): Promise<FunnelResponse> {
        const response = await api.get("/analytics/funnel");
        return response.data.data;
    },

    async recalculate(campaignId?: string): Promise<{ jobId: string; queued: boolean }> {
        const response = await api.post("/analytics/recalculate", { campaignId });
        return response.data.data;
    },

    async getRecentActivity(limit = 10): Promise<RecentActivity[]> {
        const response = await api.get("/analytics/recent-activity", {
            params: { limit },
        });
        return response.data.data;
    },

    async getCampaignAnalytics(campaignId?: string): Promise<CampaignAnalytics[]> {
        const response = await api.get("/analytics/campaigns", {
            params: { campaignId },
        });
        return response.data.data;
    },
};
