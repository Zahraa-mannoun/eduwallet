import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../utils/AppError';
import { errorResponse, successResponse } from '../../utils/apiResponse';
import { getNotificationsSchema, notificationIdParamsSchema } from './notifications.schema';
import {
  deleteNotification,
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
} from './notifications.service';

function handleNotificationError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(errorResponse(error.message, error.code));
  }
  request.log.error({ err: error }, 'Unexpected error in notifications module');
  return reply
    .status(500)
    .send(errorResponse('Something went wrong. Please try again.', 'INTERNAL_ERROR'));
}

function requireAuthUser(request: FastifyRequest) {
  if (!request.authUser) {
    throw new AppError(401, 'UNAUTHORIZED', 'Missing authentication');
  }
  return request.authUser;
}

export async function getNotificationsHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = getNotificationsSchema.safeParse(request.query);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const result = await getNotifications(authUser.id, parsed.data);
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleNotificationError(request, reply, error);
  }
}

export async function getUnreadCountHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authUser = requireAuthUser(request);
    const count = await getUnreadCount(authUser.id);
    return reply.status(200).send(successResponse({ count }));
  } catch (error) {
    return handleNotificationError(request, reply, error);
  }
}

export async function markAsReadHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = notificationIdParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const notification = await markAsRead(authUser.id, parsed.data.id);
    return reply.status(200).send(successResponse(notification));
  } catch (error) {
    return handleNotificationError(request, reply, error);
  }
}

export async function markAllAsReadHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authUser = requireAuthUser(request);
    const result = await markAllAsRead(authUser.id);
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleNotificationError(request, reply, error);
  }
}

export async function deleteNotificationHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = notificationIdParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    await deleteNotification(authUser.id, parsed.data.id);
    return reply.status(200).send(successResponse({ message: 'Notification deleted successfully' }));
  } catch (error) {
    return handleNotificationError(request, reply, error);
  }
}
