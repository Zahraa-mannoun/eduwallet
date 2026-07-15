import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { bulkDisburseHandler, getStudentsHandler } from './scholarship.controller';

export default async function scholarshipRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireRole('INSTITUTION'));

  fastify.get('/students', getStudentsHandler);
  fastify.post('/disburse', bulkDisburseHandler);
}
