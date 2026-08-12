import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import {
  approveWithdrawalHandler,
  completeWithdrawalHandler,
  getAllWithdrawalsForAdminHandler,
  getAllWithdrawalsHandler,
  getMyWithdrawalsHandler,
  getPendingApprovalsHandler,
  getReceiptFileHandler,
  getWithdrawalsForParentHandler,
  lookupStudentHandler,
  processWithdrawalHandler,
  rejectWithdrawalHandler,
  uploadReceiptHandler,
  verifyReceiptHandler,
} from './withdrawals.controller';

// Read-only endpoints are polled by useFocusEffect on tab-switch — same allowance as
// budget/wallet/savings.
const READ_RATE_LIMIT = { max: 60, timeWindow: '1 minute' };
// Financial write endpoint (dispenses real cash) — tighter than the global 100/min default.
const PROCESS_RATE_LIMIT = { max: 10, timeWindow: '1 minute' };

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

  // Shared across ADMIN/STUDENT/PARENT — getReceiptFile() itself enforces who may see which
  // receipt, since the three roles' access rules (any / own-wallet-only / linked-student-only)
  // don't map onto a single requireRole() gate.
  fastify.get(
    '/:id/receipt-file',
    { config: { rateLimit: READ_RATE_LIMIT } },
    getReceiptFileHandler
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
    parentScope.get(
      '/student/:studentId',
      { config: { rateLimit: READ_RATE_LIMIT } },
      getWithdrawalsForParentHandler
    );
    parentScope.patch('/:id/approve', approveWithdrawalHandler);
    parentScope.patch('/:id/reject', rejectWithdrawalHandler);
  });

  await fastify.register(async (agentScope) => {
    // ADMIN kept alongside AGENT — the agent portal now logs in with real AGENT accounts,
    // but ADMIN retains access too (e.g. GET /admin below, the web admin dashboard's Agent
    // Withdrawals page, and any admin-run demo/test flows that dispense directly).
    agentScope.addHook('preHandler', requireRole('ADMIN', 'AGENT'));

    // Agent portal — every completed withdrawal, across every student.
    agentScope.get('/', { config: { rateLimit: READ_RATE_LIMIT } }, getAllWithdrawalsHandler);
    // Admin dashboard's Agent Withdrawals page — same rows, plus which agent dispensed each
    // one. A separate route (not a change to GET / above) so the agent portal's own response
    // shape never shifts under it.
    agentScope.get(
      '/admin',
      { config: { rateLimit: READ_RATE_LIMIT } },
      getAllWithdrawalsForAdminHandler
    );
    agentScope.get(
      '/lookup-student',
      { config: { rateLimit: READ_RATE_LIMIT } },
      lookupStudentHandler
    );
    agentScope.post(
      '/process',
      { config: { rateLimit: PROCESS_RATE_LIMIT } },
      processWithdrawalHandler
    );
    // Finishes a request that already cleared the parent-approval exception (status
    // APPROVED) — the normal case is dispensed directly by POST /process instead.
    agentScope.patch('/:id/complete', completeWithdrawalHandler);
    agentScope.patch('/:id/verify-receipt', verifyReceiptHandler);
  });
}
