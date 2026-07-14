import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import {
  getAllTransactionsHandler,
  getAuditLogHandler,
  getFraudAlertsHandler,
  getPendingKYCHandler,
  getStatsHandler,
  getUserByIdHandler,
  getUsersHandler,
  resolveFraudAlertHandler,
  suspendUserHandler,
  unsuspendUserHandler,
} from './admin.controller';

export default async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireRole('ADMIN'));

  fastify.get('/stats', getStatsHandler);
  fastify.get('/users', getUsersHandler);
  fastify.get('/users/:id', getUserByIdHandler);
  fastify.patch('/users/:id/suspend', suspendUserHandler);
  fastify.patch('/users/:id/unsuspend', unsuspendUserHandler);
  fastify.get('/transactions', getAllTransactionsHandler);
  fastify.get('/fraud-alerts', getFraudAlertsHandler);
  fastify.patch('/fraud-alerts/:id/resolve', resolveFraudAlertHandler);
  fastify.get('/kyc/pending', getPendingKYCHandler);

  // Not in the original route list, but admin.service.ts's getAuditLog() has no
  // other way to be reached — "all admin actions should be logged" implies a way to read them back.
  fastify.get('/audit-log', getAuditLogHandler);
}
