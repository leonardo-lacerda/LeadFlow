import 'dotenv/config';

export const env = {
    // Server
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '4000'),
    HOST: process.env.HOST || '0.0.0.0',

    // Database
    DATABASE_URL: process.env.DATABASE_URL!,

    // Redis
    REDIS_HOST: process.env.REDIS_HOST || 'localhost',
    REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379'),
    REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',

    // JWT
    JWT_SECRET: process.env.JWT_SECRET!,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
    JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',

    // Email
    SMTP_HOST: process.env.SMTP_HOST || '',
    SMTP_PORT: parseInt(process.env.SMTP_PORT || '587'),
    SMTP_USER: process.env.SMTP_USER || '',
    SMTP_PASS: process.env.SMTP_PASS || '',
    SMTP_FROM: process.env.SMTP_FROM || '',

    // Frontend
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
    API_BASE_URL: process.env.API_BASE_URL || '',

    // Python Services
    SCRAPING_SERVICE_URL: process.env.SCRAPING_SERVICE_URL || 'http://localhost:5001',
    ENRICHMENT_SERVICE_URL: process.env.ENRICHMENT_SERVICE_URL || 'http://localhost:5002',
    AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'http://localhost:5003',
    SCRAPING_WEBHOOK_URL: process.env.SCRAPING_WEBHOOK_URL || '',
    SCRAPING_WEBHOOK_SECRET: process.env.SCRAPING_WEBHOOK_SECRET || '',
    ALLOW_MOCK_SCRAPING_LEADS_IN_PRODUCTION:
        process.env.ALLOW_MOCK_SCRAPING_LEADS_IN_PRODUCTION === 'true',
    SCRAPING_NO_API: process.env.SCRAPING_NO_API === 'true',
    ENRICHMENT_WEBHOOK_URL: process.env.ENRICHMENT_WEBHOOK_URL || '',
    ENRICHMENT_WEBHOOK_SECRET: process.env.ENRICHMENT_WEBHOOK_SECRET || '',
    AI_WEBHOOK_URL: process.env.AI_WEBHOOK_URL || '',
    AI_WEBHOOK_SECRET: process.env.AI_WEBHOOK_SECRET || '',
    WHATSAPP_WEBHOOK_SECRET: process.env.WHATSAPP_WEBHOOK_SECRET || '',
    AUTO_ENRICH_LEADS: process.env.AUTO_ENRICH_LEADS === 'true',

    // Evolution API
    EVOLUTION_API_URL: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
    EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY || '',

    // External APIs
    HUNTER_API_KEY: process.env.HUNTER_API_KEY || '',
    SNOV_API_KEY: process.env.SNOV_API_KEY || '',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',

    // Email polling
    IMAP_POLL_INTERVAL: parseInt(process.env.IMAP_POLL_INTERVAL || '300000'),

    // Runtime behavior
    RUN_WORKERS: process.env.RUN_WORKERS !== 'false',
    RUN_IMAP_POLLING: process.env.RUN_IMAP_POLLING !== 'false',
    INTERNAL_REQUEST_TIMEOUT_MS: parseInt(process.env.INTERNAL_REQUEST_TIMEOUT_MS || '30000'),

    // Security
    EMAIL_WEBHOOK_SECRET: process.env.EMAIL_WEBHOOK_SECRET || '',
    EMAIL_TRACKING_SIGNING_SECRET: process.env.EMAIL_TRACKING_SIGNING_SECRET || '',
    EMAIL_TRACKING_ALLOWED_DOMAINS: process.env.EMAIL_TRACKING_ALLOWED_DOMAINS || '',
    SECRETS_ENCRYPTION_KEY: process.env.SECRETS_ENCRYPTION_KEY || '',
    WEBHOOK_URL_ALLOWLIST: process.env.WEBHOOK_URL_ALLOWLIST || '',

    // Social OAuth
    OAUTH_STATE_TTL_SECONDS: parseInt(process.env.OAUTH_STATE_TTL_SECONDS || '900'),
    OAUTH_STATE_PREFIX: process.env.OAUTH_STATE_PREFIX || 'oauth:state',
    TWITTER_CLIENT_ID: process.env.TWITTER_CLIENT_ID || '',
    TWITTER_CLIENT_SECRET: process.env.TWITTER_CLIENT_SECRET || '',
    TWITTER_REDIRECT_URI: process.env.TWITTER_REDIRECT_URI || '',
    TWITTER_OAUTH_SCOPES:
        process.env.TWITTER_OAUTH_SCOPES || 'tweet.read tweet.write users.read offline.access',
    LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID || '',
    LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET || '',
    LINKEDIN_REDIRECT_URI: process.env.LINKEDIN_REDIRECT_URI || '',
    LINKEDIN_OAUTH_SCOPES:
        process.env.LINKEDIN_OAUTH_SCOPES || 'openid profile email w_member_social',
};

// Validate required env variables
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

if (process.env.NODE_ENV === 'production' && !process.env.SECRETS_ENCRYPTION_KEY) {
    throw new Error('Missing required environment variable in production: SECRETS_ENCRYPTION_KEY');
}
