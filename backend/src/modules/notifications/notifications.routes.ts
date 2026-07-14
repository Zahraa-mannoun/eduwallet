import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import {
  deleteNotificationHandler,
  getNotificationsHandler,
  getUnreadCountHandler,
  markAllAsReadHandler,
  markAsReadHandler,
} from './notifications.controller';

export default async function notificationsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', getNotificationsHandler);
  fastify.get('/unread-count', getUnreadCountHandler);
  fastify.patch('/:id/read', markAsReadHandler);
  fastify.patch('/read-all', markAllAsReadHandler);
  fastify.delete('/:id', deleteNotificationHandler);
}
