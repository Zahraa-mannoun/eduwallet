import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import {
  deleteNotificationHandler,
  getNotificationsHandler,
  getUnreadCountHandler,
  markAllAsReadHandler,
  markAsReadHandler,
} from './notifications.controller';

// Read-only endpoints are polled by useFocusEffect on tab-switch across several screens —
// no security risk in allowing more traffic here than on write/auth endpoints.
const READ_RATE_LIMIT = { max: 60, timeWindow: '1 minute' };

export default async function notificationsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', { config: { rateLimit: READ_RATE_LIMIT } }, getNotificationsHandler);
  fastify.get(
    '/unread-count',
    { config: { rateLimit: READ_RATE_LIMIT } },
    getUnreadCountHandler
  );
  fastify.patch('/:id/read', markAsReadHandler);
  fastify.patch('/read-all', markAllAsReadHandler);
  fastify.delete('/:id', deleteNotificationHandler);
}
