import { z } from 'zod';

export const sendSupportMessageSchema = z.object({
  // Public, unauthenticated endpoint (a suspended user has no token) — the email identifies
  // which account the message is about instead of request.authUser.
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  message: z.string().trim().min(1, 'message is required').max(2000),
});

export type SendSupportMessageInput = z.infer<typeof sendSupportMessageSchema>;

export const supportMessageIdParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export type SupportMessageIdParams = z.infer<typeof supportMessageIdParamsSchema>;
