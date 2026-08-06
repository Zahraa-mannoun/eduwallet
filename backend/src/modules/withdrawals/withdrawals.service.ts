import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import type {
  ReceiptVerificationStatus,
  TransactionCategory,
  User,
  Wallet,
  WithdrawalRequest,
} from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { createNotification } from '../notifications/notifications.service';
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

// Student-facing history — completed withdrawals only. A GENERAL-over-threshold request
// still awaiting (or rejected by) the parent isn't "cash the student has received" yet, so
// it doesn't belong in this list; the parent-approval screens are where that state is visible.
export async function getWithdrawalsForStudent(studentUserId: string): Promise<WithdrawalRequest[]> {
  const wallet = await getPrimaryWallet(studentUserId);
  return prisma.withdrawalRequest.findMany({
    where: { walletId: wallet.id, status: 'COMPLETED' },
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

export type StudentLookup = {
  user: { id: string; fullName: string; email: string };
  wallet: { id: string; balance: string; currency: string };
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

  return {
    user: { id: user.id, fullName: user.fullName, email: user.email },
    wallet: { id: wallet.id, balance: formatMoney(wallet.balance), currency: wallet.currency },
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
async function disburse(
  adminUserId: string,
  wallet: Wallet,
  category: TransactionCategory,
  amount: number,
  existingRequestId?: string
): Promise<{ request: WithdrawalRequest; newBalance: string }> {
  const { request, newBalance } = await prisma.$transaction(async (tx) => {
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

    await tx.withdrawalHistory.create({
      data: {
        walletId: wallet.id,
        withdrawalRequestId: completedRequest.id,
        amount,
        category,
        receiptVerificationStatus: 'PENDING',
      },
    });

    const updatedWallet = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    return { request: completedRequest, newBalance: formatMoney(updatedWallet.balance) };
  });

  await createNotification(
    wallet.userId,
    'Cash Withdrawal',
    `You withdrew $${formatMoney(amount)} cash from ${category.toLowerCase()} at agent`,
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
  const wallet = await getPrimaryWallet(student.id);
  const parentalControl = await prisma.parentalControl.findFirst({
    where: { studentUserId: student.id },
  });

  if (input.category === 'GENERAL') {
    if (input.amount > Number(wallet.balance)) {
      throw new AppError(
        400,
        'INSUFFICIENT_BALANCE',
        'Withdrawal amount exceeds the student wallet balance'
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
        },
      });

      await createNotification(
        parentalControl.parentUserId,
        'Withdrawal Approval Needed',
        `${student.fullName} is requesting to withdraw $${formatMoney(input.amount)} cash at an agent. Your approval is needed.`,
        'WITHDRAWAL_APPROVAL_NEEDED'
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
    data: { status: 'APPROVED' },
  });

  await createNotification(
    wallet.userId,
    'Withdrawal Approved',
    `Your cash withdrawal request of $${formatMoney(request.amount)} has been approved. Visit an agent to collect your cash.`,
    'WITHDRAWAL_APPROVED'
  );

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

async function detectMerchant(
  text: string
): Promise<{ name: string; category: TransactionCategory } | null> {
  const lower = text.toLowerCase();
  const merchants = await prisma.merchant.findMany({ where: { isActive: true } });
  for (const merchant of merchants) {
    const nameWords = merchant.name.toLowerCase().split(/\s+/).filter((word) => word.length > 3);
    const matches =
      lower.includes(merchant.name.toLowerCase()) || nameWords.some((word) => lower.includes(word));
    if (matches) {
      return { name: merchant.name, category: merchant.category };
    }
  }
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

  const extractedText = [fileName, providedMerchantName ?? ''].join(' ').trim();
  const merchantMatch = extractedText ? await detectMerchant(extractedText) : null;
  const detectedCategory = merchantMatch?.category ?? (extractedText ? detectCategoryFromText(extractedText) : null);
  const merchantName = merchantMatch?.name ?? providedMerchantName ?? null;

  let receiptVerificationStatus: ReceiptVerificationStatus;
  let receiptVerificationNote: string | null = null;

  if (!detectedCategory) {
    receiptVerificationStatus = 'PENDING';
    receiptVerificationNote = 'No category could be detected from the receipt — manual review needed.';
  } else if (detectedCategory === request.category) {
    receiptVerificationStatus = 'AUTO_VERIFIED';
  } else {
    receiptVerificationStatus = 'FLAGGED';
    receiptVerificationNote = `Receipt appears to be for ${detectedCategory.toLowerCase()}, but the withdrawal was declared as ${request.category.toLowerCase()}.`;
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

  await prisma.withdrawalHistory.updateMany({
    where: { withdrawalRequestId: request.id },
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
        `${student?.fullName ?? 'Your child'}'s receipt for a $${formatMoney(request.amount)} ${request.category.toLowerCase()} withdrawal looks like it was actually spent on ${detectedCategory?.toLowerCase() ?? 'something else'}${merchantName ? ` at ${merchantName}` : ''}. Please review.`,
        'WITHDRAWAL_RECEIPT_FLAGGED'
      );
    }
  }

  return updated;
}
