import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import {
  deleteDocumentHandler,
  getDocumentFileHandler,
  getKYCStatusHandler,
  getMyDocumentsHandler,
  getPendingKYCHandler,
  getResubmissionsHandler,
  reviewKYCHandler,
  submitDocumentHandler,
} from './kyc.controller';

export default async function kycRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.post('/submit', submitDocumentHandler);
  fastify.get('/status', getKYCStatusHandler);
  fastify.get('/documents', getMyDocumentsHandler);
  fastify.delete('/documents/:documentId', { preHandler: requireRole('STUDENT') }, deleteDocumentHandler);
  fastify.post('/review', { preHandler: requireRole('ADMIN') }, reviewKYCHandler);
  fastify.get('/pending', { preHandler: requireRole('ADMIN') }, getPendingKYCHandler);
  fastify.get('/resubmissions', { preHandler: requireRole('ADMIN') }, getResubmissionsHandler);
  // No role gate here — ADMIN may view any document, a STUDENT only their own (enforced inside
  // getDocumentFileHandler, since a single requireRole() can't express "admin OR owner").
  fastify.get('/document/:documentId/file', getDocumentFileHandler);
}
