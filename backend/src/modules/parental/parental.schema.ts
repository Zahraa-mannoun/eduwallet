import { z } from 'zod';

const transactionCategoryEnum = z.enum([
  'TUITION',
  'BOOKS',
  'FOOD',
  'TRANSPORT',
  'SOFTWARE',
  'RENT',
  'GENERAL',
]);

export const linkStudentSchema = z.object({
  studentEmail: z.string().trim().toLowerCase().email('Invalid email address'),
  approvalThreshold: z.number().positive('Approval threshold must be greater than 0'),
  categories: z.array(transactionCategoryEnum),
});

export type LinkStudentInput = z.infer<typeof linkStudentSchema>;

export const updateSettingsSchema = z.object({
  approvalThreshold: z.number().positive('Approval threshold must be greater than 0'),
  categories: z.array(transactionCategoryEnum),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export const approveTransactionSchema = z.object({
  transactionId: z.string().uuid('transactionId must be a valid UUID'),
});

export type ApproveTransactionInput = z.infer<typeof approveTransactionSchema>;

export const rejectTransactionSchema = z.object({
  transactionId: z.string().uuid('transactionId must be a valid UUID'),
  reason: z.string().trim().min(1, 'Reason is required').max(500),
});

export type RejectTransactionInput = z.infer<typeof rejectTransactionSchema>;

export const studentIdParamsSchema = z.object({
  studentId: z.string().uuid('studentId must be a valid UUID'),
});

export type StudentIdParams = z.infer<typeof studentIdParamsSchema>;
