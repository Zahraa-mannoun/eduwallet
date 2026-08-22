import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { aiChatHandler, getAIInsightsHandler } from './ai.controller';

// Both endpoints call out to Gemini, which is slower and more expensive than a normal DB-backed
// read — tighter than the 60/min READ_RATE_LIMIT used elsewhere, and chat is limited separately
// from insights since a student could otherwise burn through requests one message at a time.
const INSIGHTS_RATE_LIMIT = { max: 20, timeWindow: '1 minute' };
const CHAT_RATE_LIMIT = { max: 20, timeWindow: '1 minute' };

export default async function aiRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireRole('STUDENT'));

  fastify.get('/insights', { config: { rateLimit: INSIGHTS_RATE_LIMIT } }, getAIInsightsHandler);
  fastify.post('/chat', { config: { rateLimit: CHAT_RATE_LIMIT } }, aiChatHandler);
}
