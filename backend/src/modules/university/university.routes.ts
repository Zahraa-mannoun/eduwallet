import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import {
  disburseSelectedHandler,
  fundIndividualHandler,
  getSelectedStudentsHandler,
  getVerifiedUniversityStudentsHandler,
  prepareDisbursementHandler,
  selectStudentsHandler,
} from './university.controller';

export default async function universityRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireRole('INSTITUTION'));

  fastify.get('/students', getVerifiedUniversityStudentsHandler);
  fastify.post('/prepare-disbursement', prepareDisbursementHandler);
  fastify.post('/select-students', selectStudentsHandler);
  fastify.get('/selected-students', getSelectedStudentsHandler);
  fastify.post('/disburse-selected', disburseSelectedHandler);
  fastify.post('/fund-individual', fundIndividualHandler);
}
