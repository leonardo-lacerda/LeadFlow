import { Queue } from 'bullmq';
import { redis } from './redis.js';

const connection = {
    host: redis.options.host,
    port: redis.options.port,
    password: redis.options.password,
};

// Email Queue
export const emailQueue = new Queue('email', { connection });

// WhatsApp Queue
export const whatsappQueue = new Queue('whatsapp', { connection });

// Scraping Queue
export const scrapingQueue = new Queue('scraping', { connection });

// Enrichment Queue
export const enrichmentQueue = new Queue('enrichment', { connection });

// Campaign Queue
export const campaignQueue = new Queue('campaign', { connection });

// AI Queue
export const aiQueue = new Queue('ai', { connection });

// Scoring Queue
export const scoringQueue = new Queue('scoring', { connection });

// Analytics queue
export const analyticsQueue = new Queue('analytics', { connection });

// Inbox follow-up queue
export const inboxFollowupQueue = new Queue('inbox_followup', { connection });

// Signal detector queue
export const signalDetectorQueue = new Queue('signal_detector', { connection });

// Social publish queue
export const socialPublishQueue = new Queue('social_publish', { connection });

// Agent queue
export const agentQueue = new Queue('agent', { connection });

export const allQueues = {
    email: emailQueue,
    whatsapp: whatsappQueue,
    scraping: scrapingQueue,
    enrichment: enrichmentQueue,
    campaign: campaignQueue,
    ai: aiQueue,
    scoring: scoringQueue,
    analytics: analyticsQueue,
    inbox_followup: inboxFollowupQueue,
    signal_detector: signalDetectorQueue,
    social_publish: socialPublishQueue,
    agent: agentQueue,
} as const;

console.log('Queues initialized');
