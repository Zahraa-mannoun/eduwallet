import { z } from 'zod';

const CATEGORY_ENUM = z.enum([
  'TUITION',
  'BOOKS',
  'FOOD',
  'TRANSPORT',
  'SOFTWARE',
  'RENT',
  'LIFESTYLE',
  'GENERAL',
]);

export const lookupStudentQuerySchema = z.object({
  query: z.string().trim().min(1, 'Enter a student email or student number'),
});

export type LookupStudentQuery = z.infer<typeof lookupStudentQuerySchema>;

// Agent-entered — identifies the student either by email or by their university student
// number (resolved via UniversityStudent.studentNumber for a linked EduWallet account).
export const processWithdrawalSchema = z
  .object({
    studentEmail: z.string().trim().toLowerCase().email('Invalid email address').optional(),
    studentNumber: z.string().trim().min(1).optional(),
    amount: z.number().positive('Amount must be greater than 0'),
    category: CATEGORY_ENUM,
  })
  .refine((data) => Boolean(data.studentEmail) || Boolean(data.studentNumber), {
    message: 'Provide a student email or student number',
    path: ['studentEmail'],
  });

export type ProcessWithdrawalInput = z.infer<typeof processWithdrawalSchema>;

export const rejectWithdrawalSchema = z.object({
  reason: z.string().trim().min(1, 'Reason is required').max(500),
});

export type RejectWithdrawalInput = z.infer<typeof rejectWithdrawalSchema>;

export const withdrawalIdParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export type WithdrawalIdParams = z.infer<typeof withdrawalIdParamsSchema>;

export const verifyReceiptSchema = z.object({
  decision: z.enum(['VERIFIED', 'FLAGGED', 'REJECTED']),
  note: z.string().trim().max(500).optional(),
});

export type VerifyReceiptInput = z.infer<typeof verifyReceiptSchema>;

export const studentIdParamsSchema = z.object({
  studentId: z.string().uuid('studentId must be a valid UUID'),
});

export type StudentIdParams = z.infer<typeof studentIdParamsSchema>;
