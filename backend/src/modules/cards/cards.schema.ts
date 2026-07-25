import { z } from 'zod';

const transactionCategoryEnum = z.enum([
  'TUITION',
  'BOOKS',
  'FOOD',
  'TRANSPORT',
  'SOFTWARE',
  'RENT',
  'PERSONAL',
  'GENERAL',
]);

export const createCardSchema = z.object({
  categoryLock: transactionCategoryEnum.optional(),
  merchantLock: z.string().trim().min(1).max(100).optional(),
  expiryDays: z.number().int().positive().max(3650).optional().default(30),
});

export type CreateCardInput = z.infer<typeof createCardSchema>;

export const updateCardAutoRenewSchema = z.object({
  cardAutoRenew: z.boolean(),
});

export type UpdateCardAutoRenewInput = z.infer<typeof updateCardAutoRenewSchema>;

export const useCardSchema = z.object({
  cardNumber: z.string().regex(/^\d{4}-\d{4}-\d{4}-\d{4}$/, 'Invalid card number format'),
  cvv: z.string().regex(/^\d{3}$/, 'Invalid CVV format'),
  amount: z.number().positive('Amount must be greater than 0'),
  currency: z.enum(['USD', 'EUR', 'LBP']),
  merchantName: z.string().trim().min(1).max(200),
  category: transactionCategoryEnum,
});

export type UseCardInput = z.infer<typeof useCardSchema>;

export const cardIdParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export type CardIdParams = z.infer<typeof cardIdParamsSchema>;
