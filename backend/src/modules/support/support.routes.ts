import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import {
  getSupportMessagesHandler,
  markSupportMessageReadHandler,
  sendSupportMessageHandler,
} from './support.controller';

const PUBLIC_SUBMIT_RATE_LIMIT = { max: 5, timeWindow: '1 minute' };

export default async function supportRoutes(fastify: FastifyInstance): Promise<void> {
  // Deliberately public — a suspended user has no JWT at all (login rejects suspended
  // accounts outright), so this is the one write route in the app with no preHandler auth
  // at all. Rate-limited like the auth module's public routes to compensate.
  fastify.post(
    '/message',
    { config: { rateLimit: PUBLIC_SUBMIT_RATE_LIMIT } },
    sendSupportMessageHandler
  );

  // Admin-only, so the normal authenticate() is fine here (admins are never suspended).
  fastify.get(
    '/messages',
    { preHandler: [authenticate, requireRole('ADMIN')] },
    getSupportMessagesHandler
  );
  fastify.patch(
    '/messages/:id/read',
    { preHandler: [authenticate, requireRole('ADMIN')] },
    markSupportMessageReadHandler
  );
}
