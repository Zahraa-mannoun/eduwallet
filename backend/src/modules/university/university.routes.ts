import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import {
  getVerifiedUniversityStudentsHandler,
  prepareDisbursementHandler,
} from './university.controller';

export default async function universityRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireRole('INSTITUTION'));

  fastify.get('/students', getVerifiedUniversityStudentsHandler);
  fastify.post('/prepare-disbursement', prepareDisbursementHandler);
}
