import bcrypt from 'bcrypt';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DAY_MS = 24 * 60 * 60 * 1000;
const ago = (days: number, hours = 0) => new Date(Date.now() - days * DAY_MS - hours * 60 * 60 * 1000);

async function resetOrg(organizationId: string) {
    await prisma.passwordResetToken.deleteMany({ where: { user: { organizationId } } });
    await prisma.notification.deleteMany({ where: { organizationId } });
    await prisma.organizationInvite.deleteMany({ where: { organizationId } });

    await prisma.signalEvent.deleteMany({ where: { organizationId } });
    await prisma.distributionDraft.deleteMany({ where: { organizationId } });
    await prisma.signal.deleteMany({ where: { organizationId } });
    await prisma.sharedLeadClaim.deleteMany({ where: { organizationId } });

    await prisma.message.deleteMany({ where: { lead: { organizationId } } });
    await prisma.leadNote.deleteMany({ where: { lead: { organizationId } } });
    await prisma.activity.deleteMany({
        where: {
            OR: [{ lead: { organizationId } }, { user: { organizationId } }],
        },
    });

    await prisma.campaignLead.deleteMany({ where: { campaign: { organizationId } } });
    await prisma.campaignStep.deleteMany({ where: { campaign: { organizationId } } });
    await prisma.campaign.deleteMany({ where: { organizationId } });

    await prisma.lead.deleteMany({ where: { organizationId } });
    await prisma.template.deleteMany({ where: { organizationId } });
    await prisma.scrapingJob.deleteMany({ where: { organizationId } });
    await prisma.enrichmentJob.deleteMany({ where: { organizationId } });
    await prisma.aiJob.deleteMany({ where: { organizationId } });
    await prisma.mailbox.deleteMany({ where: { organizationId } });
    await prisma.whatsappInstance.deleteMany({ where: { organizationId } });
}

async function syncUsage(organizationId: string) {
    const [leadsUsed, emailsUsed, whatsappUsed] = await Promise.all([
        prisma.lead.count({ where: { organizationId } }),
        prisma.message.count({ where: { lead: { organizationId }, type: 'EMAIL', direction: 'OUTBOUND' } }),
        prisma.message.count({ where: { lead: { organizationId }, type: 'WHATSAPP', direction: 'OUTBOUND' } }),
    ]);

    await prisma.organization.update({
        where: { id: organizationId },
        data: {
            leadsUsed,
            emailsUsed,
            whatsappUsed,
            enrichmentsUsed: Math.min(leadsUsed, 200),
        },
    });
}

async function seed() {
    const passwordHash = await bcrypt.hash('Leadflow@123', 10);

    const acme = await prisma.organization.upsert({
        where: { slug: 'acme-growth' },
        update: {
            name: 'Acme Growth',
            plan: 'GROWTH',
            onboardingCompleted: true,
            networkOptIn: true,
            apiKeys: {
                twitterAccessToken: 'seed-twitter-token-acme',
                linkedinAccessToken: 'seed-linkedin-token-acme',
                linkedinAuthorUrn: 'urn:li:person:seed-acme-owner',
            },
            icpDefinition: {
                industries: ['fintech', 'saas'],
                personas: { titles: ['cto', 'head of sales', 'revops'] },
                companySizes: ['11-50', '51-200', '201-500'],
                locations: ['brasil', 'sao paulo', 'curitiba'],
            },
        },
        create: {
            name: 'Acme Growth',
            slug: 'acme-growth',
            plan: 'GROWTH',
            onboardingCompleted: true,
            networkOptIn: true,
            leadsLimit: 5000,
            emailsLimit: 15000,
            whatsappLimit: 5000,
            enrichmentsLimit: 5000,
            apiKeys: {
                twitterAccessToken: 'seed-twitter-token-acme',
                linkedinAccessToken: 'seed-linkedin-token-acme',
                linkedinAuthorUrn: 'urn:li:person:seed-acme-owner',
            },
            icpDefinition: {
                industries: ['fintech', 'saas'],
                personas: { titles: ['cto', 'head of sales', 'revops'] },
                companySizes: ['11-50', '51-200', '201-500'],
                locations: ['brasil', 'sao paulo', 'curitiba'],
            },
        },
    });

    const beta = await prisma.organization.upsert({
        where: { slug: 'beta-ops' },
        update: {
            name: 'Beta Ops',
            plan: 'SCALE',
            onboardingCompleted: true,
            networkOptIn: true,
            icpDefinition: {
                industries: ['edtech', 'healthtech', 'fintech'],
                personas: { titles: ['coo', 'head of growth'] },
                companySizes: ['51-200', '201-500', '500+'],
                locations: ['brasil'],
            },
        },
        create: {
            name: 'Beta Ops',
            slug: 'beta-ops',
            plan: 'SCALE',
            onboardingCompleted: true,
            networkOptIn: true,
            leadsLimit: 10000,
            emailsLimit: 30000,
            whatsappLimit: 12000,
            enrichmentsLimit: 10000,
            icpDefinition: {
                industries: ['edtech', 'healthtech', 'fintech'],
                personas: { titles: ['coo', 'head of growth'] },
                companySizes: ['51-200', '201-500', '500+'],
                locations: ['brasil'],
            },
        },
    });

    await Promise.all([
        prisma.user.upsert({
            where: { email: 'owner@acme.local' },
            update: { name: 'Acme Owner', role: 'OWNER', organizationId: acme.id, passwordHash },
            create: { email: 'owner@acme.local', name: 'Acme Owner', role: 'OWNER', organizationId: acme.id, passwordHash },
        }),
        prisma.user.upsert({
            where: { email: 'member@acme.local' },
            update: { name: 'Acme SDR', role: 'MEMBER', organizationId: acme.id, passwordHash },
            create: { email: 'member@acme.local', name: 'Acme SDR', role: 'MEMBER', organizationId: acme.id, passwordHash },
        }),
        prisma.user.upsert({
            where: { email: 'owner@beta.local' },
            update: { name: 'Beta Owner', role: 'OWNER', organizationId: beta.id, passwordHash },
            create: { email: 'owner@beta.local', name: 'Beta Owner', role: 'OWNER', organizationId: beta.id, passwordHash },
        }),
    ]);

    await resetOrg(acme.id);
    await resetOrg(beta.id);

    const scrapingJobAcme = await prisma.scrapingJob.create({
        data: {
            name: 'Dentistas Curitiba - Seed',
            source: 'google_maps',
            query: {
                query: 'dentistas curitiba',
                city: 'Curitiba',
                leadPool: { cacheHits: 14, cacheCoverage: 0.41, generatedAt: new Date().toISOString() },
            } satisfies Prisma.InputJsonValue,
            status: 'COMPLETED',
            progress: 100,
            totalItems: 74,
            processedItems: 74,
            leadsCreated: 5,
            lastRunAt: ago(1),
            organizationId: acme.id,
        },
    });

    const acmeLeads = await Promise.all([
        prisma.lead.create({
            data: {
                fullName: 'Ana Costa',
                email: 'ana.costa@finpay.com.br',
                phone: '+55 41 99999-1001',
                whatsapp: '+55 41 99999-1001',
                linkedinUrl: 'https://www.linkedin.com/in/ana-costa-finpay',
                companyName: 'FinPay',
                companyDomain: 'finpay.com.br',
                companyCnpj: '12.345.678/0001-90',
                companySize: '51-200',
                companyRevenue: '50M-100M',
                companyEmployees: '140',
                industry: 'Fintech',
                technologies: ['hubspot', 'segment', 'aws'],
                maturityLevel: 'ESTABLISHED',
                icpReasons: ['Segmento aderente ao ICP', 'Tomador de decisao tecnico'],
                jobTitle: 'CTO',
                seniority: 'C-Level',
                department: 'Tecnologia',
                city: 'Curitiba',
                state: 'PR',
                country: 'BR',
                source: 'google_maps',
                sourceUrl: 'https://maps.google.com/?cid=seed-finpay',
                sourceFingerprint: 'seed-acme-finpay-001',
                status: 'INTERESTED',
                score: 93,
                icpMatch: 0.91,
                temperature: 'HOT',
                lastInteraction: ago(1),
                lastScoreUpdate: ago(1),
                scoreBreakdown: { enrichment: 24, interaction: 28, timing: 19, icp: 22 } satisfies Prisma.InputJsonValue,
                tags: ['fintech', 'decision-maker'],
                scrapingJobId: scrapingJobAcme.id,
                organizationId: acme.id,
            },
        }),
        prisma.lead.create({
            data: {
                fullName: 'Bruno Almeida',
                email: 'bruno@clinicadigital.com.br',
                whatsapp: '+55 11 98888-2010',
                companyName: 'Clinica Digital',
                companyDomain: 'clinicadigital.com.br',
                companySize: '11-50',
                industry: 'Healthtech',
                technologies: ['rd station', 'pipedrive'],
                maturityLevel: 'GROWING',
                jobTitle: 'Head of Growth',
                seniority: 'Head',
                department: 'Growth',
                city: 'Sao Paulo',
                state: 'SP',
                source: 'linkedin',
                sourceFingerprint: 'seed-acme-clinicadigital-002',
                status: 'REPLIED',
                score: 78,
                icpMatch: 0.74,
                temperature: 'WARM',
                lastInteraction: ago(3),
                lastScoreUpdate: ago(1),
                scoreBreakdown: { enrichment: 21, interaction: 22, timing: 16, icp: 19 } satisfies Prisma.InputJsonValue,
                tags: ['healthtech'],
                scrapingJobId: scrapingJobAcme.id,
                organizationId: acme.id,
            },
        }),
        prisma.lead.create({
            data: {
                fullName: 'Carla Mendes',
                email: 'carla@opsstack.io',
                companyName: 'OpsStack',
                companyDomain: 'opsstack.io',
                companySize: '201-500',
                industry: 'SaaS',
                technologies: ['salesforce', 'segment', 'mixpanel'],
                maturityLevel: 'ESTABLISHED',
                jobTitle: 'RevOps Manager',
                seniority: 'Manager',
                department: 'Revenue',
                city: 'Rio de Janeiro',
                state: 'RJ',
                source: 'cnpj',
                sourceFingerprint: 'seed-acme-opsstack-003',
                status: 'CONTACTED',
                score: 66,
                icpMatch: 0.62,
                temperature: 'WARM',
                lastInteraction: ago(8),
                lastScoreUpdate: ago(2),
                scoreBreakdown: { enrichment: 20, interaction: 16, timing: 12, icp: 18 } satisfies Prisma.InputJsonValue,
                tags: ['revops'],
                scrapingJobId: scrapingJobAcme.id,
                organizationId: acme.id,
            },
        }),
        prisma.lead.create({
            data: {
                fullName: 'Diego Nunes',
                email: 'diego@byteware.com.br',
                companyName: 'Byteware',
                companyDomain: 'byteware.com.br',
                companySize: '11-50',
                industry: 'SaaS',
                jobTitle: 'Founder',
                seniority: 'Founder',
                city: 'Belo Horizonte',
                state: 'MG',
                source: 'google_maps',
                sourceFingerprint: 'seed-acme-byteware-004',
                status: 'NEW',
                score: 44,
                icpMatch: 0.4,
                temperature: 'COLD',
                lastScoreUpdate: ago(4),
                scoreBreakdown: { enrichment: 16, interaction: 8, timing: 7, icp: 13 } satisfies Prisma.InputJsonValue,
                tags: ['founder'],
                scrapingJobId: scrapingJobAcme.id,
                organizationId: acme.id,
            },
        }),
        prisma.lead.create({
            data: {
                fullName: 'Elaine Souza',
                email: 'elaine@odontocenter.com.br',
                phone: '+55 41 95555-9090',
                whatsapp: '+55 41 95555-9090',
                companyName: 'Odonto Center',
                companyCnpj: '24.987.654/0001-10',
                companySize: '11-50',
                industry: 'Saude',
                jobTitle: 'Diretora Comercial',
                seniority: 'Director',
                department: 'Comercial',
                city: 'Curitiba',
                state: 'PR',
                source: 'google_maps',
                sourceFingerprint: 'seed-acme-odonto-005',
                status: 'ENRICHED',
                score: 57,
                icpMatch: 0.56,
                temperature: 'COLD',
                lastInteraction: ago(21),
                lastScoreUpdate: ago(3),
                scoreBreakdown: { enrichment: 19, interaction: 10, timing: 4, icp: 14 } satisfies Prisma.InputJsonValue,
                tags: ['saude'],
                scrapingJobId: scrapingJobAcme.id,
                organizationId: acme.id,
            },
        }),
    ]);

    const [leadAna, leadBruno, leadCarla, , leadElaine] = acmeLeads;

    const campaignAcme = await prisma.campaign.create({
        data: {
            name: 'Outbound ICP - Fevereiro',
            type: 'MULTI_CHANNEL',
            status: 'ACTIVE',
            settings: { timezone: 'America/Sao_Paulo', sendWindow: ['09:00', '18:00'] } satisfies Prisma.InputJsonValue,
            schedule: { weekdays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], maxPerDay: 120 } satisfies Prisma.InputJsonValue,
            metrics: { sent: 42, replied: 6, replyRate: 0.142 } satisfies Prisma.InputJsonValue,
            lastMetricsAt: ago(1),
            organizationId: acme.id,
        },
    });

    const stepEmail = await prisma.campaignStep.create({
        data: {
            campaignId: campaignAcme.id,
            order: 1,
            type: 'EMAIL',
            subject: 'Estrutura de outbound para {{companyName}}',
            content: 'Oi {{firstName}}, posso compartilhar um benchmark de reply rate para seu segmento?',
        },
    });

    const stepWhatsapp = await prisma.campaignStep.create({
        data: {
            campaignId: campaignAcme.id,
            order: 2,
            type: 'WHATSAPP',
            delayDays: 2,
            content: 'Oi {{firstName}}, voce viu o benchmark que enviei por email?',
        },
    });

    await prisma.campaignLead.createMany({
        data: [
            { campaignId: campaignAcme.id, leadId: leadAna.id, currentStep: 2, status: 'REPLIED' },
            { campaignId: campaignAcme.id, leadId: leadBruno.id, currentStep: 2, status: 'IN_PROGRESS', nextActionAt: ago(-1) },
            { campaignId: campaignAcme.id, leadId: leadCarla.id, currentStep: 1, status: 'IN_PROGRESS', nextActionAt: ago(-2) },
        ],
    });

    await prisma.message.createMany({
        data: [
            {
                type: 'EMAIL',
                direction: 'OUTBOUND',
                subject: 'Benchmark de reply rate para fintech',
                content: 'Ana, compartilho benchmark de reply rate para fintech B2B.',
                status: 'REPLIED',
                sentAt: ago(5, 3),
                deliveredAt: ago(5, 2),
                openedAt: ago(5, 1),
                clickedAt: ago(5, 1),
                repliedAt: ago(4, 20),
                responseTime: 7,
                externalId: 'seed-msg-acme-001',
                campaignStepId: stepEmail.id,
                leadId: leadAna.id,
                createdAt: ago(5, 3),
            },
            {
                type: 'EMAIL',
                direction: 'INBOUND',
                subject: 'Re: Benchmark de reply rate para fintech',
                content: 'Gostei. Vamos falar na proxima semana?',
                status: 'REPLIED',
                repliedAt: ago(4, 20),
                leadId: leadAna.id,
                createdAt: ago(4, 20),
            },
            {
                type: 'WHATSAPP',
                direction: 'OUTBOUND',
                content: 'Oi Bruno, voce viu meu email com benchmark de canais?',
                status: 'DELIVERED',
                sentAt: ago(3, 8),
                deliveredAt: ago(3, 8),
                campaignStepId: stepWhatsapp.id,
                leadId: leadBruno.id,
                createdAt: ago(3, 8),
            },
            {
                type: 'WHATSAPP',
                direction: 'INBOUND',
                content: 'Vi sim, podemos falar na sexta.',
                status: 'REPLIED',
                repliedAt: ago(2, 19),
                leadId: leadBruno.id,
                createdAt: ago(2, 19),
            },
            {
                type: 'EMAIL',
                direction: 'OUTBOUND',
                subject: 'Case de outbound para clinicas',
                content: 'Elaine, queria te mostrar um case de outbound para saude.',
                status: 'BOUNCED',
                sentAt: ago(20, 6),
                bouncedAt: ago(20, 6),
                campaignStepId: stepEmail.id,
                leadId: leadElaine.id,
                createdAt: ago(20, 6),
            },
        ],
    });

    const acmeSignalEvents: Prisma.SignalEventCreateManyInput[] = [];
    for (let i = 0; i < 10; i += 1) {
        acmeSignalEvents.push({
            dedupeKey: `seed-acme-email-sent-${i}`,
            organizationId: acme.id,
            leadId: i % 2 === 0 ? leadAna.id : leadBruno.id,
            campaignId: campaignAcme.id,
            eventType: 'MESSAGE_SENT',
            channel: 'EMAIL',
            outcome: 'SENT',
            leadSegment: 'fintech|cto',
            eventAt: ago(15 - i),
            metadata: { source: 'seed' } as Prisma.InputJsonValue,
        });
    }
    for (let i = 0; i < 4; i += 1) {
        acmeSignalEvents.push({
            dedupeKey: `seed-acme-email-replied-${i}`,
            organizationId: acme.id,
            leadId: leadAna.id,
            campaignId: campaignAcme.id,
            eventType: 'MESSAGE_REPLY_RECEIVED',
            channel: 'EMAIL',
            outcome: 'REPLIED',
            leadSegment: 'fintech|cto',
            eventAt: ago(12 - i),
            metadata: { source: 'seed' } as Prisma.InputJsonValue,
        });
    }
    await prisma.signalEvent.createMany({ data: acmeSignalEvents });

    const timingSignal = await prisma.signal.create({
        data: {
            organizationId: acme.id,
            signature: 'seed-acme-timing-tuesday-10h',
            type: 'TIMING',
            confidence: 87,
            insight: 'CTOs de fintech respondem 2.9x mais nas tercas as 10h.',
            dataPoints: 124,
            suggestedFormats: ['TWEET', 'THREAD', 'CHART'],
            rawData: { dayOfWeek: 'tuesday', hour: 10, replyRate: 0.118, baseline: 0.041 } satisfies Prisma.InputJsonValue,
            status: 'NEW',
        },
    });

    const channelSignal = await prisma.signal.create({
        data: {
            organizationId: acme.id,
            signature: 'seed-acme-channel-whatsapp-vs-email',
            type: 'CHANNEL',
            confidence: 76,
            insight: 'Para mid-market, WhatsApp converte 1.6x melhor que email.',
            dataPoints: 92,
            suggestedFormats: ['TWEET', 'MICRO_CASE', 'INSIGHT'],
            rawData: { emailReplyRate: 0.08, whatsappReplyRate: 0.129, segment: 'saas|growth' } satisfies Prisma.InputJsonValue,
            status: 'SEEN',
        },
    });

    await prisma.distributionDraft.createMany({
        data: [
            {
                organizationId: acme.id,
                signalId: timingSignal.id,
                format: 'TWEET',
                content: 'Analisamos 124 outreaches para CTOs de fintech e vimos 2.9x mais respostas nas tercas as 10h.',
                status: 'APPROVED',
            },
            {
                organizationId: acme.id,
                signalId: channelSignal.id,
                format: 'THREAD',
                content: 'Thread: como combinar email + WhatsApp para aumentar reply rate em contas mid-market.',
                editedContent: 'Thread pronta: 5 aprendizados praticos para combinar email e WhatsApp com base em 92 conversas.',
                status: 'PUBLISHED',
                platform: 'linkedin',
                publishedAt: ago(2),
                impressions: 1340,
                engagement: 96,
            },
            {
                organizationId: acme.id,
                signalId: timingSignal.id,
                format: 'INSIGHT',
                content: 'Terca 10h e a melhor janela para CTOs de fintech no funil atual.',
                status: 'DRAFT',
            },
        ],
    });

    const sharedPlace = await prisma.sharedLead.upsert({
        where: { googlePlaceId: 'seed-google-place-curitiba-001' },
        update: {
            companyName: 'Odonto Premium',
            city: 'Curitiba',
            state: 'PR',
            category: 'odontologia',
            confirmations: 5,
            quality: 82,
            source: 'google_maps',
            lastScrapedAt: ago(2),
        },
        create: {
            googlePlaceId: 'seed-google-place-curitiba-001',
            companyName: 'Odonto Premium',
            city: 'Curitiba',
            state: 'PR',
            category: 'odontologia',
            source: 'google_maps',
            confirmations: 5,
            quality: 82,
            lastScrapedAt: ago(2),
            rawData: { rating: 4.8, reviews: 212 } satisfies Prisma.InputJsonValue,
        },
    });

    const sharedCnpj = await prisma.sharedLead.upsert({
        where: { companyCnpj: '24.987.654/0001-10' },
        update: {
            companyName: 'Odonto Center',
            city: 'Curitiba',
            state: 'PR',
            category: 'clinica_odonto',
            confirmations: 3,
            quality: 74,
            source: 'cnpj',
            lastScrapedAt: ago(5),
        },
        create: {
            companyCnpj: '24.987.654/0001-10',
            companyName: 'Odonto Center',
            city: 'Curitiba',
            state: 'PR',
            category: 'clinica_odonto',
            source: 'cnpj',
            confirmations: 3,
            quality: 74,
            lastScrapedAt: ago(5),
        },
    });

    await prisma.sharedLeadClaim.upsert({
        where: { sharedLeadId_organizationId: { sharedLeadId: sharedPlace.id, organizationId: acme.id } },
        update: { leadId: leadElaine.id, claimedAt: ago(2) },
        create: { sharedLeadId: sharedPlace.id, organizationId: acme.id, leadId: leadElaine.id, claimedAt: ago(2) },
    });

    const scrapingJobBeta = await prisma.scrapingJob.create({
        data: {
            name: 'Edtech Brasil - Seed',
            source: 'linkedin',
            query: { query: 'edtech brasil head of growth', city: 'Sao Paulo' } satisfies Prisma.InputJsonValue,
            status: 'COMPLETED',
            progress: 100,
            totalItems: 40,
            processedItems: 40,
            leadsCreated: 2,
            lastRunAt: ago(2),
            organizationId: beta.id,
        },
    });

    const [betaLead1, betaLead2] = await Promise.all([
        prisma.lead.create({
            data: {
                fullName: 'Lucas Ribeiro',
                email: 'lucas@edupulse.com.br',
                companyName: 'EduPulse',
                companyDomain: 'edupulse.com.br',
                companySize: '201-500',
                industry: 'Edtech',
                jobTitle: 'Head of Growth',
                seniority: 'Head',
                department: 'Growth',
                city: 'Sao Paulo',
                state: 'SP',
                source: 'linkedin',
                sourceFingerprint: 'seed-beta-edupulse-001',
                status: 'REPLIED',
                score: 84,
                icpMatch: 0.82,
                temperature: 'HOT',
                lastInteraction: ago(2),
                lastScoreUpdate: ago(1),
                scoreBreakdown: { enrichment: 22, interaction: 26, timing: 17, icp: 19 } satisfies Prisma.InputJsonValue,
                tags: ['edtech'],
                scrapingJobId: scrapingJobBeta.id,
                organizationId: beta.id,
            },
        }),
        prisma.lead.create({
            data: {
                fullName: 'Marina Rocha',
                email: 'marina@healthops.io',
                companyName: 'HealthOps',
                companyDomain: 'healthops.io',
                companySize: '51-200',
                industry: 'Healthtech',
                jobTitle: 'COO',
                seniority: 'C-Level',
                department: 'Operacoes',
                city: 'Florianopolis',
                state: 'SC',
                source: 'google_maps',
                sourceFingerprint: 'seed-beta-healthops-002',
                status: 'CONTACTED',
                score: 61,
                icpMatch: 0.58,
                temperature: 'WARM',
                lastInteraction: ago(5),
                lastScoreUpdate: ago(2),
                scoreBreakdown: { enrichment: 20, interaction: 14, timing: 11, icp: 16 } satisfies Prisma.InputJsonValue,
                tags: ['healthtech'],
                scrapingJobId: scrapingJobBeta.id,
                organizationId: beta.id,
            },
        }),
    ]);

    const betaEvents: Prisma.SignalEventCreateManyInput[] = [];
    for (let i = 0; i < 8; i += 1) {
        betaEvents.push({
            dedupeKey: `seed-beta-email-sent-${i}`,
            organizationId: beta.id,
            leadId: i % 2 === 0 ? betaLead1.id : betaLead2.id,
            eventType: 'MESSAGE_SENT',
            channel: 'EMAIL',
            outcome: 'SENT',
            leadSegment: 'edtech|growth',
            eventAt: ago(11 - i),
            metadata: { source: 'seed' } as Prisma.InputJsonValue,
        });
    }
    for (let i = 0; i < 3; i += 1) {
        betaEvents.push({
            dedupeKey: `seed-beta-email-replied-${i}`,
            organizationId: beta.id,
            leadId: betaLead1.id,
            eventType: 'MESSAGE_REPLY_RECEIVED',
            channel: 'EMAIL',
            outcome: 'REPLIED',
            leadSegment: 'edtech|growth',
            eventAt: ago(8 - i),
            metadata: { source: 'seed' } as Prisma.InputJsonValue,
        });
    }
    await prisma.signalEvent.createMany({ data: betaEvents });

    await prisma.signal.create({
        data: {
            organizationId: beta.id,
            signature: 'seed-beta-icp-edtech-growth',
            type: 'ICP',
            confidence: 81,
            insight: 'Empresas Edtech 201-500 com Head of Growth convertem 2.1x acima da media.',
            dataPoints: 66,
            suggestedFormats: ['INSIGHT', 'MICRO_CASE'],
            rawData: { segment: 'edtech|growth', conversionLift: 2.1 } satisfies Prisma.InputJsonValue,
            status: 'NEW',
        },
    });

    await prisma.sharedLeadClaim.upsert({
        where: { sharedLeadId_organizationId: { sharedLeadId: sharedCnpj.id, organizationId: beta.id } },
        update: { leadId: betaLead2.id, claimedAt: ago(1) },
        create: { sharedLeadId: sharedCnpj.id, organizationId: beta.id, leadId: betaLead2.id, claimedAt: ago(1) },
    });

    await Promise.all([syncUsage(acme.id), syncUsage(beta.id)]);

    // eslint-disable-next-line no-console
    console.log('\nSeed finalizado com sucesso.');
    // eslint-disable-next-line no-console
    console.log('Usuarios de desenvolvimento:');
    // eslint-disable-next-line no-console
    console.log('- owner@acme.local / Leadflow@123');
    // eslint-disable-next-line no-console
    console.log('- member@acme.local / Leadflow@123');
    // eslint-disable-next-line no-console
    console.log('- owner@beta.local / Leadflow@123\n');
}

seed()
    .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Falha ao executar seed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
