import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import {
  downloadReportHandler,
  generateReportHandler,
  getAllReportsHandler,
  getMyReportsHandler,
  requestReportHandler,
  sendReportHandler,
} from './reports.controller';

export default async function reportsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  // Shared across ADMIN (previewing before sending) and PARENT (downloading their own, once
  // sent) — getReportFile() itself enforces the two roles' different access rules, the same
  // pattern as withdrawals' /:id/receipt-file route.
  fastify.get('/:id/download', downloadReportHandler);

  await fastify.register(async (parentScope) => {
    parentScope.addHook('preHandler', requireRole('PARENT'));

    parentScope.post('/request', requestReportHandler);
    parentScope.get('/mine', getMyReportsHandler);
  });

  await fastify.register(async (adminScope) => {
    adminScope.addHook('preHandler', requireRole('ADMIN'));

    adminScope.get('/', getAllReportsHandler);
    adminScope.post('/:id/generate', generateReportHandler);
    adminScope.post('/:id/send', sendReportHandler);
  });
}
