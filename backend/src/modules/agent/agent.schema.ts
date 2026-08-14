import { z } from 'zod';

export const sendAgentMessageSchema = z.object({
  subject: z.string().trim().min(1, 'subject is required').max(200),
  message: z.string().trim().min(1, 'message is required').max(2000),
});

export type SendAgentMessageInput = z.infer<typeof sendAgentMessageSchema>;

export const savingsWithdrawalIdParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export type SavingsWithdrawalIdParams = z.infer<typeof savingsWithdrawalIdParamsSchema>;
