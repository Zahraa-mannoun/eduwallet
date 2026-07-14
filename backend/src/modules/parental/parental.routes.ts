import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import {
  approveTransactionHandler,
  getLinkedStudentsHandler,
  getPendingApprovalsHandler,
  linkStudentHandler,
  rejectTransactionHandler,
  unlinkStudentHandler,
  updateSettingsHandler,
} from './parental.controller';

export default async function parentalRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireRole('PARENT'));

  fastify.post('/link', linkStudentHandler);
  fastify.delete('/unlink/:studentId', unlinkStudentHandler);
  fastify.put('/settings/:studentId', updateSettingsHandler);
  fastify.get('/approvals', getPendingApprovalsHandler);
  fastify.post('/approve', approveTransactionHandler);
  fastify.post('/reject', rejectTransactionHandler);
  fastify.get('/students', getLinkedStudentsHandler);
}
