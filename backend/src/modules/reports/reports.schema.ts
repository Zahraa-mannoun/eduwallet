import { z } from 'zod';

export const createReportRequestSchema = z.object({
  studentUserId: z.string().uuid('studentUserId must be a valid UUID'),
  period: z.enum(['LAST_WEEK', 'LAST_MONTH', 'LAST_YEAR', 'LAST_2_YEARS']),
  includeCardPurchases: z.boolean().default(false),
  includeTransfers: z.boolean().default(false),
  includeWithdrawals: z.boolean().default(false),
  includeFlagged: z.boolean().default(false),
  includePending: z.boolean().default(false),
  includeSavings: z.boolean().default(false),
});

export type CreateReportRequestInput = z.infer<typeof createReportRequestSchema>;

export const reportIdParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export type ReportIdParams = z.infer<typeof reportIdParamsSchema>;
