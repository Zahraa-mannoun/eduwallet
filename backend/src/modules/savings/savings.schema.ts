import { z } from 'zod';

export const requestWithdrawalSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  reason: z.string().trim().min(1, 'Reason is required').max(500),
});

export type RequestWithdrawalInput = z.infer<typeof requestWithdrawalSchema>;

export const rejectWithdrawalSchema = z.object({
  reason: z.string().trim().min(1, 'Reason is required').max(500),
});

export type RejectWithdrawalInput = z.infer<typeof rejectWithdrawalSchema>;

export const withdrawalRequestIdParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export type WithdrawalRequestIdParams = z.infer<typeof withdrawalRequestIdParamsSchema>;
