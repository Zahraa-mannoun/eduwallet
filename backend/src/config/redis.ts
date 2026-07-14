import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('connect', () => {
  console.log('[redis] connected');
});

redis.on('error', (error: Error) => {
  console.error('[redis] connection error:', error.message);
});

export default redis;
