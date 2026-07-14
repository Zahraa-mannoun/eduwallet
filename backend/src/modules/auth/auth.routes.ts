import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import {
  loginHandler,
  logoutHandler,
  meHandler,
  refreshHandler,
  registerHandler,
} from './auth.controller';

const AUTH_RATE_LIMIT = { max: 5, timeWindow: '1 minute' };

export default async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/register', { config: { rateLimit: AUTH_RATE_LIMIT } }, registerHandler);
  fastify.post('/login', { config: { rateLimit: AUTH_RATE_LIMIT } }, loginHandler);
  fastify.post(
    '/logout',
    { preHandler: authenticate, config: { rateLimit: AUTH_RATE_LIMIT } },
    logoutHandler
  );
  fastify.post('/refresh', { config: { rateLimit: AUTH_RATE_LIMIT } }, refreshHandler);
  fastify.get('/me', { preHandler: authenticate, config: { rateLimit: AUTH_RATE_LIMIT } }, meHandler);
}
