import { z } from 'zod';

export const prepareDisbursementSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1, 'Select at least one student'),
  amountPerStudent: z.number().positive('Amount must be greater than 0'),
});

export type PrepareDisbursementInput = z.infer<typeof prepareDisbursementSchema>;

// Tab 2 / Tab 3 only ever lock scholarship money to actual academic spending — no GENERAL,
// same reasoning as scholarship.schema.ts's bulkDisburseSchema category enum.
export const academicCategoryEnum = z.enum(['TUITION', 'BOOKS', 'SOFTWARE']);

export const selectStudentsSchema = z.object({
  studentIds: z
    .array(z.string().uuid())
    .min(1, 'Select at least one student')
    .max(100, 'Cannot select more than 100 students at once'),
  amountPerStudent: z.number().positive('Amount must be greater than 0'),
});

export type SelectStudentsInput = z.infer<typeof selectStudentsSchema>;

export const disburseSelectedSchema = z.object({
  category: academicCategoryEnum,
});

export type DisburseSelectedInput = z.infer<typeof disburseSelectedSchema>;

export const fundIndividualSchema = z.object({
  studentUserId: z.string().uuid('studentUserId must be a valid UUID'),
  amount: z.number().positive('Amount must be greater than 0'),
  category: academicCategoryEnum,
});

export type FundIndividualInput = z.infer<typeof fundIndividualSchema>;
