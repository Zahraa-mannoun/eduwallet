import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import {
  getTransactionByIdHandler,
  getTransactionsHandler,
  getWalletHandler,
  topUpHandler,
  transferHandler,
} from './wallet.controller';

export default async function walletRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', getWalletHandler);
  fastify.post('/topup', topUpHandler);
  fastify.post('/transfer', transferHandler);
  fastify.get('/transactions', getTransactionsHandler);
  fastify.get('/transactions/:id', getTransactionByIdHandler);
}
