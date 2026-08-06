import { z } from 'zod';

const transactionCategoryEnum = z.enum([
  'TUITION',
  'BOOKS',
  'FOOD',
  'TRANSPORT',
  'SOFTWARE',
  'RENT',
  'LIFESTYLE',
  'PERSONAL_SAVINGS',
  'GENERAL',
]);

export const bulkDisburseSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1, 'Select at least one student'),
  amountPerStudent: z.number().positive('Amount must be greater than 0'),
  currency: z.enum(['USD', 'EUR', 'LBP']),
  category: transactionCategoryEnum,
  note: z.string().trim().max(500).optional(),
});

export type BulkDisburseInput = z.infer<typeof bulkDisburseSchema>;
