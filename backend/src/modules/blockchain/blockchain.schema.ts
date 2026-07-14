import { z } from 'zod';

const sha256HashSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/i, 'hash must be a valid SHA-256 hex hash');

export const uploadDocumentSchema = z.object({
  fileName: z.string().trim().min(1, 'fileName is required').max(255),
  fileType: z.string().trim().min(1, 'fileType is required').max(100),
  documentName: z.string().trim().min(1, 'documentName is required').max(255),
  documentType: z.enum(['DEGREE', 'TRANSCRIPT', 'CERTIFICATE']),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

export const verifyDocumentSchema = z.object({
  hash: sha256HashSchema,
});

export type VerifyDocumentInput = z.infer<typeof verifyDocumentSchema>;

export const documentIdParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export type DocumentIdParams = z.infer<typeof documentIdParamsSchema>;

export const hashParamsSchema = z.object({
  hash: sha256HashSchema,
});

export type HashParams = z.infer<typeof hashParamsSchema>;
