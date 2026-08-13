import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getOcrWorker } from './ocr-worker';
import type {
  Prisma,
  ReceiptVerificationStatus,
  TransactionCategory,
  User,
  UserType,
  Wallet,
  WithdrawalRequest,
  WithdrawalStatus,
} from '@prisma/client';
import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { updateSpent } from '../budget/budget.service';
import { createNotification } from '../notifications/notifications.service';
import { runAllChecks } from '../wallet/fraud.service';
import type { ProcessWithdrawalInput } from './withdrawals.schema';

// backend/src/modules/withdrawals -> backend (three levels up), same resolution as
// kyc.service.ts's UPLOADS_ROOT — works identically whether running from src/ (tsx) or dist/.
const BACKEND_ROOT = path.resolve(__dirname, '..', '..', '..');
const UPLOADS_ROOT = path.join(BACKEND_ROOT, 'uploads', 'withdrawals');

function formatMoney(amount: number | string | { toString(): string }): string {
  return Number(amount.toString()).toFixed(2);
}

async function getPrimaryWallet(userId: string): Promise<Wallet> {
  const wallet = await prisma.wallet.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });
  if (!wallet) {
    throw new AppError(404, 'WALLET_NOT_FOUND', 'No wallet found for this user');
  }
  return wallet;
}

// Agent search accepts either the student's email or their university student number
// (UniversityStudent.studentNumber, resolved to a linked EduWallet account).
async function findStudentUser(query: { studentEmail?: string; studentNumber?: string }): Promise<User> {
  if (query.studentEmail) {
    const user = await prisma.user.findUnique({ where: { email: query.studentEmail } });
    if (user?.userType !== 'STUDENT') {
      throw new AppError(404, 'STUDENT_NOT_FOUND', 'No student found with that email');
    }
    return user;
  }

  if (query.studentNumber) {
    const enrollment = await prisma.universityStudent.findFirst({
      where: { studentNumber: query.studentNumber },
    });
    if (!enrollment?.userId) {
      throw new AppError(
        404,
        'STUDENT_NOT_FOUND',
        'No EduWallet account is linked to that student number'
      );
    }
    const user = await prisma.user.findUnique({ where: { id: enrollment.userId } });
    if (user?.userType !== 'STUDENT') {
      throw new AppError(404, 'STUDENT_NOT_FOUND', 'No student found with that student number');
    }
    return user;
  }

  throw new AppError(400, 'VALIDATION_ERROR', 'Provide a student email or student number');
}

// Resolves a free-text search string (typed into the agent portal's search field) to a
// student — '@' means it's an email, otherwise it's treated as a university student number.
async function findStudentByQuery(query: string): Promise<User> {
  return query.includes('@')
    ? findStudentUser({ studentEmail: query })
    : findStudentUser({ studentNumber: query });
}

export type WithdrawalRequestWithStudent = WithdrawalRequest & {
  wallet: Wallet & { user: { id: string; fullName: string; email: string } };
};

const withStudentInclude = {
  wallet: { include: { user: { select: { id: true, fullName: true, email: true } as const } } },
} as const;

export async function getAllWithdrawals(): Promise<WithdrawalRequestWithStudent[]> {
  return prisma.withdrawalRequest.findMany({
    orderBy: { createdAt: 'desc' },
    include: withStudentInclude,
  });
}

export type WithdrawalRequestForAdmin = WithdrawalRequestWithStudent & {
  agent: { id: string; fullName: string; email: string } | null;
};

// The admin dashboard's Agent Withdrawals page — same rows as getAllWithdrawals() (the agent
// portal's own history view) plus who actually dispensed each one. WithdrawalRequest.agentId
// has no Prisma relation to User (it's just the raw id agentScope handlers stamp on at
// dispense time), so the agent's name/email is resolved with a second batched lookup instead
// of an `include`.
export async function getAllWithdrawalsForAdmin(): Promise<WithdrawalRequestForAdmin[]> {
  const requests = await prisma.withdrawalRequest.findMany({
    orderBy: { createdAt: 'desc' },
    include: withStudentInclude,
  });

  const agentIds = [...new Set(requests.map((r) => r.agentId).filter((id): id is string => id !== null))];
  const agents =
    agentIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: agentIds } },
          select: { id: true, fullName: true, email: true },
        })
      : [];
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));

  return requests.map((request) => ({
    ...request,
    agent: request.agentId ? (agentById.get(request.agentId) ?? null) : null,
  }));
}

// Student-facing history — every withdrawal request regardless of status. A GENERAL-over-
// threshold request still awaiting (or rejected by) the parent isn't "cash the student has
// received" yet, but the student should still be able to see where it stands (the mobile UI
// renders a dedicated approval/completion status badge per row for exactly this).
export async function getWithdrawalsForStudent(studentUserId: string): Promise<WithdrawalRequest[]> {
  const wallet = await getPrimaryWallet(studentUserId);
  return prisma.withdrawalRequest.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getPendingApprovalsForParent(
  parentUserId: string
): Promise<WithdrawalRequestWithStudent[]> {
  const links = await prisma.parentalControl.findMany({
    where: { parentUserId },
    select: { studentUserId: true },
  });
  const studentIds = links.map((link) => link.studentUserId);
  if (studentIds.length === 0) {
    return [];
  }

  const wallets = await prisma.wallet.findMany({
    where: { userId: { in: studentIds } },
    select: { id: true },
  });
  const walletIds = wallets.map((wallet) => wallet.id);

  return prisma.withdrawalRequest.findMany({
    where: { walletId: { in: walletIds }, status: 'PENDING_PARENT_APPROVAL' },
    orderBy: { createdAt: 'desc' },
    include: withStudentInclude,
  });
}

// receiptVerificationStatus defaults to PENDING before a receipt even exists, so "no receipt
// yet" and "receipt uploaded but auto-detection was inconclusive" are otherwise
// indistinguishable — NOT_UPLOADED is the derived state every parent-facing surface (mobile
// screen, this endpoint) actually keys off, same distinction the Agent Withdrawals admin page
// makes.
export type StudentReceiptStatus = ReceiptVerificationStatus | 'NOT_UPLOADED';

export type StudentWithdrawalForParent = WithdrawalRequest & {
  agent: { id: string; fullName: string } | null;
  receiptStatus: StudentReceiptStatus;
  receiptUrl: string | null;
};

// Every withdrawal (any status) for one linked student — the parent's "Cash Withdrawals"
// section on that student's detail screen. Unlike getPendingApprovalsForParent() above (only
// the GENERAL-over-threshold exception awaiting a decision), this is the full history so a
// parent can see what was actually dispensed and whether the receipt still needs following up.
export async function getWithdrawalsForParent(
  parentUserId: string,
  studentUserId: string
): Promise<StudentWithdrawalForParent[]> {
  const link = await prisma.parentalControl.findUnique({
    where: { parentUserId_studentUserId: { parentUserId, studentUserId } },
  });
  if (!link) {
    throw new AppError(403, 'NOT_LINKED', 'You are not linked to this student');
  }

  const wallet = await getPrimaryWallet(studentUserId);
  const requests = await prisma.withdrawalRequest.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: 'desc' },
  });

  const agentIds = [...new Set(requests.map((r) => r.agentId).filter((id): id is string => id !== null))];
  const agents =
    agentIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: agentIds } },
          select: { id: true, fullName: true },
        })
      : [];
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));

  return requests.map((request) => ({
    ...request,
    agent: request.agentId ? (agentById.get(request.agentId) ?? null) : null,
    receiptStatus: request.receiptPath ? request.receiptVerificationStatus : 'NOT_UPLOADED',
    receiptUrl: request.receiptPath ? `/withdrawals/${request.id}/receipt-file` : null,
  }));
}

export type StudentLookup = {
  user: { id: string; fullName: string; email: string };
  wallet: { id: string; balance: string; currency: string };
  freeBalance: string;
  lockedFunds: Array<{ category: TransactionCategory; amount: string }>;
  approvalThreshold: string | null;
  allowedCategories: TransactionCategory[] | null;
};

export async function lookupStudent(query: string): Promise<StudentLookup> {
  const user = await findStudentByQuery(query);
  const wallet = await getPrimaryWallet(user.id);
  const lockedFunds = await prisma.lockedFund.findMany({ where: { walletId: wallet.id } });
  const parentalControl = await prisma.parentalControl.findFirst({
    where: { studentUserId: user.id },
  });

  // GENERAL only ever draws from money that isn't locked to a category — the rest of
  // wallet.balance is already earmarked (LockedFund rows), same distinction disburse() relies
  // on to keep GENERAL withdrawals from silently dipping into locked funds.
  const totalLocked = lockedFunds.reduce((sum, fund) => sum + Number(fund.amount), 0);
  const freeBalance = Math.max(0, Number(wallet.balance) - totalLocked);

  return {
    user: { id: user.id, fullName: user.fullName, email: user.email },
    wallet: { id: wallet.id, balance: formatMoney(wallet.balance), currency: wallet.currency },
    freeBalance: formatMoney(freeBalance),
    lockedFunds: lockedFunds.map((fund) => ({
      category: fund.category,
      amount: formatMoney(fund.amount),
    })),
    approvalThreshold: parentalControl ? formatMoney(parentalControl.approvalThreshold) : null,
    allowedCategories: parentalControl ? parentalControl.categories : null,
  };
}

// Shared by the immediate agent-initiated dispense (processWithdrawal, below) and by
// completeWithdrawal (finishing a request that already cleared the parent-approval
// exception) — both end the same way: decrement LockedFund + wallet.balance, mark/create
// the WithdrawalRequest as COMPLETED, log a WithdrawalHistory row, notify student + parent.
// One immutable audit row per WithdrawalRequest.status transition — accepts either the plain
// client or a $transaction callback's `tx`, since disburse() below needs the write to be part
// of the same atomic transaction that moves the money.
async function recordWithdrawalHistory(
  db: Prisma.TransactionClient,
  request: {
    id: string;
    walletId: string;
    amount: Prisma.Decimal | number | string;
    category: TransactionCategory;
    status: WithdrawalStatus;
  },
  note: string | null
): Promise<void> {
  await db.withdrawalHistory.create({
    data: {
      walletId: request.walletId,
      withdrawalRequestId: request.id,
      amount: request.amount,
      category: request.category,
      status: request.status,
      note,
    },
  });
}

async function disburse(
  adminUserId: string,
  wallet: Wallet,
  category: TransactionCategory,
  amount: number,
  existingRequestId?: string
): Promise<{ request: WithdrawalRequest; newBalance: string }> {
  const { request, newBalance, transaction } = await prisma.$transaction(async (tx) => {
    // Same guarded decrement pattern as cards.service.ts useCard() — GENERAL never has a
    // LockedFund row, so only locked categories touch it.
    if (category !== 'GENERAL') {
      const lockedDebit = await tx.lockedFund.updateMany({
        where: { walletId: wallet.id, category, amount: { gte: amount } },
        data: { amount: { decrement: amount } },
      });
      if (lockedDebit.count === 0) {
        throw new AppError(
          400,
          'INSUFFICIENT_LOCKED_FUNDS',
          `Insufficient locked funds for ${category.toLowerCase()}`
        );
      }
    }

    // LockedFund.amount is a sub-allocation of wallet.balance, not a separate pool — the
    // cash actually leaving the wallet must also decrement wallet.balance, same as every
    // other locked-category spend path (cards.service.ts, wallet.service.ts transfer()).
    const walletDebit = await tx.wallet.updateMany({
      where: { id: wallet.id, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });
    if (walletDebit.count === 0) {
      throw new AppError(400, 'INSUFFICIENT_BALANCE', 'Student no longer has enough wallet balance');
    }

    const completedRequest = existingRequestId
      ? await tx.withdrawalRequest.update({
          where: { id: existingRequestId },
          data: { status: 'COMPLETED', completedAt: new Date(), agentId: adminUserId },
        })
      : await tx.withdrawalRequest.create({
          data: {
            walletId: wallet.id,
            amount,
            category,
            status: 'COMPLETED',
            completedAt: new Date(),
            agentId: adminUserId,
          },
        });

    await recordWithdrawalHistory(
      tx,
      { id: completedRequest.id, walletId: wallet.id, amount, category, status: 'COMPLETED' },
      existingRequestId ? 'Completed by agent after parent approval' : 'Dispensed by agent'
    );

    // Feeds fraud monitoring the same way card payments and transfers do — cash leaving the
    // wallet with no toWalletId, mirroring a merchant card payment (cards.service.ts useCard()).
    // status distinguishes how this withdrawal got here: AUTO_APPROVED only for an immediate
    // agent dispense with no parent involved; APPROVED when it followed the PENDING_PARENT_
    // APPROVAL -> APPROVED flow. Both display as "Completed" to the student (see
    // transactionDisplay.ts on the client), but the underlying status must stay accurate for
    // anything downstream that filters/counts by it (reports, admin transaction lists) —
    // otherwise a parent-approved withdrawal would misreport as system-auto-approved.
    const createdTransaction = await tx.transaction.create({
      data: {
        fromWalletId: wallet.id,
        toWalletId: null,
        amount,
        currency: wallet.currency,
        category,
        status: existingRequestId ? 'APPROVED' : 'AUTO_APPROVED',
        note: 'Cash withdrawal',
        receiverName: 'Cash Withdrawal',
      },
    });

    const updatedWallet = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    return {
      request: completedRequest,
      newBalance: formatMoney(updatedWallet.balance),
      transaction: createdTransaction,
    };
  });

  // Same as every other spend path (cards.service.ts useCard(), wallet.service.ts transfer())
  // — cash withdrawn from a category is spending against that category's monthly budget just
  // as much as a card payment is. Without this, BudgetCategory.spent (and GET /budget) only
  // ever reflected card payments, undercounting anyone who withdrew cash instead.
  await updateSpent(wallet.id, category, amount);

  await runAllChecks(transaction);

  await createNotification(
    wallet.userId,
    'Cash Withdrawal',
    `You withdrew $${formatMoney(amount)} cash from ${category.toLowerCase()} at agent. Don't forget to upload your receipt so it can be verified.`,
    'WITHDRAWAL_COMPLETED'
  );

  const parentalControl = await prisma.parentalControl.findFirst({
    where: { studentUserId: wallet.userId },
  });
  if (parentalControl) {
    const student = await prisma.user.findUnique({
      where: { id: wallet.userId },
      select: { fullName: true },
    });
    await createNotification(
      parentalControl.parentUserId,
      'Student Cash Withdrawal',
      `${student?.fullName ?? 'Your child'} withdrew $${formatMoney(amount)} cash from ${category.toLowerCase()}`,
      'STUDENT_WITHDRAWAL'
    );
  }

  return { request, newBalance };
}

export type ProcessWithdrawalResult = {
  pending: boolean;
  request: WithdrawalRequest;
  studentName: string;
  newBalance?: string;
};

// The agent portal's single action: agent identifies the student, enters amount + category,
// and this either dispenses immediately or — only for the GENERAL-over-threshold exception —
// parks the request for the parent to approve first.
export async function processWithdrawal(
  adminUserId: string,
  input: ProcessWithdrawalInput
): Promise<ProcessWithdrawalResult> {
  const student = await findStudentUser(input);

  // Same gate as every other spend path (cards.service.ts createCard/useCard, wallet.service.ts
  // transfer()) — cash withdrawal is real money leaving the wallet and shouldn't be reachable
  // before the student's university KYC is verified.
  if (student.kycStatus !== 'VERIFIED') {
    throw new AppError(
      403,
      'KYC_REQUIRED',
      'This student must complete university KYC verification before cash can be withdrawn'
    );
  }

  const wallet = await getPrimaryWallet(student.id);
  const parentalControl = await prisma.parentalControl.findFirst({
    where: { studentUserId: student.id },
  });

  if (input.category === 'GENERAL') {
    // GENERAL must never dip into money already locked to a category — only the free
    // (unlocked) portion of the wallet balance is eligible here.
    const lockedFunds = await prisma.lockedFund.findMany({ where: { walletId: wallet.id } });
    const totalLocked = lockedFunds.reduce((sum, fund) => sum + Number(fund.amount), 0);
    const freeBalance = Math.max(0, Number(wallet.balance) - totalLocked);

    if (input.amount > freeBalance) {
      throw new AppError(
        400,
        'INSUFFICIENT_BALANCE',
        'Withdrawal amount exceeds the student\'s free (unlocked) wallet balance'
      );
    }

    const threshold = parentalControl ? Number(parentalControl.approvalThreshold) : 0;
    if (parentalControl && threshold > 0 && input.amount > threshold) {
      const request = await prisma.withdrawalRequest.create({
        data: {
          walletId: wallet.id,
          amount: input.amount,
          category: 'GENERAL',
          status: 'PENDING_PARENT_APPROVAL',
          // No Prisma relation to User (see getAllWithdrawalsForAdmin's note above) — stamped
          // here with the *initiating* agent so approveWithdrawal below can notify them back.
          // completeWithdrawal's disburse() call overwrites this with whichever agent actually
          // ends up dispensing the cash, which remains the correct source of truth once the
          // request reaches COMPLETED.
          agentId: adminUserId,
        },
      });

      await recordWithdrawalHistory(
        prisma,
        { id: request.id, walletId: wallet.id, amount: input.amount, category: 'GENERAL', status: 'PENDING_PARENT_APPROVAL' },
        'Requested by agent, awaiting parent approval (over threshold)'
      );

      await createNotification(
        parentalControl.parentUserId,
        'Withdrawal Approval Needed',
        `${student.fullName} is requesting to withdraw $${formatMoney(input.amount)} cash at an agent. Your approval is needed.`,
        'WITHDRAWAL_APPROVAL_NEEDED'
      );

      await createNotification(
        adminUserId,
        'Withdrawal Pending Approval',
        `Withdrawal request for ${student.fullName} ($${formatMoney(input.amount)}, ${input.category}) requires parent approval. You will be notified once approved.`,
        'WITHDRAWAL_PENDING_APPROVAL'
      );

      return { pending: true, request, studentName: student.fullName };
    }
  } else {
    if (parentalControl && !parentalControl.categories.includes(input.category)) {
      throw new AppError(
        403,
        'CATEGORY_NOT_AUTHORIZED',
        `This student's parent has not authorized withdrawals in the ${input.category.toLowerCase()} category`
      );
    }
    const lockedFund = await prisma.lockedFund.findUnique({
      where: { walletId_category: { walletId: wallet.id, category: input.category } },
    });
    const available = lockedFund ? Number(lockedFund.amount) : 0;
    if (input.amount > available) {
      throw new AppError(
        400,
        'INSUFFICIENT_LOCKED_FUNDS',
        `Withdrawal amount exceeds the student's locked ${input.category.toLowerCase()} balance`
      );
    }
  }

  const { request, newBalance } = await disburse(adminUserId, wallet, input.category, input.amount);

  return { pending: false, request, studentName: student.fullName, newBalance };
}

async function getPendingParentApprovalForParent(
  parentUserId: string,
  requestId: string
): Promise<{ request: WithdrawalRequest; wallet: Wallet }> {
  const request = await prisma.withdrawalRequest.findUnique({ where: { id: requestId } });
  if (request?.status !== 'PENDING_PARENT_APPROVAL') {
    throw new AppError(
      404,
      'WITHDRAWAL_REQUEST_NOT_FOUND',
      'Withdrawal request not found or not awaiting your approval'
    );
  }

  const wallet = await prisma.wallet.findUnique({ where: { id: request.walletId } });
  if (!wallet) {
    throw new AppError(404, 'WALLET_NOT_FOUND', 'Student wallet not found');
  }

  const link = await prisma.parentalControl.findUnique({
    where: { parentUserId_studentUserId: { parentUserId, studentUserId: wallet.userId } },
  });
  if (!link) {
    throw new AppError(403, 'NOT_LINKED', 'You are not linked to this student');
  }

  return { request, wallet };
}

// Only ever reached via the GENERAL-over-threshold exception (processWithdrawal creates the
// PENDING_PARENT_APPROVAL request above) — parent approves, agent then dispenses via
// completeWithdrawal below. Money has not moved yet at this point.
export async function approveWithdrawal(
  parentUserId: string,
  requestId: string
): Promise<WithdrawalRequest> {
  const { request, wallet } = await getPendingParentApprovalForParent(parentUserId, requestId);

  const updated = await prisma.withdrawalRequest.update({
    where: { id: request.id },
    data: { status: 'APPROVED', approvedAt: new Date() },
  });

  await recordWithdrawalHistory(
    prisma,
    { id: updated.id, walletId: wallet.id, amount: updated.amount, category: updated.category, status: 'APPROVED' },
    'Approved by parent'
  );

  await createNotification(
    wallet.userId,
    'Withdrawal Approved',
    `Your cash withdrawal request of $${formatMoney(request.amount)} has been approved. Visit an agent to collect your cash.`,
    'WITHDRAWAL_APPROVED'
  );

  if (updated.agentId) {
    const student = await prisma.user.findUnique({
      where: { id: wallet.userId },
      select: { fullName: true },
    });
    await createNotification(
      updated.agentId,
      'Withdrawal Approved',
      `${student?.fullName ?? 'The student'}'s withdrawal has been approved. You can now dispense $${formatMoney(updated.amount)}.`,
      'WITHDRAWAL_APPROVED_FOR_AGENT'
    );
  }

  return updated;
}

export async function rejectWithdrawal(
  parentUserId: string,
  requestId: string,
  reason: string
): Promise<WithdrawalRequest> {
  const { request, wallet } = await getPendingParentApprovalForParent(parentUserId, requestId);

  const updated = await prisma.withdrawalRequest.update({
    where: { id: request.id },
    data: { status: 'REJECTED' },
  });

  await recordWithdrawalHistory(
    prisma,
    { id: updated.id, walletId: wallet.id, amount: updated.amount, category: updated.category, status: 'REJECTED' },
    reason
  );

  await createNotification(
    wallet.userId,
    'Withdrawal Rejected',
    `Your cash withdrawal request of $${formatMoney(request.amount)} was rejected. Reason: ${reason}`,
    'WITHDRAWAL_REJECTED'
  );

  return updated;
}

// Finishes a request that went through the parent-approval exception (status APPROVED).
// The immediate/normal path never reaches this — it's dispensed directly by
// processWithdrawal via the shared disburse() helper above.
export async function completeWithdrawal(
  adminUserId: string,
  requestId: string
): Promise<WithdrawalRequest> {
  const request = await prisma.withdrawalRequest.findUnique({ where: { id: requestId } });
  if (request?.status !== 'APPROVED') {
    throw new AppError(
      400,
      'WITHDRAWAL_NOT_APPROVED',
      'This withdrawal request is not ready to be processed'
    );
  }

  const wallet = await prisma.wallet.findUnique({ where: { id: request.walletId } });
  if (!wallet) {
    throw new AppError(404, 'WALLET_NOT_FOUND', 'Student wallet not found');
  }

  const { request: completed } = await disburse(
    adminUserId,
    wallet,
    request.category,
    Number(request.amount),
    request.id
  );

  return completed;
}

// Rule-based "OCR" (no ML, per CLAUDE.md's AI Financial Assistant convention) — there's no
// real text extraction from the image; the receipt filename plus whatever merchant name the
// student typed in stands in for it.
const RECEIPT_CATEGORY_KEYWORDS: Array<{ category: TransactionCategory; keywords: string[] }> = [
  {
    category: 'FOOD',
    keywords: [
      'restaurant',
      'cafe',
      'pizza',
      'burger',
      'grocery',
      'supermarket',
      'meal',
      'drink',
      'coffee',
      'food',
    ],
  },
  { category: 'BOOKS', keywords: ['bookstore', 'textbook', 'library', 'book', 'course', 'academic'] },
  {
    category: 'SOFTWARE',
    keywords: ['software', 'app', 'subscription', 'license', 'digital', 'tech', 'store'],
  },
  {
    category: 'TUITION',
    keywords: ['university', 'tuition', 'registration', 'semester', 'enrollment', 'fee'],
  },
  { category: 'TRANSPORT', keywords: ['taxi', 'uber', 'bus', 'metro', 'fuel', 'parking', 'transport'] },
  {
    category: 'LIFESTYLE',
    keywords: ['pharmacy', 'clothing', 'salon', 'cosmetics', 'shoes', 'fashion', 'beauty'],
  },
];

function detectCategoryFromText(text: string): TransactionCategory | null {
  const lower = text.toLowerCase();
  let best: { category: TransactionCategory; hits: number } | null = null;
  for (const { category, keywords } of RECEIPT_CATEGORY_KEYWORDS) {
    const hits = keywords.filter((keyword) => lower.includes(keyword)).length;
    if (hits > 0 && (!best || hits > best.hits)) {
      best = { category, hits };
    }
  }
  return best?.category ?? null;
}

// Matches a Unicode combining mark — what NFKD decomposition splits an accented letter into
// (e.g. "e" + a combining acute accent), so stripping this after normalize() is the standard
// way to fold accents away for matching (the Unicode property escape avoids hardcoding a
// numeric code-point range in source).
const COMBINING_DIACRITICS_PATTERN = /\p{Mn}/gu;

// Lowercases, strips accents (so "Café" matches "cafe"), and collapses any run of
// non-alphanumeric characters (receipt punctuation, extra whitespace, underscores in a
// filename) down to a single space — makes the contains-check below tolerant of formatting
// noise a case-only comparison would still miss (e.g. "CARREFOUR-LAVAL_receipt.jpg").
function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(COMBINING_DIACRITICS_PATTERN, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Minimum fraction of a merchant name's words that must appear in the OCR text for the fuzzy
// fallback below to accept it once the strict "every word must appear" match has failed for
// every merchant — catches a merchant name partially obscured or reworded on a real receipt
// without being so loose it starts matching unrelated merchants.
const FUZZY_MATCH_THRESHOLD = 0.6;

// Real OCR — reads whatever text Tesseract can find on the receipt image already written to
// disk, via the process-lifetime worker from ocr-worker.ts (eng+fra, pre-warmed at server
// startup) rather than spinning up a new worker per request. Wrapped in try/catch so a corrupt
// image or a Tesseract hiccup degrades to "no text extracted" (-> PENDING, manual review)
// instead of failing the whole upload request.
async function extractReceiptText(absoluteFilePath: string): Promise<string> {
  try {
    const worker = await getOcrWorker();
    const {
      data: { text },
    } = await worker.recognize(absoluteFilePath);
    console.log(`[receipt-ocr] Tesseract raw output: ${JSON.stringify(text)}`);
    return text;
  } catch (err) {
    console.error('[receipt-ocr] Tesseract OCR failed', err);
    return '';
  }
}

async function detectMerchant(
  text: string
): Promise<{ name: string; category: TransactionCategory } | null> {
  const normalizedText = normalizeForMatch(text);
  console.log(`[receipt-ocr] raw OCR text (pre-normalization): ${JSON.stringify(text)}`);
  console.log(`[receipt-ocr] normalized OCR text: ${JSON.stringify(normalizedText)}`);
  if (!normalizedText) return null;

  const merchants = await prisma.merchant.findMany({ where: { isActive: true } });
  console.log(
    `[receipt-ocr] DB merchants (${merchants.length}) as stored:`,
    merchants.map((m) => JSON.stringify(m.name))
  );

  let bestFuzzy: { merchant: (typeof merchants)[number]; ratio: number } | null = null;

  for (const merchant of merchants) {
    const normalizedName = normalizeForMatch(merchant.name);
    const nameWords = normalizedName.split(' ').filter(Boolean);
    const matchedWords = nameWords.filter((word) => normalizedText.includes(word));
    const allWordsMatch = nameWords.length > 0 && matchedWords.length === nameWords.length;
    const ratio = nameWords.length > 0 ? matchedWords.length / nameWords.length : 0;
    console.log(
      `[receipt-ocr] comparing DB merchant ${JSON.stringify(merchant.name)} -> normalized ${JSON.stringify(normalizedName)}, ` +
        `normalizedText.includes(normalizedName) = ${normalizedText.includes(normalizedName)}, ` +
        `words [${nameWords.join(', ')}] matched [${matchedWords.join(', ')}] (${Math.round(ratio * 100)}%) -> ` +
        `${allWordsMatch ? 'EXACT MATCH' : 'no exact match'}`
    );
    if (allWordsMatch) {
      return { name: merchant.name, category: merchant.category };
    }
    if (ratio >= FUZZY_MATCH_THRESHOLD && (!bestFuzzy || ratio > bestFuzzy.ratio)) {
      bestFuzzy = { merchant, ratio };
    }
  }

  if (bestFuzzy) {
    console.log(
      `[receipt-ocr] no exact match — accepting fuzzy match ${JSON.stringify(bestFuzzy.merchant.name)} ` +
        `(${Math.round(bestFuzzy.ratio * 100)}% of words matched, threshold ${Math.round(FUZZY_MATCH_THRESHOLD * 100)}%)`
    );
    return { name: bestFuzzy.merchant.name, category: bestFuzzy.merchant.category };
  }

  console.log('[receipt-ocr] no merchant matched (exact or fuzzy)');
  return null;
}

export async function uploadReceipt(
  studentUserId: string,
  requestId: string,
  fileName: string,
  fileBuffer: Buffer,
  providedMerchantName: string | undefined
): Promise<WithdrawalRequest> {
  const request = await prisma.withdrawalRequest.findUnique({ where: { id: requestId } });
  const wallet = request
    ? await prisma.wallet.findUnique({ where: { id: request.walletId } })
    : null;
  if (!request || !wallet || wallet.userId !== studentUserId) {
    throw new AppError(404, 'WITHDRAWAL_REQUEST_NOT_FOUND', 'Withdrawal request not found');
  }
  if (request.status !== 'COMPLETED') {
    throw new AppError(
      400,
      'WITHDRAWAL_NOT_COMPLETED',
      'You can only upload a receipt after the withdrawal has been processed'
    );
  }

  const userDir = path.join(UPLOADS_ROOT, studentUserId);
  await fs.mkdir(userDir, { recursive: true });
  const storedFileName = `${randomUUID()}${path.extname(fileName)}`;
  const absoluteFilePath = path.join(userDir, storedFileName);
  await fs.writeFile(absoluteFilePath, fileBuffer);
  const filePath = path.relative(BACKEND_ROOT, absoluteFilePath);

  // Set before OCR starts (which can take several seconds) so anyone viewing this withdrawal
  // elsewhere — the agent withdrawals list, the parent's student detail page — sees an accurate
  // "still being checked" state instead of a stale PENDING left over from before the receipt
  // existed at all.
  await prisma.withdrawalRequest.update({
    where: { id: request.id },
    data: {
      receiptPath: filePath,
      receiptVerificationStatus: 'PROCESSING',
      receiptVerificationNote: null,
      merchantName: null,
      detectedCategory: null,
    },
  });

  const extractedText = (await extractReceiptText(absoluteFilePath)).trim();
  const merchantMatch = extractedText ? await detectMerchant(extractedText) : null;
  // Only ever informational once the merchant lookup below decides the status — a keyword hit
  // alone (e.g. "cafe" in the filename) is not a merchant match and must never AUTO_VERIFY or
  // FLAG a receipt for an unregistered business.
  const detectedCategory = merchantMatch?.category ?? (extractedText ? detectCategoryFromText(extractedText) : null);
  const merchantName = merchantMatch?.name ?? providedMerchantName ?? null;

  let receiptVerificationStatus: ReceiptVerificationStatus;
  let receiptVerificationNote: string | null = null;

  if (!merchantMatch) {
    receiptVerificationStatus = 'PENDING';
    receiptVerificationNote = 'Merchant could not be matched to a known business — manual review needed.';
  } else if (merchantMatch.category === request.category) {
    receiptVerificationStatus = 'AUTO_VERIFIED';
  } else {
    receiptVerificationStatus = 'FLAGGED';
    receiptVerificationNote = `Receipt merchant "${merchantMatch.name}" is registered for ${merchantMatch.category.toLowerCase()}, but the withdrawal was declared as ${request.category.toLowerCase()}.`;
  }

  const updated = await prisma.withdrawalRequest.update({
    where: { id: request.id },
    data: {
      receiptPath: filePath,
      receiptVerificationStatus,
      receiptVerificationNote,
      merchantName,
      detectedCategory,
    },
  });

  // Receipt review never changes WithdrawalRequest.status, so no new history row is warranted
  // here — only refresh the receipt snapshot on the COMPLETED transition row (the audit rows
  // for earlier transitions like PENDING_PARENT_APPROVAL predate the receipt and must stay as
  // they were).
  await prisma.withdrawalHistory.updateMany({
    where: { withdrawalRequestId: request.id, status: 'COMPLETED' },
    data: { receiptVerificationStatus, merchantName },
  });

  if (receiptVerificationStatus === 'FLAGGED') {
    const parentalControl = await prisma.parentalControl.findFirst({ where: { studentUserId } });
    if (parentalControl) {
      const student = await prisma.user.findUnique({
        where: { id: studentUserId },
        select: { fullName: true },
      });
      await createNotification(
        parentalControl.parentUserId,
        'Withdrawal Receipt Flagged',
        `Your student ${student?.fullName ?? ''}'s withdrawal receipt was flagged for review. Amount: $${formatMoney(request.amount)}, Category: ${request.category.toLowerCase()}`,
        'WITHDRAWAL_RECEIPT_FLAGGED'
      );
    }
  }

  return updated;
}

// Only lets a student clear their own receipt while it's still in an unresolved state —
// PENDING (auto-detection couldn't match a merchant, awaiting manual review) or PROCESSING
// (OCR still running). Once AUTO_VERIFIED/MANUALLY_VERIFIED/FLAGGED/REJECTED, an admin or the
// verification pipeline has already acted on this exact file, so it must stay in place as the
// record of what was reviewed.
const DELETABLE_RECEIPT_STATUSES = new Set<ReceiptVerificationStatus>(['PENDING', 'PROCESSING']);

export async function deleteReceipt(
  studentUserId: string,
  requestId: string
): Promise<WithdrawalRequest> {
  const request = await prisma.withdrawalRequest.findUnique({ where: { id: requestId } });
  const wallet = request
    ? await prisma.wallet.findUnique({ where: { id: request.walletId } })
    : null;
  if (!request || !wallet || wallet.userId !== studentUserId) {
    throw new AppError(404, 'WITHDRAWAL_REQUEST_NOT_FOUND', 'Withdrawal request not found');
  }
  if (!request.receiptPath) {
    throw new AppError(400, 'RECEIPT_NOT_FOUND', 'No receipt has been uploaded for this withdrawal');
  }
  if (!DELETABLE_RECEIPT_STATUSES.has(request.receiptVerificationStatus)) {
    throw new AppError(
      400,
      'RECEIPT_ALREADY_RESOLVED',
      'This receipt has already been verified or flagged and can no longer be removed'
    );
  }

  const updated = await prisma.withdrawalRequest.update({
    where: { id: request.id },
    data: {
      receiptPath: null,
      receiptVerificationStatus: 'PENDING',
      receiptVerificationNote: null,
      merchantName: null,
      detectedCategory: null,
    },
  });

  const absolutePath = path.join(BACKEND_ROOT, request.receiptPath);
  await fs.unlink(absolutePath).catch(() => {});

  return updated;
}

export async function getReceiptFile(
  requestId: string,
  requester: { id: string; userType: UserType }
): Promise<{ request: WithdrawalRequest; absolutePath: string }> {
  const request = await prisma.withdrawalRequest.findUnique({ where: { id: requestId } });
  if (!request?.receiptPath) {
    throw new AppError(404, 'RECEIPT_NOT_FOUND', 'No receipt has been uploaded for this withdrawal');
  }

  const wallet = await prisma.wallet.findUnique({ where: { id: request.walletId } });
  if (!wallet) {
    throw new AppError(404, 'RECEIPT_NOT_FOUND', 'No receipt has been uploaded for this withdrawal');
  }

  if (requester.userType === 'ADMIN') {
    // allowed
  } else if (requester.userType === 'STUDENT') {
    if (wallet.userId !== requester.id) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have access to this receipt');
    }
  } else if (requester.userType === 'PARENT') {
    const link = await prisma.parentalControl.findUnique({
      where: { parentUserId_studentUserId: { parentUserId: requester.id, studentUserId: wallet.userId } },
    });
    if (!link) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have access to this receipt');
    }
  } else {
    throw new AppError(403, 'FORBIDDEN', 'You do not have access to this receipt');
  }

  const absolutePath = path.join(BACKEND_ROOT, request.receiptPath);
  try {
    await fs.access(absolutePath);
  } catch {
    throw new AppError(404, 'RECEIPT_FILE_MISSING', 'Receipt file not found on disk');
  }

  return { request, absolutePath };
}

const RECEIPT_DECISION_STATUS: Record<'VERIFIED' | 'FLAGGED' | 'REJECTED', ReceiptVerificationStatus> = {
  VERIFIED: 'MANUALLY_VERIFIED',
  FLAGGED: 'FLAGGED',
  REJECTED: 'REJECTED',
};

const RECEIPT_DECISION_NOTIFICATION_MESSAGE: Record<'VERIFIED' | 'FLAGGED' | 'REJECTED', string> = {
  VERIFIED: 'Your receipt has been verified by admin',
  FLAGGED: 'Your receipt has been flagged for review',
  REJECTED: 'Your receipt was rejected. Please contact support.',
};

// Admin's manual call on a receipt the rule-based auto-detection in uploadReceipt() couldn't
// confidently resolve (PENDING, or an AUTO_VERIFIED/FLAGGED result the admin wants to override)
// — Agent Withdrawals page's "Mark as Verified" / "Flag Receipt" / "Reject" actions.
export async function verifyReceipt(
  requestId: string,
  decision: 'VERIFIED' | 'FLAGGED' | 'REJECTED',
  note: string | undefined
): Promise<WithdrawalRequest> {
  const request = await prisma.withdrawalRequest.findUnique({ where: { id: requestId } });
  if (!request?.receiptPath) {
    throw new AppError(404, 'RECEIPT_NOT_FOUND', 'No receipt has been uploaded for this withdrawal');
  }

  const receiptVerificationStatus = RECEIPT_DECISION_STATUS[decision];
  const receiptVerificationNote = note?.trim() || null;

  const updated = await prisma.withdrawalRequest.update({
    where: { id: request.id },
    data: { receiptVerificationStatus, receiptVerificationNote },
  });

  // Same reasoning as uploadReceipt() above — admin's manual receipt decision doesn't move
  // WithdrawalRequest.status, so only the COMPLETED transition row's receipt snapshot updates.
  await prisma.withdrawalHistory.updateMany({
    where: { withdrawalRequestId: request.id, status: 'COMPLETED' },
    data: { receiptVerificationStatus },
  });

  const wallet = await prisma.wallet.findUnique({ where: { id: request.walletId } });
  if (wallet) {
    await createNotification(
      wallet.userId,
      'Receipt Review Update',
      `${RECEIPT_DECISION_NOTIFICATION_MESSAGE[decision]}${receiptVerificationNote ? ` Note: ${receiptVerificationNote}` : ''}`,
      'WITHDRAWAL_RECEIPT_REVIEWED'
    );

    if (decision === 'FLAGGED') {
      const parentalControl = await prisma.parentalControl.findFirst({ where: { studentUserId: wallet.userId } });
      if (parentalControl) {
        const student = await prisma.user.findUnique({
          where: { id: wallet.userId },
          select: { fullName: true },
        });
        await createNotification(
          parentalControl.parentUserId,
          'Withdrawal Receipt Flagged',
          `Your student ${student?.fullName ?? ''}'s withdrawal receipt was flagged for review. Amount: $${formatMoney(request.amount)}, Category: ${request.category.toLowerCase()}`,
          'WITHDRAWAL_RECEIPT_FLAGGED'
        );
      }
    }
  }

  return updated;
}

const RECEIPT_REMINDER_THRESHOLD_MS = 24 * 60 * 60 * 1000;

// COMPLETED withdrawals sit in the student's history with a PENDING receiptVerificationStatus
// forever if the student never uploads one — nothing else ever revisits them. This is the only
// path that nudges both sides once 24h have passed, and receiptReminderSentAt makes sure the
// hourly cron below only fires it once per withdrawal.
export async function sendMissingReceiptReminders(): Promise<number> {
  const cutoff = new Date(Date.now() - RECEIPT_REMINDER_THRESHOLD_MS);

  const overdue = await prisma.withdrawalRequest.findMany({
    where: {
      status: 'COMPLETED',
      // GENERAL draws from unlocked free balance and was never required to prove a locked
      // category was spent correctly, so it never needs a receipt in the first place.
      category: { not: 'GENERAL' },
      receiptPath: null,
      receiptReminderSentAt: null,
      completedAt: { lte: cutoff },
    },
  });

  for (const request of overdue) {
    const wallet = await prisma.wallet.findUnique({ where: { id: request.walletId } });
    if (!wallet) continue;

    const student = await prisma.user.findUnique({
      where: { id: wallet.userId },
      select: { fullName: true },
    });

    await createNotification(
      wallet.userId,
      'Receipt Reminder',
      `Reminder: you have not uploaded a receipt for your $${formatMoney(request.amount)} ${request.category.toLowerCase()} cash withdrawal`,
      'WITHDRAWAL_RECEIPT_REMINDER'
    );

    const parentalControl = await prisma.parentalControl.findFirst({ where: { studentUserId: wallet.userId } });
    if (parentalControl) {
      await createNotification(
        parentalControl.parentUserId,
        'Receipt Reminder',
        `Reminder: ${student?.fullName ?? 'Your student'} has not uploaded a receipt for their $${formatMoney(request.amount)} ${request.category.toLowerCase()} cash withdrawal`,
        'WITHDRAWAL_RECEIPT_REMINDER'
      );
    }

    await prisma.withdrawalRequest.update({
      where: { id: request.id },
      data: { receiptReminderSentAt: new Date() },
    });
  }

  return overdue.length;
}

const RECEIPT_REMINDER_CRON_EXPRESSION = '0 * * * *';
let receiptReminderTask: ScheduledTask | null = null;

export function startWithdrawalsCron(app: FastifyInstance): void {
  receiptReminderTask = cron.schedule(
    RECEIPT_REMINDER_CRON_EXPRESSION,
    async () => {
      app.log.info('Running scheduled missing-receipt reminder check');
      try {
        const count = await sendMissingReceiptReminders();
        app.log.info({ count }, 'Missing-receipt reminder check completed');
      } catch (error) {
        app.log.error({ err: error }, 'Missing-receipt reminder check failed');
      }
    },
    { name: 'withdrawal-receipt-reminders', timezone: 'UTC', noOverlap: true }
  );
}

export function stopWithdrawalsCron(): void {
  receiptReminderTask?.stop();
  receiptReminderTask = null;
}
