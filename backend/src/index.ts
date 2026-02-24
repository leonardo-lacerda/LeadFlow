import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';

// Middlewares
import { authenticate } from './middlewares/auth.js';

// Routes
import { authRoutes } from './modules/auth/auth.routes.js';
import { leadsRoutes } from './modules/leads/leads.routes.js';
import { scrapingRoutes } from './modules/scraping/scraping.routes.js';
import { enrichmentRoutes } from './modules/enrichment/enrichment.routes.js';
import { emailRoutes } from './modules/email/email.routes.js';
import { whatsappRoutes } from './modules/whatsapp/whatsapp.routes.js';
import { aiRoutes } from './modules/ai/ai.routes.js';
import { campaignsRoutes } from './modules/campaigns/campaigns.routes.js';
import { inboxRoutes } from './modules/inbox/inbox.routes.js';
import { organizationRoutes } from './modules/organization/organization.routes.js';
import { notificationRoutes } from './modules/notifications/notifications.routes.js';
import { analyticsRoutes } from './modules/analytics/analytics.routes.js';
import { scoringRoutes } from './modules/scoring/scoring.routes.js';
import { signalsRoutes } from './modules/signals/signals.routes.js';
import { leadPoolRoutes } from './modules/lead-pool/lead-pool.routes.js';
import { distributionRoutes } from './modules/distribution/distribution.routes.js';
import { networkRoutes } from './modules/network/network.routes.js';
import { integrationsRoutes } from './modules/integrations/integrations.routes.js';
import { opsRoutes } from './modules/ops/ops.routes.js';
import { billingRoutes } from './modules/billing/billing.routes.js';
import { agentRoutes } from './modules/agent/agent.routes.js';
import { startScrapingWorker } from './jobs/scraping.worker.js';
import { startEnrichmentWorker } from './jobs/enrichment.worker.js';
import { startEmailWorker } from './jobs/email.worker.js';
import { startWhatsappWorker } from './jobs/whatsapp.worker.js';
import { startAiWorker } from './jobs/ai.worker.js';
import { startImapPolling } from './jobs/email.imap.js';
import { startCampaignWorker } from './jobs/campaign.worker.js';
import { startScoringWorker } from './modules/scoring/scoring.worker.js';
import { startFollowUpWorker } from './modules/inbox/followup.worker.js';
import { startAnalyticsWorker } from './modules/analytics/analytics.worker.js';
import { startSignalDetectorWorker } from './modules/signals/signal-detector.worker.js';
import { startSocialPublishWorker } from './modules/integrations/social-publish.worker.js';
import { startAgentWorker } from './modules/agent/agent.worker.js';

const fastify = Fastify({
    logger: env.NODE_ENV === 'development',
});

// Plugins
await fastify.register(cors, {
    origin: env.FRONTEND_URL,
    credentials: true,
});

await fastify.register(cookie);

await fastify.register(helmet, {
    global: true,
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
});

await fastify.register(rateLimit, {
    global: false,
    max: 300,
    timeWindow: '1 minute',
    allowList: ['127.0.0.1', '::1'],
});

await fastify.register(jwt, {
    secret: env.JWT_SECRET,
    sign: {
        expiresIn: env.JWT_EXPIRES_IN,
    },
});

fastify.decorate('authenticate', authenticate);

await fastify.register(multipart, {
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
});

// Health check
fastify.get('/health', async (_request, reply) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        await redis.ping();
        return reply.send({
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: 'connected',
            redis: 'connected',
        });
    } catch (error) {
        return reply.code(503).send({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Routes
fastify.register(authRoutes, { prefix: '/api/auth' });
fastify.register(leadsRoutes, { prefix: '/api/leads' });
fastify.register(scrapingRoutes, { prefix: '/api/scraping' });
fastify.register(enrichmentRoutes, { prefix: '/api/enrichment' });
fastify.register(emailRoutes, { prefix: '/api/email' });
fastify.register(whatsappRoutes, { prefix: '/api/whatsapp' });
fastify.register(aiRoutes, { prefix: '/api/ai' });
fastify.register(campaignsRoutes, { prefix: '/api/campaigns' });
fastify.register(inboxRoutes, { prefix: '/api/inbox' });
fastify.register(organizationRoutes, { prefix: '/api/organization' });
fastify.register(notificationRoutes, { prefix: '/api/notifications' });
fastify.register(analyticsRoutes, { prefix: '/api/analytics' });
fastify.register(scoringRoutes, { prefix: '/api/scoring' });
fastify.register(signalsRoutes, { prefix: '/api/signals' });
fastify.register(leadPoolRoutes, { prefix: '/api/lead-pool' });
fastify.register(distributionRoutes, { prefix: '/api/distribution' });
fastify.register(networkRoutes, { prefix: '/api/network' });
fastify.register(integrationsRoutes, { prefix: '/api/integrations' });
fastify.register(opsRoutes, { prefix: '/api/ops' });
fastify.register(billingRoutes, { prefix: '/api/billing' });
fastify.register(agentRoutes, { prefix: '/api/agent' });

if (env.RUN_WORKERS) {
    startScrapingWorker();
    startEnrichmentWorker();
    startEmailWorker();
    startWhatsappWorker();
    startAiWorker();
    startCampaignWorker();
    startScoringWorker();
    startFollowUpWorker();
    startAnalyticsWorker();
    startSignalDetectorWorker();
    startSocialPublishWorker();
    startAgentWorker();
}

if (env.RUN_IMAP_POLLING) {
    startImapPolling();
}

// Start server
const start = async () => {
    try {
        await fastify.listen({ port: env.PORT, host: env.HOST });
        console.log(
            [
                'Lastreia API Server is running',
                `Address: http://${env.HOST}:${env.PORT}`,
                `Environment: ${env.NODE_ENV}`,
                `Health: http://${env.HOST}:${env.PORT}/health`,
            ].join('\n')
        );
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

// Graceful shutdown
['SIGINT', 'SIGTERM'].forEach((signal) => {
    process.on(signal, async () => {
        console.log(`\nReceived ${signal}, closing gracefully...`);
        await fastify.close();
        await prisma.$disconnect();
        await redis.quit();
        process.exit(0);
    });
});

start();
