import { z } from 'zod';

const booleanQueryParam = z.enum(['true', 'false']).transform((value) => value === 'true');

export const suspendUserSchema = z.object({
  reason: z.string().trim().min(1, 'reason is required').max(500),
});

export type SuspendUserInput = z.infer<typeof suspendUserSchema>;

export const userIdParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export type UserIdParams = z.infer<typeof userIdParamsSchema>;

export const getUsersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  userType: z.enum(['STUDENT', 'PARENT', 'INSTITUTION', 'ADMIN']).optional(),
  kycStatus: z.enum(['PENDING', 'VERIFIED', 'REJECTED']).optional(),
  search: z.string().trim().min(1).max(255).optional(),
});

export type GetUsersInput = z.infer<typeof getUsersSchema>;

export const getAllTransactionsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['PENDING', 'AUTO_APPROVED', 'APPROVED', 'REJECTED', 'EMERGENCY']).optional(),
  category: z
    .enum(['TUITION', 'BOOKS', 'FOOD', 'TRANSPORT', 'SOFTWARE', 'RENT', 'LIFESTYLE', 'PERSONAL_SAVINGS', 'GENERAL'])
    .optional(),
  flagged: booleanQueryParam.optional(),
});

export type GetAllTransactionsInput = z.infer<typeof getAllTransactionsSchema>;

export const resolveFraudAlertSchema = z.object({
  note: z.string().trim().min(1, 'note is required').max(500),
});

export type ResolveFraudAlertInput = z.infer<typeof resolveFraudAlertSchema>;

export const fraudAlertIdParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export type FraudAlertIdParams = z.infer<typeof fraudAlertIdParamsSchema>;

export const getFraudAlertsSchema = z.object({
  resolved: booleanQueryParam.optional(),
});

export type GetFraudAlertsInput = z.infer<typeof getFraudAlertsSchema>;

export const addFundsParamsSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),
});

export type AddFundsParams = z.infer<typeof addFundsParamsSchema>;

export const addFundsSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  currency: z.enum(['USD', 'EUR', 'LBP']),
});

export type AddFundsInput = z.infer<typeof addFundsSchema>;
