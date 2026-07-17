import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import {
  getDocumentFileHandler,
  getKYCStatusHandler,
  getMyDocumentsHandler,
  getPendingKYCHandler,
  reviewKYCHandler,
  submitDocumentHandler,
} from './kyc.controller';

export default async function kycRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.post('/submit', submitDocumentHandler);
  fastify.get('/status', getKYCStatusHandler);
  fastify.get('/documents', getMyDocumentsHandler);
  fastify.post('/review', { preHandler: requireRole('ADMIN') }, reviewKYCHandler);
  fastify.get('/pending', { preHandler: requireRole('ADMIN') }, getPendingKYCHandler);
  fastify.get(
    '/document/:documentId/file',
    { preHandler: requireRole('ADMIN') },
    getDocumentFileHandler
  );
}
