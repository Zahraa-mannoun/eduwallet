import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import {
  deleteBudgetHandler,
  getBudgetSummaryHandler,
  getBudgetsHandler,
  setBudgetHandler,
  updateBudgetHandler,
} from './budget.controller';

export default async function budgetRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.post('/', setBudgetHandler);
  fastify.get('/', getBudgetsHandler);
  fastify.get('/summary', getBudgetSummaryHandler);
  fastify.put('/:category', updateBudgetHandler);
  fastify.delete('/:category', deleteBudgetHandler);
}
