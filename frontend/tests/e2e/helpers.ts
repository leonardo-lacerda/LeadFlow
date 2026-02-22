import { Page, Route } from "@playwright/test";

function jsonResponse(route: Route, body: unknown, status = 200) {
    return route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
    });
}

export async function seedAuthenticatedSession(page: Page) {
    await page.addInitScript(() => {
        const payload = {
            state: {
                token: "e2e-token",
                user: {
                    id: "user-e2e",
                    name: "E2E User",
                    email: "e2e@example.com",
                    role: "OWNER",
                    organizationId: "org-e2e",
                    organization: {
                        id: "org-e2e",
                        name: "Org E2E",
                        onboardingCompleted: true,
                    },
                },
            },
            version: 0,
        };

        localStorage.setItem("lastreia-auth", JSON.stringify(payload));
    });
}

export async function mockApi(page: Page) {
    await page.route("**/api/**", async (route) => {
        const request = route.request();
        const method = request.method();
        const url = new URL(request.url());
        const path = url.pathname;

        if (method === "GET" && path === "/api/notifications") {
            return jsonResponse(route, {
                success: true,
                data: [],
                meta: { unreadCount: 0 },
            });
        }

        if (method === "PATCH" && path.startsWith("/api/notifications/")) {
            return jsonResponse(route, { success: true });
        }

        if (method === "GET" && path === "/api/analytics/stats") {
            return jsonResponse(route, {
                success: true,
                data: {
                    totalLeads: 120,
                    emailsSent: 80,
                    whatsappSent: 40,
                    responseRate: "24",
                    changes: {
                        leads: "+4%",
                        emails: "+8%",
                        responseRate: "+2%",
                    },
                },
            });
        }

        if (method === "GET" && path === "/api/analytics/recent-activity") {
            return jsonResponse(route, {
                success: true,
                data: [
                    {
                        id: "activity-1",
                        type: "email",
                        description: "Mensagem enviada",
                        leadEmail: "lead@example.com",
                        leadName: "Lead E2E",
                        timestamp: new Date().toISOString(),
                    },
                ],
            });
        }

        if (method === "GET" && path === "/api/signals/overview") {
            return jsonResponse(route, {
                success: true,
                data: {
                    windowDays: 30,
                    generatedAt: new Date().toISOString(),
                    organization: {
                        signals: 12,
                        topChannel: "email",
                        channelPerformance: {
                            email: {
                                sent: 120,
                                replied: 24,
                                bounced: 2,
                                failed: 1,
                                replyRate: 20,
                                bounceRate: 1.5,
                            },
                            whatsapp: {
                                sent: 40,
                                replied: 6,
                                bounced: 1,
                                failed: 0,
                                replyRate: 15,
                                bounceRate: 2.5,
                            },
                        },
                        segmentCoverage: 80,
                    },
                    network: {
                        signals: 80,
                        activeOrganizations: 12,
                        topChannel: "email",
                        bestWindow: {
                            dayOfWeek: "wednesday",
                            hour: 10,
                            timezone: "America/Sao_Paulo",
                            confidence: 72,
                        },
                    },
                },
            });
        }

        if (method === "GET" && path === "/api/signals/actionable-alerts") {
            return jsonResponse(route, {
                success: true,
                data: [],
            });
        }

        if (method === "GET" && path === "/api/scoring/leaderboard") {
            return jsonResponse(route, {
                success: true,
                data: [
                    {
                        id: "lead-1",
                        name: "Lead E2E",
                        email: "lead@example.com",
                        phone: "11999999999",
                        whatsapp: "11999999999",
                        companyName: "Acme",
                        jobTitle: "Founder",
                        score: 84,
                        temperature: "HOT",
                        status: "NEW",
                        lastInteraction: new Date().toISOString(),
                        scoreBreakdown: {
                            enrichment: 25,
                            interaction: 20,
                            timing: 18,
                            icp: 21,
                        },
                        recommendedAction: "EMAIL",
                    },
                ],
            });
        }

        if (method === "POST" && path === "/api/scoring/recalculate") {
            return jsonResponse(route, {
                success: true,
                data: {
                    jobId: "score-job-1",
                    queued: true,
                    leadCount: 1,
                },
            });
        }

        if (method === "POST" && path === "/api/signals/leads/recommendations") {
            const body = (request.postDataJSON() || {}) as { leadIds?: string[] };
            const leadIds = body.leadIds || [];
            const items = leadIds.map((leadId) => ({
                leadId,
                leadSegment: "smb-tech",
                sharedScore: 72,
                recommendedChannel: "email",
                bestWindow: {
                    dayOfWeek: "wednesday",
                    hour: 10,
                    timezone: "America/Sao_Paulo",
                },
                confidence: 71,
                reasons: ["Historico de resposta"],
                aggregateImpact: {
                    segmentReplyRate: 22,
                    channelReplyRate: 20,
                    channelBounceRate: 2,
                },
            }));

            return jsonResponse(route, {
                success: true,
                data: items,
            });
        }

        if (method === "GET" && path === "/api/leads") {
            return jsonResponse(route, {
                data: [
                    {
                        id: "lead-1",
                        fullName: "Lead E2E",
                        email: "lead@example.com",
                        companyName: "Acme",
                        jobTitle: "Founder",
                        score: 77,
                        temperature: "HOT",
                        status: "NEW",
                        createdAt: new Date().toISOString(),
                    },
                ],
                meta: {
                    total: 1,
                    page: 1,
                    limit: 20,
                    totalPages: 1,
                },
            });
        }

        if (method === "GET" && path === "/api/campaigns") {
            return jsonResponse(route, {
                success: true,
                data: [
                    {
                        id: "campaign-1",
                        name: "Outbound Q1",
                        type: "EMAIL",
                        status: "DRAFT",
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        steps: [],
                        leads: [],
                        stats: {
                            totalLeads: 1,
                            completedLeads: 0,
                            repliedLeads: 0,
                            conversionRate: 0,
                        },
                    },
                ],
                meta: {
                    total: 1,
                    page: 1,
                    limit: 20,
                    totalPages: 1,
                },
            });
        }

        if (method === "GET" && path === "/api/inbox/conversations") {
            return jsonResponse(route, {
                success: true,
                data: [
                    {
                        lead: {
                            id: "lead-1",
                            fullName: "Lead E2E",
                            companyName: "Acme",
                            email: "lead@example.com",
                            temperature: "HOT",
                        },
                        unreadCount: 0,
                        lastMessage: {
                            id: "msg-1",
                            type: "EMAIL",
                            direction: "INBOUND",
                            content: "Vamos marcar uma demo",
                            createdAt: new Date().toISOString(),
                        },
                    },
                ],
                meta: {
                    total: 1,
                    page: 1,
                    limit: 20,
                    totalPages: 1,
                },
            });
        }

        if (method === "GET" && path.startsWith("/api/inbox/") && path.endsWith("/messages")) {
            return jsonResponse(route, {
                success: true,
                data: {
                    lead: {
                        id: "lead-1",
                        fullName: "Lead E2E",
                        email: "lead@example.com",
                        companyName: "Acme",
                    },
                    messages: [
                        {
                            id: "msg-1",
                            type: "EMAIL",
                            direction: "INBOUND",
                            content: "Temos interesse",
                            createdAt: new Date().toISOString(),
                        },
                    ],
                },
            });
        }

        if (method === "GET" && path.startsWith("/api/inbox/") && path.endsWith("/intelligence")) {
            return jsonResponse(route, {
                success: true,
                data: {
                    temperature: "HOT",
                    objection: null,
                    hotLead: true,
                    followup: null,
                    suggestions: ["Vamos agendar uma call curta?"],
                },
            });
        }

        if (method === "GET" && path.startsWith("/api/signals/leads/") && path.endsWith("/recommendation")) {
            return jsonResponse(route, {
                success: true,
                data: {
                    leadId: "lead-1",
                    leadSegment: "smb-tech",
                    sharedScore: 78,
                    recommendedChannel: "email",
                    bestWindow: {
                        dayOfWeek: "wednesday",
                        hour: 10,
                        timezone: "America/Sao_Paulo",
                    },
                    confidence: 70,
                    reasons: ["Janela historicamente melhor"],
                    aggregateImpact: {
                        segmentReplyRate: 24,
                        channelReplyRate: 22,
                        channelBounceRate: 2,
                    },
                },
            });
        }

        if (method === "GET" && path === "/api/integrations/status") {
            return jsonResponse(route, {
                success: true,
                data: {
                    twitterConnected: true,
                    linkedinConnected: true,
                    twitter: {
                        connected: true,
                        expiresAt: null,
                        hasRefreshToken: true,
                        scope: "tweet.read tweet.write",
                    },
                    linkedin: {
                        connected: true,
                        expiresAt: null,
                        hasRefreshToken: true,
                        scope: "w_member_social",
                        authorUrn: "urn:li:person:123",
                    },
                    publishQueue: {
                        queued: 1,
                        processing: 0,
                        failed: 0,
                        success: 0,
                    },
                },
            });
        }

        if (method === "GET" && path === "/api/ops/summary") {
            return jsonResponse(route, {
                success: true,
                data: {
                    timestamp: new Date().toISOString(),
                    queues: {
                        campaign: {
                            waiting: 2,
                            active: 1,
                            completed: 30,
                            failed: 0,
                        },
                        social_publish: {
                            waiting: 1,
                            active: 0,
                            completed: 8,
                            failed: 1,
                        },
                    },
                    workers: [
                        {
                            workerName: "campaign-worker",
                            queueName: "campaign",
                            startedAt: new Date(Date.now() - 30_000).toISOString(),
                            processed: 12,
                            completed: 11,
                            failed: 1,
                            stalled: 0,
                        },
                    ],
                    alerts: [
                        {
                            level: "warning",
                            queue: "social_publish",
                            worker: "social-publish-worker",
                            message: "Queue backlog is high (201 jobs)",
                        },
                    ],
                    redis: {
                        usedMemoryHuman: "4.01M",
                        usedMemoryPeakHuman: "4.84M",
                    },
                },
            });
        }

        if (method === "GET" && path === "/api/ops/errors") {
            return jsonResponse(route, {
                success: true,
                data: [
                    {
                        workerName: "social-publish-worker",
                        queueName: "social_publish",
                        message: "LinkedIn token refresh failed (401): invalid_token",
                        timestamp: new Date().toISOString(),
                    },
                ],
            });
        }

        if (method === "GET" && path === "/api/ops/alerts") {
            return jsonResponse(route, {
                success: true,
                data: [
                    {
                        level: "warning",
                        queue: "social_publish",
                        worker: "social-publish-worker",
                        message: "Queue backlog is high (201 jobs)",
                    },
                ],
            });
        }

        if (method === "GET" && path === "/api/distribution") {
            return jsonResponse(route, {
                success: true,
                data: [
                    {
                        id: "draft-1",
                        organizationId: "org-e2e",
                        signalId: "signal-1",
                        format: "THREAD",
                        content: "Conteudo de teste para publicacao",
                        editedContent: null,
                        status: "APPROVED",
                        publishedAt: null,
                        platform: null,
                        impressions: null,
                        engagement: null,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    },
                ],
                meta: {
                    total: 1,
                    page: 1,
                    limit: 20,
                    totalPages: 1,
                },
            });
        }

        if (method === "GET" && path === "/api/integrations/publish-jobs") {
            return jsonResponse(route, {
                success: true,
                data: {
                    items: [
                        {
                            id: "job-1",
                            organizationId: "org-e2e",
                            draftId: "draft-1",
                            platform: "TWITTER",
                            content: "Conteudo de teste para publicacao",
                            status: "QUEUED",
                            attempts: 1,
                            maxAttempts: 5,
                            externalPostId: null,
                            errorMessage: null,
                            queuedAt: new Date().toISOString(),
                            processedAt: null,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                        },
                    ],
                    meta: {
                        page: 1,
                        limit: 30,
                        total: 1,
                        totalPages: 1,
                    },
                },
            });
        }

        if (method === "POST" && path === "/api/integrations/twitter/publish") {
            return jsonResponse(route, {
                success: true,
                data: {
                    jobId: "job-new-twitter",
                    status: "QUEUED",
                    platform: "TWITTER",
                    queuedAt: new Date().toISOString(),
                },
            });
        }

        if (method === "POST" && path === "/api/integrations/linkedin/publish") {
            return jsonResponse(route, {
                success: true,
                data: {
                    jobId: "job-new-linkedin",
                    status: "QUEUED",
                    platform: "LINKEDIN",
                    queuedAt: new Date().toISOString(),
                },
            });
        }

        if (method === "POST" && path.endsWith("/retry")) {
            return jsonResponse(route, {
                success: true,
                data: {
                    id: "job-1",
                    status: "QUEUED",
                },
            });
        }

        if (method === "POST" && path === "/api/auth/register") {
            return jsonResponse(route, {
                success: true,
                data: {
                    token: "token-e2e",
                    user: {
                        id: "user-e2e",
                        name: "Joao Silva",
                        email: "joao@example.com",
                        organizationId: "org-e2e",
                        organization: {
                            id: "org-e2e",
                            name: "Minha Empresa LTDA",
                            onboardingCompleted: true,
                        },
                    },
                    organization: {
                        id: "org-e2e",
                        name: "Minha Empresa LTDA",
                    },
                },
            });
        }

        return jsonResponse(route, {
            success: true,
            data: {},
            meta: {
                total: 0,
                page: 1,
                limit: 20,
                totalPages: 1,
            },
        });
    });
}
