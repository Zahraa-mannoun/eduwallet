import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import {
  approveWithdrawalHandler,
  getMySavingsHandler,
  getWithdrawalRequestsHandler,
  rejectWithdrawalHandler,
  requestWithdrawalHandler,
  runRolloverHandler,
} from './savings.controller';

// Read-only endpoints are polled by useFocusEffect on tab-switch — same allowance as budget/wallet.
const READ_RATE_LIMIT = { max: 60, timeWindow: '1 minute' };

export default async function savingsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', { config: { rateLimit: READ_RATE_LIMIT } }, getMySavingsHandler);

  fastify.post(
    '/request-withdrawal',
    { preHandler: requireRole('STUDENT') },
    requestWithdrawalHandler
  );

  await fastify.register(async (parentScope) => {
    parentScope.addHook('preHandler', requireRole('PARENT'));

    parentScope.get(
      '/withdrawal-requests',
      { config: { rateLimit: READ_RATE_LIMIT } },
      getWithdrawalRequestsHandler
    );
    parentScope.patch('/withdrawal-requests/:id/approve', approveWithdrawalHandler);
    parentScope.patch('/withdrawal-requests/:id/reject', rejectWithdrawalHandler);
  });

  fastify.post('/rollover', { preHandler: requireRole('ADMIN') }, runRolloverHandler);
}
