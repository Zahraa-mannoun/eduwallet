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

const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
const monthSchema = z.string().regex(monthRegex, 'month must be in YYYY-MM format');

export const setBudgetSchema = z.object({
  category: transactionCategoryEnum,
  monthlyLimit: z.number().positive('Monthly limit must be greater than 0'),
  month: monthSchema,
});

export type SetBudgetInput = z.infer<typeof setBudgetSchema>;

export const updateBudgetSchema = z.object({
  monthlyLimit: z.number().positive('Monthly limit must be greater than 0'),
});

export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;

export const categoryParamsSchema = z.object({
  category: transactionCategoryEnum,
});

export type CategoryParams = z.infer<typeof categoryParamsSchema>;

export const monthQuerySchema = z.object({
  month: monthSchema.optional(),
});

export type MonthQuery = z.infer<typeof monthQuerySchema>;
