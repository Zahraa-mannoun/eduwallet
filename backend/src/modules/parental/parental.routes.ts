import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import {
  approveTransactionHandler,
  getLinkedStudentsHandler,
  getMyPermissionsHandler,
  getPendingApprovalsHandler,
  linkStudentHandler,
  rejectTransactionHandler,
  unlinkStudentHandler,
  updateSettingsHandler,
} from './parental.controller';

export default async function parentalRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/my-permissions', { preHandler: requireRole('STUDENT') }, getMyPermissionsHandler);

  await fastify.register(async (parentScope) => {
    parentScope.addHook('preHandler', requireRole('PARENT'));

    parentScope.post('/link', linkStudentHandler);
    parentScope.delete('/unlink/:studentId', unlinkStudentHandler);
    parentScope.put('/settings/:studentId', updateSettingsHandler);
    parentScope.get('/approvals', getPendingApprovalsHandler);
    parentScope.post('/approve', approveTransactionHandler);
    parentScope.post('/reject', rejectTransactionHandler);
    parentScope.get('/students', getLinkedStudentsHandler);
  });
}
