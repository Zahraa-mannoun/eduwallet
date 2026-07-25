import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { requireVerifiedKYC } from '../../middleware/requireVerifiedKYC';
import {
  createCardHandler,
  deleteCardHandler,
  freezeCardHandler,
  getCardByIdHandler,
  getCardsHandler,
  updateCardAutoRenewHandler,
  useCardHandler,
} from './cards.controller';

// Read-only endpoints are polled by useFocusEffect on tab-switch across several screens —
// no security risk in allowing more traffic here than on write/auth endpoints.
const READ_RATE_LIMIT = { max: 60, timeWindow: '1 minute' };

export default async function cardsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/', { preHandler: [authenticate, requireVerifiedKYC] }, createCardHandler);
  fastify.get(
    '/',
    { preHandler: authenticate, config: { rateLimit: READ_RATE_LIMIT } },
    getCardsHandler
  );
  fastify.get(
    '/:id',
    { preHandler: authenticate, config: { rateLimit: READ_RATE_LIMIT } },
    getCardByIdHandler
  );
  fastify.patch('/:id/freeze', { preHandler: authenticate }, freezeCardHandler);
  fastify.patch('/settings/auto-renew', { preHandler: authenticate }, updateCardAutoRenewHandler);
  fastify.delete('/:id', { preHandler: authenticate }, deleteCardHandler);

  // Called by demo merchant websites — intentionally not gated by `authenticate`.
  // Card number + CVV are the credential here, mirroring a real card-present payment.
  fastify.post('/use', useCardHandler);
}
