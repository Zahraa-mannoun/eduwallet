import { z } from 'zod';

export const prepareDisbursementSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1, 'Select at least one student'),
  amountPerStudent: z.number().positive('Amount must be greater than 0'),
});

export type PrepareDisbursementInput = z.infer<typeof prepareDisbursementSchema>;
