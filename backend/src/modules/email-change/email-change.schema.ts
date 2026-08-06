import { z } from 'zod';

export const createEmailChangeRequestSchema = z.object({
  requestedEmail: z.string().trim().toLowerCase().email('Invalid email address'),
  reason: z.string().trim().min(1, 'A reason is required').max(500),
});

export type CreateEmailChangeRequestInput = z.infer<typeof createEmailChangeRequestSchema>;

export const emailChangeIdParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export type EmailChangeIdParams = z.infer<typeof emailChangeIdParamsSchema>;
