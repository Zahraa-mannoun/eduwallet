import type { Notification } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { emitNotification } from './notifications.socket';
import type { GetNotificationsInput } from './notifications.schema';

export async function getNotifications(
  userId: string,
  filters: GetNotificationsInput
): Promise<{ notifications: Notification[]; total: number; page: number; limit: number }> {
  const where = { userId, ...(filters.unreadOnly ? { read: false } : {}) };

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.notification.count({ where }),
  ]);

  return { notifications, total, page: filters.page, limit: filters.limit };
}

async function getOwnedNotification(
  userId: string,
  notificationId: string
): Promise<Notification> {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification || notification.userId !== userId) {
    throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
  }
  return notification;
}

export async function markAsRead(userId: string, notificationId: string): Promise<Notification> {
  await getOwnedNotification(userId, notificationId);
  return prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });
}

export async function markAllAsRead(userId: string): Promise<{ count: number }> {
  const result = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  return { count: result.count };
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, read: false } });
}

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: string,
  relatedId?: string
): Promise<Notification> {
  const notification = await prisma.notification.create({
    data: { userId, title, message, type, relatedId },
  });
  emitNotification(notification);
  return notification;
}

export async function deleteNotification(userId: string, notificationId: string): Promise<void> {
  const notification = await getOwnedNotification(userId, notificationId);
  await prisma.notification.delete({ where: { id: notification.id } });
}
