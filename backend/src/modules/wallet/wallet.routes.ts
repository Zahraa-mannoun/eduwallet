import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import {
  getTransactionByIdHandler,
  getTransactionsHandler,
  getWalletHandler,
  lookupWalletHandler,
  topUpHandler,
  transferHandler,
} from './wallet.controller';

// Read-only endpoints are polled by useFocusEffect on tab-switch across several screens —
// no security risk in allowing more traffic here than on write/auth endpoints.
const READ_RATE_LIMIT = { max: 60, timeWindow: '1 minute' };

export default async function walletRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', { config: { rateLimit: READ_RATE_LIMIT } }, getWalletHandler);
  fastify.post('/topup', topUpHandler);
  fastify.post('/transfer', transferHandler);
  fastify.get('/transactions', { config: { rateLimit: READ_RATE_LIMIT } }, getTransactionsHandler);
  fastify.get(
    '/transactions/:id',
    { config: { rateLimit: READ_RATE_LIMIT } },
    getTransactionByIdHandler
  );
  fastify.get('/lookup', { config: { rateLimit: READ_RATE_LIMIT } }, lookupWalletHandler);
}
