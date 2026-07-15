import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import {
  deleteBudgetHandler,
  getBudgetSummaryHandler,
  getBudgetsHandler,
  setBudgetHandler,
  updateBudgetHandler,
} from './budget.controller';

// Read-only endpoints are polled by useFocusEffect on tab-switch across several screens —
// no security risk in allowing more traffic here than on write/auth endpoints.
const READ_RATE_LIMIT = { max: 60, timeWindow: '1 minute' };

export default async function budgetRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.post('/', setBudgetHandler);
  fastify.get('/', { config: { rateLimit: READ_RATE_LIMIT } }, getBudgetsHandler);
  fastify.get('/summary', { config: { rateLimit: READ_RATE_LIMIT } }, getBudgetSummaryHandler);
  fastify.put('/:category', updateBudgetHandler);
  fastify.delete('/:category', deleteBudgetHandler);
}
