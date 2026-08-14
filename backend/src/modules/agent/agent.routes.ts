import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import {
  dispenseSavingsWithdrawalHandler,
  getAgentSavingsWithdrawalsHandler,
  getAgentStatsHandler,
  getMyAgentMessagesHandler,
  sendAgentMessageHandler,
} from './agent.controller';

export default async function agentRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireRole('AGENT'));

  fastify.get('/stats', getAgentStatsHandler);
  fastify.get('/messages', getMyAgentMessagesHandler);
  fastify.post('/messages', sendAgentMessageHandler);
  fastify.get('/savings-withdrawals', getAgentSavingsWithdrawalsHandler);
  fastify.post('/savings-withdrawals/:id/dispense', dispenseSavingsWithdrawalHandler);
}
