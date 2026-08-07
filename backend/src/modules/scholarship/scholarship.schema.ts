import { z } from 'zod';

// PERSONAL_SAVINGS is deliberately excluded — same as wallet.schema.ts's transfer category
// enum and cards.schema.ts's category enum, it isn't a category funds can be locked into;
// money disbursed there would be permanently unspendable (no spend path accepts it) and
// excluded from savings.service.ts's rollover sweep.
const transactionCategoryEnum = z.enum([
  'TUITION',
  'BOOKS',
  'FOOD',
  'TRANSPORT',
  'SOFTWARE',
  'RENT',
  'LIFESTYLE',
  'GENERAL',
]);

export const bulkDisburseSchema = z.object({
  studentIds: z
    .array(z.string().uuid())
    .min(1, 'Select at least one student')
    .max(100, 'Cannot disburse to more than 100 students at once'),
  amountPerStudent: z.number().positive('Amount must be greater than 0'),
  currency: z.enum(['USD', 'EUR', 'LBP']),
  category: transactionCategoryEnum,
  note: z.string().trim().max(500).optional(),
});

export type BulkDisburseInput = z.infer<typeof bulkDisburseSchema>;
