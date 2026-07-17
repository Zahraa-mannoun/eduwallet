import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { requireVerifiedKYC } from '../../middleware/requireVerifiedKYC';
import {
  getDocumentByIdHandler,
  getMyDocumentsHandler,
  uploadDocumentHandler,
  verifyByHashParamHandler,
  verifyDocumentHandler,
} from './blockchain.controller';

export default async function blockchainRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/upload', { preHandler: [authenticate, requireVerifiedKYC] }, uploadDocumentHandler);
  fastify.get('/documents', { preHandler: authenticate }, getMyDocumentsHandler);
  fastify.get('/documents/:id', { preHandler: authenticate }, getDocumentByIdHandler);

  // Public — employers/universities verify certificates without an account.
  fastify.post('/verify', verifyDocumentHandler);
  fastify.get('/verify/:hash', verifyByHashParamHandler);
}
