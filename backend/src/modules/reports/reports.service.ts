import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import type { FraudAlert, Prisma, ReportRequest, UserType } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { createNotification } from '../notifications/notifications.service';
import type { TransactionWithParties } from '../admin/admin.service';
import type { CreateReportRequestInput } from './reports.schema';
import { generateReportBuffer } from './reports.pdf';
import type { LockedFundBreakdownRow, ReportData } from './reports.pdf';

// backend/src/modules/reports -> backend (three levels up), same resolution used by
// kyc.service.ts's UPLOADS_ROOT and withdrawals.service.ts's UPLOADS_ROOT.
const BACKEND_ROOT = path.resolve(__dirname, '..', '..', '..');
const UPLOADS_ROOT = path.join(BACKEND_ROOT, 'uploads', 'reports');

const transactionPartyInclude = {
  fromWallet: { include: { user: { select: { id: true, fullName: true, email: true, userType: true } } } },
  toWallet: { include: { user: { select: { id: true, fullName: true, email: true, userType: true } } } },
} satisfies Prisma.TransactionInclude;

export type ReportRequestRow = ReportRequest & {
  parent: { id: string; fullName: string; email: string };
  student: { id: string; fullName: string; email: string };
};

const reportRequestInclude = {
  parent: { select: { id: true, fullName: true, email: true } },
  student: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.ReportRequestInclude;

function periodToStartDate(period: ReportRequest['period']): Date {
  const now = new Date();
  const start = new Date(now);
  switch (period) {
    case 'LAST_WEEK':
      start.setDate(start.getDate() - 7);
      break;
    case 'LAST_MONTH':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'LAST_YEAR':
      start.setFullYear(start.getFullYear() - 1);
      break;
    case 'LAST_2_YEARS':
      start.setFullYear(start.getFullYear() - 2);
      break;
  }
  return start;
}

async function ensureParentLink(parentUserId: string, studentUserId: string): Promise<void> {
  const link = await prisma.parentalControl.findUnique({
    where: { parentUserId_studentUserId: { parentUserId, studentUserId } },
  });
  if (!link) {
    throw new AppError(403, 'NOT_LINKED', 'This student is not linked to your account');
  }
}

export async function requestReport(
  parentUserId: string,
  input: CreateReportRequestInput
): Promise<ReportRequestRow> {
  await ensureParentLink(parentUserId, input.studentUserId);

  const [parent, student] = await Promise.all([
    prisma.user.findUnique({ where: { id: parentUserId }, select: { fullName: true } }),
    prisma.user.findUnique({ where: { id: input.studentUserId }, select: { fullName: true } }),
  ]);
  if (!parent || !student) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const reportRequest = await prisma.reportRequest.create({
    data: {
      parentUserId,
      studentUserId: input.studentUserId,
      period: input.period,
      includeCardPurchases: input.includeCardPurchases,
      includeTransfers: input.includeTransfers,
      includeWithdrawals: input.includeWithdrawals,
      includeFlagged: input.includeFlagged,
      includePending: input.includePending,
      includeSavings: input.includeSavings,
    },
    include: reportRequestInclude,
  });

  const admins = await prisma.user.findMany({ where: { userType: 'ADMIN' }, select: { id: true } });
  await Promise.all(
    admins.map((admin) =>
      createNotification(
        admin.id,
        'History Report Requested',
        `Parent ${parent.fullName} has requested a history report for ${student.fullName}.`,
        'REPORT_REQUESTED'
      )
    )
  );

  return reportRequest;
}

export async function getMyReports(parentUserId: string): Promise<ReportRequestRow[]> {
  return prisma.reportRequest.findMany({
    where: { parentUserId },
    include: reportRequestInclude,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getAllReports(): Promise<ReportRequestRow[]> {
  return prisma.reportRequest.findMany({
    include: reportRequestInclude,
    orderBy: { createdAt: 'desc' },
  });
}

// ADMIN may preview any report as soon as it's GENERATED (that's the point of the preview
// step); PARENT may only download their own report, and only once it's been explicitly SENT —
// GENERATED-but-unsent is an admin-only preview state.
export async function getReportFile(
  requester: { id: string; userType: UserType },
  reportId: string
): Promise<{ reportRequest: ReportRequest; absolutePath: string }> {
  const reportRequest = await prisma.reportRequest.findUnique({ where: { id: reportId } });
  if (!reportRequest) {
    throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found');
  }

  if (requester.userType === 'ADMIN') {
    if (!reportRequest.pdfPath) {
      throw new AppError(400, 'REPORT_NOT_READY', 'This report has not been generated yet');
    }
  } else if (requester.userType === 'PARENT') {
    if (reportRequest.parentUserId !== requester.id) {
      throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found');
    }
    if (reportRequest.status !== 'SENT' || !reportRequest.pdfPath) {
      throw new AppError(400, 'REPORT_NOT_READY', 'This report has not been generated yet');
    }
  } else {
    throw new AppError(403, 'FORBIDDEN', 'You do not have access to this report');
  }

  const absolutePath = path.join(BACKEND_ROOT, reportRequest.pdfPath);
  try {
    await fs.access(absolutePath);
  } catch {
    throw new AppError(404, 'REPORT_FILE_MISSING', 'Report file not found on disk');
  }

  return { reportRequest, absolutePath };
}

function sumAmounts(amounts: Array<number | string | { toString(): string }>): number {
  return amounts.reduce<number>((sum, value) => sum + Number(value.toString()), 0);
}

// Aggregated across every wallet the student holds — mirrors how the rest of this function
// treats walletIds as "the student", never a single wallet in isolation.
async function getLockedFundsBreakdown(walletIds: string[]): Promise<LockedFundBreakdownRow[]> {
  const lockedFunds = await prisma.lockedFund.findMany({ where: { walletId: { in: walletIds } } });

  const byCategory = new Map<string, { totalReceived: number; remaining: number }>();
  for (const fund of lockedFunds) {
    const existing = byCategory.get(fund.category) ?? { totalReceived: 0, remaining: 0 };
    existing.totalReceived += Number(fund.totalLocked);
    existing.remaining += Number(fund.amount);
    byCategory.set(fund.category, existing);
  }

  return [...byCategory.entries()]
    .filter(([, totals]) => totals.totalReceived > 0)
    .map(([category, totals]) => {
      const totalSpent = Math.max(0, totals.totalReceived - totals.remaining);
      const status =
        totals.remaining <= 0
          ? 'FULLY_USED'
          : totals.remaining < totals.totalReceived
            ? 'PARTIALLY_USED'
            : 'UNUSED';
      return {
        category,
        totalReceived: totals.totalReceived,
        totalSpent,
        remaining: totals.remaining,
        status,
      };
    });
}

export async function generateReport(reportId: string): Promise<ReportRequest> {
  const reportRequest = await prisma.reportRequest.findUnique({
    where: { id: reportId },
    include: reportRequestInclude,
  });
  if (!reportRequest) {
    throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found');
  }
  if (reportRequest.status !== 'PENDING') {
    throw new AppError(400, 'REPORT_ALREADY_GENERATED', 'This report has already been generated');
  }

  const wallets = await prisma.wallet.findMany({
    where: { userId: reportRequest.studentUserId },
    select: { id: true },
  });
  const walletIds = wallets.map((wallet) => wallet.id);
  const start = periodToStartDate(reportRequest.period);

  const studentTouchesWallet: Prisma.TransactionWhereInput = {
    OR: [{ fromWalletId: { in: walletIds } }, { toWalletId: { in: walletIds } }],
    createdAt: { gte: start },
  };

  const universityStudent = await prisma.universityStudent.findFirst({
    where: { userId: reportRequest.studentUserId },
    include: { university: { select: { name: true } } },
  });

  const [cardPurchases, transfers, withdrawals, flagged, pending, savings, lockedFunds] = await Promise.all([
    reportRequest.includeCardPurchases
      ? prisma.cardHistory.findMany({
          where: { walletId: { in: walletIds }, usedAt: { gte: start } },
          orderBy: { usedAt: 'desc' },
        })
      : Promise.resolve(null),
    reportRequest.includeTransfers
      ? prisma.transaction.findMany({
          where: { ...studentTouchesWallet, toWalletId: { not: null } },
          include: transactionPartyInclude,
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve(null),
    reportRequest.includeWithdrawals
      ? prisma.withdrawalRequest.findMany({
          where: { walletId: { in: walletIds }, createdAt: { gte: start } },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve(null),
    reportRequest.includeFlagged
      ? prisma.transaction.findMany({
          where: { ...studentTouchesWallet, fraudAlerts: { some: {} } },
          include: { ...transactionPartyInclude, fraudAlerts: true },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve(null),
    reportRequest.includePending
      ? prisma.transaction.findMany({
          where: { ...studentTouchesWallet, status: 'PENDING' },
          include: transactionPartyInclude,
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve(null),
    reportRequest.includeSavings
      ? prisma.personalSavingsHistory.findMany({
          where: { walletId: { in: walletIds }, createdAt: { gte: start } },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve(null),
    getLockedFundsBreakdown(walletIds),
  ]);

  const byCategoryMap = new Map<string, number>();
  const addToCategory = (category: string, amount: number) => {
    byCategoryMap.set(category, (byCategoryMap.get(category) ?? 0) + amount);
  };

  const outgoingTransfers = (transfers ?? []).filter((tx) => walletIds.includes(tx.fromWalletId ?? ''));
  for (const entry of cardPurchases ?? []) {
    addToCategory(entry.categoryLock ?? 'GENERAL', Number(entry.amountPaid));
  }
  for (const tx of outgoingTransfers) {
    addToCategory(tx.category, Number(tx.amount));
  }
  for (const w of withdrawals ?? []) {
    addToCategory(w.category, Number(w.amount));
  }

  const totalSpent =
    sumAmounts((cardPurchases ?? []).map((entry) => entry.amountPaid)) +
    sumAmounts(outgoingTransfers.map((tx) => tx.amount));
  const totalWithdrawn = sumAmounts((withdrawals ?? []).map((w) => w.amount));
  const rolloverTotal = sumAmounts(
    (savings ?? []).filter((entry) => entry.type === 'ROLLOVER').map((entry) => entry.amount)
  );
  const withdrawnFromSavings = sumAmounts(
    (savings ?? [])
      .filter((entry) => entry.type === 'WITHDRAWAL_APPROVED')
      .map((entry) => entry.amount)
  );
  const totalSaved = rolloverTotal - withdrawnFromSavings;

  const reportData: ReportData = {
    studentName: reportRequest.student.fullName,
    studentEmail: reportRequest.student.email,
    parentName: reportRequest.parent.fullName,
    enrollmentNumber: universityStudent?.studentNumber ?? null,
    university: universityStudent?.university.name ?? null,
    period: reportRequest.period,
    generatedAt: new Date(),
    cardPurchases,
    transfers,
    withdrawals,
    flagged: flagged as (TransactionWithParties & { fraudAlerts: FraudAlert[] })[] | null,
    pending,
    savings,
    lockedFunds,
    summary: {
      byCategory: [...byCategoryMap.entries()].map(([category, total]) => ({ category, total })),
      totalSpent,
      totalWithdrawn,
      totalSaved,
    },
  };

  const pdfBuffer = await generateReportBuffer(reportData);

  await fs.mkdir(UPLOADS_ROOT, { recursive: true });
  const storedFileName = `${randomUUID()}.pdf`;
  const absoluteFilePath = path.join(UPLOADS_ROOT, storedFileName);
  await fs.writeFile(absoluteFilePath, pdfBuffer);
  const pdfPath = path.relative(BACKEND_ROOT, absoluteFilePath);

  // Status lands on GENERATED, not SENT — the PDF exists for admin preview only until
  // sendReportToParent() below is explicitly called, so the parent isn't notified yet.
  const updated = await prisma.reportRequest.update({
    where: { id: reportRequest.id },
    data: { status: 'GENERATED', pdfPath, generatedAt: new Date() },
  });

  return updated;
}

// Admin's confirmation after reviewing the PDF preview — only now does the parent learn the
// report exists and can download it (getReportFile below still enforces SENT for a PARENT
// requester even if this is somehow skipped).
export async function sendReportToParent(reportId: string): Promise<ReportRequest> {
  const reportRequest = await prisma.reportRequest.findUnique({ where: { id: reportId } });
  if (!reportRequest) {
    throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found');
  }
  if (reportRequest.status !== 'GENERATED') {
    throw new AppError(
      400,
      'REPORT_NOT_GENERATED',
      'This report must be generated and previewed before it can be sent'
    );
  }

  const updated = await prisma.reportRequest.update({
    where: { id: reportRequest.id },
    data: { status: 'SENT', sentAt: new Date() },
  });

  const student = await prisma.user.findUnique({
    where: { id: reportRequest.studentUserId },
    select: { fullName: true },
  });

  await createNotification(
    reportRequest.parentUserId,
    'Report Ready',
    `Your history report for ${student?.fullName ?? 'your student'} is ready to download.`,
    'REPORT_READY'
  );

  return updated;
}
