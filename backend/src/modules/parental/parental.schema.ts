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

export const linkStudentSchema = z.object({
  studentEmail: z.string().trim().toLowerCase().email('Invalid email address'),
  // 0 means no threshold — general transfers are auto-approved regardless of amount.
  approvalThreshold: z.number().min(0, 'Approval threshold cannot be negative'),
  categories: z.array(transactionCategoryEnum),
});

export type LinkStudentInput = z.infer<typeof linkStudentSchema>;

export const updateSettingsSchema = z.object({
  // 0 means no threshold — general transfers are auto-approved regardless of amount.
  approvalThreshold: z.number().min(0, 'Approval threshold cannot be negative'),
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
