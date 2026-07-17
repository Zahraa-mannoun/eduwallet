import 'dotenv/config';
import Fastify from 'fastify';
import type { FastifyError } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { prisma } from './config/database';
import { redis } from './config/redis';
import authRoutes from './modules/auth/auth.routes';
import walletRoutes from './modules/wallet/wallet.routes';
import parentalRoutes from './modules/parental/parental.routes';
import cardsRoutes from './modules/cards/cards.routes';
import budgetRoutes from './modules/budget/budget.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import kycRoutes from './modules/kyc/kyc.routes';
import blockchainRoutes from './modules/blockchain/blockchain.routes';
import adminRoutes from './modules/admin/admin.routes';
import scholarshipRoutes from './modules/scholarship/scholarship.routes';
import { initSocket } from './modules/notifications/notifications.socket';
import { AppError } from './utils/AppError';
import { errorResponse } from './utils/apiResponse';

const PORT = Number(process.env.PORT ?? 3000);
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me';
const CORS_ORIGIN = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : true;

const app = Fastify({ logger: true });

async function buildServer() {
  await app.register(cors, { origin: CORS_ORIGIN });
  await app.register(jwt, { secret: JWT_SECRET });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis,
  });
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  // Safety net: guarantees the { success:false, error, code } contract holds even for
  // errors that never reach a controller's own try/catch (malformed JSON bodies, Fastify's
  // built-in validation, @fastify/multipart size-limit errors, @fastify/rate-limit 429s, etc).
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(errorResponse(error.message, error.code));
    }

    if (typeof error.statusCode === 'number' && error.statusCode < 500) {
      return reply
        .status(error.statusCode)
        .send(errorResponse(error.message, error.code ?? 'REQUEST_ERROR'));
    }

    request.log.error({ err: error }, 'Unhandled error');
    return reply
      .status(500)
      .send(errorResponse('Something went wrong. Please try again.', 'INTERNAL_ERROR'));
  });

  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send(errorResponse('Route not found', 'NOT_FOUND'));
  });

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(walletRoutes, { prefix: '/wallet' });
  await app.register(parentalRoutes, { prefix: '/parental' });
  await app.register(cardsRoutes, { prefix: '/cards' });
  await app.register(budgetRoutes, { prefix: '/budget' });
  await app.register(notificationsRoutes, { prefix: '/notifications' });
  await app.register(kycRoutes, { prefix: '/kyc' });
  await app.register(blockchainRoutes, { prefix: '/blockchain' });
  await app.register(adminRoutes, { prefix: '/admin' });
  await app.register(scholarshipRoutes, { prefix: '/scholarship' });

  return app;
}

async function start() {
  try {
    await prisma.$connect();
    app.log.info('Connected to database');

    await redis.connect();
    app.log.info('Connected to Redis');

    const server = await buildServer();
    const io = initSocket(server.server, server);

    server.addHook('onClose', async () => {
      io.close();
      await prisma.$disconnect();
      await redis.quit();
    });

    await server.listen({ port: PORT, host: '0.0.0.0' });

    const shutdown = (signal: string) => {
      app.log.info(`Received ${signal}, shutting down...`);
      server
        .close()
        .then(() => process.exit(0))
        .catch((error: unknown) => {
          app.log.error(error);
          process.exit(1);
        });
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();
