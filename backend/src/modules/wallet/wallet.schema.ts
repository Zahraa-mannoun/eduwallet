import { z } from 'zod';

export const topUpSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  currency: z.enum(['USD', 'EUR', 'LBP']),
});

export type TopUpInput = z.infer<typeof topUpSchema>;

// Transfers (P2P and parent-to-student "send money") never accept PERSONAL_SAVINGS — it isn't
// a category funds can be sent/locked into, only an auto-accumulating pool of unspent funds.
const transferCategoryEnum = z.enum([
  'TUITION',
  'BOOKS',
  'FOOD',
  'TRANSPORT',
  'SOFTWARE',
  'RENT',
  'LIFESTYLE',
  'GENERAL',
]);

export const transferSchema = z.object({
  toWalletId: z.string().uuid('toWalletId must be a valid UUID'),
  amount: z.number().positive('Amount must be greater than 0'),
  currency: z.enum(['USD', 'EUR', 'LBP']),
  category: transferCategoryEnum,
  note: z.string().trim().max(500).optional(),
});

export type TransferInput = z.infer<typeof transferSchema>;

export const getTransactionsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  category: z
    .enum(['TUITION', 'BOOKS', 'FOOD', 'TRANSPORT', 'SOFTWARE', 'RENT', 'LIFESTYLE', 'PERSONAL_SAVINGS', 'GENERAL'])
    .optional(),
  status: z
    .enum(['PENDING', 'AUTO_APPROVED', 'APPROVED', 'REJECTED', 'EMERGENCY'])
    .optional(),
});

export type GetTransactionsInput = z.infer<typeof getTransactionsSchema>;

export const transactionIdParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export type TransactionIdParams = z.infer<typeof transactionIdParamsSchema>;

export const lookupWalletSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  currency: z.enum(['USD', 'EUR', 'LBP']).optional(),
});

export type LookupWalletInput = z.infer<typeof lookupWalletSchema>;
