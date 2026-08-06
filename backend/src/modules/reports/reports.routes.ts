import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import {
  downloadReportHandler,
  generateReportHandler,
  getAllReportsHandler,
  getMyReportsHandler,
  requestReportHandler,
} from './reports.controller';

export default async function reportsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  await fastify.register(async (parentScope) => {
    parentScope.addHook('preHandler', requireRole('PARENT'));

    parentScope.post('/request', requestReportHandler);
    parentScope.get('/mine', getMyReportsHandler);
    parentScope.get('/:id/download', downloadReportHandler);
  });

  await fastify.register(async (adminScope) => {
    adminScope.addHook('preHandler', requireRole('ADMIN'));

    adminScope.get('/', getAllReportsHandler);
    adminScope.post('/:id/generate', generateReportHandler);
  });
}
