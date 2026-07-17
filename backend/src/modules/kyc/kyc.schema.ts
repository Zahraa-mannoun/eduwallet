import { z } from 'zod';

export const submitKYCSchema = z.object({
  documentType: z.enum(['STUDENT_ID', 'ENROLLMENT_CERTIFICATE']),
  fileName: z.string().trim().min(1, 'fileName is required').max(255),
  fileType: z.string().trim().min(1, 'fileType is required').max(100),
});

export type SubmitKYCInput = z.infer<typeof submitKYCSchema>;

export const reviewKYCSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().trim().min(1).max(500).optional(),
});

export type ReviewKYCInput = z.infer<typeof reviewKYCSchema>;

export const documentFileParamsSchema = z.object({
  documentId: z.string().uuid('documentId must be a valid UUID'),
});

export type DocumentFileParams = z.infer<typeof documentFileParamsSchema>;
