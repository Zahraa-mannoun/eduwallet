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
  // PENDING_PARENT_APPROVAL and COMPLETED have no TransactionStatus equivalent — see
  // getAllTransactions in admin.service.ts for how each is actually resolved.
  status: z
    .enum([
      'PENDING',
      'AUTO_APPROVED',
      'APPROVED',
      'REJECTED',
      'EMERGENCY',
      'PENDING_PARENT_APPROVAL',
      'COMPLETED',
    ])
    .optional(),
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

export const createAgentSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters'),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type CreateAgentInput = z.infer<typeof createAgentSchema>;

export const agentIdParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export type AgentIdParams = z.infer<typeof agentIdParamsSchema>;

export const deactivateAgentSchema = z.object({
  reason: z.string().trim().min(1, 'reason is required').max(500),
});

export type DeactivateAgentInput = z.infer<typeof deactivateAgentSchema>;

export const notifyAgentSchema = z.object({
  message: z.string().trim().min(1, 'message is required').max(1000),
});

export type NotifyAgentInput = z.infer<typeof notifyAgentSchema>;

export const fraudRuleKeyParamsSchema = z.object({
  key: z.string().trim().min(1, 'key is required'),
});

export type FraudRuleKeyParams = z.infer<typeof fraudRuleKeyParamsSchema>;

export const updateFraudRuleSchema = z.object({
  value: z.number().finite().positive('value must be greater than 0'),
});

export type UpdateFraudRuleInput = z.infer<typeof updateFraudRuleSchema>;
