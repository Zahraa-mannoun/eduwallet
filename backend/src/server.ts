import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { prisma } from './config/database';
import { redis } from './config/redis';
import authRoutes from './modules/auth/auth.routes';
import walletRoutes from './modules/wallet/wallet.routes';
import parentalRoutes from './modules/parental/parental.routes';
import cardsRoutes from './modules/cards/cards.routes';

const PORT = Number(process.env.PORT ?? 3000);
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me';
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? true;

const app = Fastify({ logger: true });

async function buildServer() {
  await app.register(cors, { origin: CORS_ORIGIN });
  await app.register(jwt, { secret: JWT_SECRET });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis,
  });

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(walletRoutes, { prefix: '/wallet' });
  await app.register(parentalRoutes, { prefix: '/parental' });
  await app.register(cardsRoutes, { prefix: '/cards' });

  return app;
}

async function start() {
  try {
    await prisma.$connect();
    app.log.info('Connected to database');

    await redis.connect();
    app.log.info('Connected to Redis');

    const server = await buildServer();

    server.addHook('onClose', async () => {
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
