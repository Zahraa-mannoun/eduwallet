import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import {
  createCardHandler,
  deleteCardHandler,
  freezeCardHandler,
  getCardByIdHandler,
  getCardsHandler,
  useCardHandler,
} from './cards.controller';

export default async function cardsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/', { preHandler: authenticate }, createCardHandler);
  fastify.get('/', { preHandler: authenticate }, getCardsHandler);
  fastify.get('/:id', { preHandler: authenticate }, getCardByIdHandler);
  fastify.patch('/:id/freeze', { preHandler: authenticate }, freezeCardHandler);
  fastify.delete('/:id', { preHandler: authenticate }, deleteCardHandler);

  // Called by demo merchant websites — intentionally not gated by `authenticate`.
  // Card number + CVV are the credential here, mirroring a real card-present payment.
  fastify.post('/use', useCardHandler);
}
