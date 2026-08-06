import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import {
  approveWithdrawalHandler,
  completeWithdrawalHandler,
  getAllWithdrawalsHandler,
  getMyWithdrawalsHandler,
  getPendingApprovalsHandler,
  lookupStudentHandler,
  processWithdrawalHandler,
  rejectWithdrawalHandler,
  uploadReceiptHandler,
} from './withdrawals.controller';

// Read-only endpoints are polled by useFocusEffect on tab-switch — same allowance as
// budget/wallet/savings.
const READ_RATE_LIMIT = { max: 60, timeWindow: '1 minute' };

export default async function withdrawalsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.get(
    '/mine',
    { preHandler: requireRole('STUDENT'), config: { rateLimit: READ_RATE_LIMIT } },
    getMyWithdrawalsHandler
  );

  fastify.post(
    '/:id/upload-receipt',
    { preHandler: requireRole('STUDENT') },
    uploadReceiptHandler
  );

  await fastify.register(async (parentScope) => {
    parentScope.addHook('preHandler', requireRole('PARENT'));

    // Only ever surfaces the GENERAL-over-threshold exception (see withdrawals.service.ts
    // processWithdrawal) — the normal agent-dispensed flow never creates anything a parent
    // needs to act on here.
    parentScope.get(
      '/pending-approval',
      { config: { rateLimit: READ_RATE_LIMIT } },
      getPendingApprovalsHandler
    );
    parentScope.patch('/:id/approve', approveWithdrawalHandler);
    parentScope.patch('/:id/reject', rejectWithdrawalHandler);
  });

  await fastify.register(async (agentScope) => {
    agentScope.addHook('preHandler', requireRole('ADMIN'));

    // Agent portal — every completed withdrawal, across every student.
    agentScope.get('/', { config: { rateLimit: READ_RATE_LIMIT } }, getAllWithdrawalsHandler);
    agentScope.get(
      '/lookup-student',
      { config: { rateLimit: READ_RATE_LIMIT } },
      lookupStudentHandler
    );
    agentScope.post('/process', processWithdrawalHandler);
    // Finishes a request that already cleared the parent-approval exception (status
    // APPROVED) — the normal case is dispensed directly by POST /process instead.
    agentScope.patch('/:id/complete', completeWithdrawalHandler);
  });
}
