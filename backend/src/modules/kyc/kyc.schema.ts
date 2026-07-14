import { z } from 'zod';

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export const submitKYCSchema = z.object({
  documentType: z.enum(['STUDENT_ID', 'ENROLLMENT_CERTIFICATE']),
  fileName: z.string().trim().min(1, 'fileName is required').max(255),
  fileSize: z
    .number()
    .int()
    .positive('fileSize must be greater than 0')
    .max(MAX_FILE_SIZE_BYTES, 'fileSize exceeds the maximum allowed size'),
});

export type SubmitKYCInput = z.infer<typeof submitKYCSchema>;

export const reviewKYCSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().trim().min(1).max(500).optional(),
});

export type ReviewKYCInput = z.infer<typeof reviewKYCSchema>;
