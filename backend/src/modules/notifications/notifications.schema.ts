import { z } from 'zod';

export const notificationIdParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export type NotificationIdParams = z.infer<typeof notificationIdParamsSchema>;

const unreadOnlySchema = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

export const getNotificationsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  unreadOnly: unreadOnlySchema,
});

export type GetNotificationsInput = z.infer<typeof getNotificationsSchema>;
