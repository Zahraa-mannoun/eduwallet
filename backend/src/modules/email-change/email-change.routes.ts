import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import {
  approveRequestHandler,
  getAllRequestsHandler,
  getMyRequestHandler,
  getProofImageHandler,
  rejectRequestHandler,
  requestEmailChangeHandler,
} from './email-change.controller';

export default async function emailChangeRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/mine', getMyRequestHandler);

  await fastify.register(async (selfScope) => {
    selfScope.addHook('preHandler', requireRole('STUDENT', 'PARENT', 'INSTITUTION'));

    selfScope.post('/request', requestEmailChangeHandler);
  });

  await fastify.register(async (adminScope) => {
    adminScope.addHook('preHandler', requireRole('ADMIN'));

    adminScope.get('/requests', getAllRequestsHandler);
    adminScope.get('/requests/:id/proof', getProofImageHandler);
    adminScope.patch('/requests/:id/approve', approveRequestHandler);
    adminScope.patch('/requests/:id/reject', rejectRequestHandler);
  });
}
