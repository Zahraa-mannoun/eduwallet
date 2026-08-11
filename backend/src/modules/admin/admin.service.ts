import type {
  AcademicDocument,
  AdminAuditLog,
  FraudAlert,
  ParentalControl,
  Prisma,
  Transaction,
  Wallet,
} from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { toSafeUser } from '../auth/auth.types';
import type { SafeUser } from '../auth/auth.types';
import { createNotification } from '../notifications/notifications.service';
import type {
  AddFundsInput,
  GetAllTransactionsInput,
  GetUsersInput,
} from './admin.schema';

const transactionPartyInclude = {
  fromWallet: { include: { user: { select: { id: true, fullName: true, email: true, userType: true } } } },
  toWallet: { include: { user: { select: { id: true, fullName: true, email: true, userType: true } } } },
} satisfies Prisma.TransactionInclude;

export type TransactionWithParties = Transaction & {
  fromWallet: (Wallet & { user: { id: string; fullName: string; email: string; userType: string } }) | null;
  toWallet: (Wallet & { user: { id: string; fullName: string; email: string; userType: string } }) | null;
};

async function logAdminAction(
  adminId: string,
  action: string,
  targetId?: string,
  details?: string
): Promise<void> {
  await prisma.adminAuditLog.create({
    data: { adminId, action, targetId, details },
  });
}

export async function getUsers(filters: GetUsersInput): Promise<{
  users: (SafeUser & {
    wallets: Wallet[];
    linkedStudentsCount?: number;
    disbursementsCount?: number;
    hasDocuments?: boolean;
    hasSupportMessage: boolean;
  })[];
  total: number;
  page: number;
  limit: number;
}> {
  const where: Prisma.UserWhereInput = {
    ...(filters.userType ? { userType: filters.userType } : {}),
    ...(filters.kycStatus ? { kycStatus: filters.kycStatus } : {}),
    ...(filters.search
      ? {
          OR: [
            { fullName: { contains: filters.search, mode: 'insensitive' } },
            { email: { contains: filters.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [usersWithWallets, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { wallets: true },
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.user.count({ where }),
  ]);

  const userIds = usersWithWallets.map((user) => user.id);

  let linkedStudentsCountByParent = new Map<string, number>();
  if (filters.userType === 'PARENT' && userIds.length > 0) {
    const grouped = await prisma.parentalControl.groupBy({
      by: ['parentUserId'],
      where: { parentUserId: { in: userIds } },
      _count: true,
    });
    linkedStudentsCountByParent = new Map(grouped.map((row) => [row.parentUserId, row._count]));
  }

  let disbursementsCountByInstitution = new Map<string, number>();
  if (filters.userType === 'INSTITUTION' && userIds.length > 0) {
    const wallets = await prisma.wallet.findMany({
      where: { userId: { in: userIds } },
      select: { id: true, userId: true },
    });
    const walletToUser = new Map(wallets.map((wallet) => [wallet.id, wallet.userId]));
    const grouped = await prisma.transaction.groupBy({
      by: ['fromWalletId'],
      where: { fromWalletId: { in: wallets.map((wallet) => wallet.id) } },
      _count: true,
    });
    for (const row of grouped) {
      if (!row.fromWalletId) continue;
      const userId = walletToUser.get(row.fromWalletId);
      if (!userId) continue;
      disbursementsCountByInstitution.set(
        userId,
        (disbursementsCountByInstitution.get(userId) ?? 0) + row._count
      );
    }
  }

  let studentIdsWithDocuments = new Set<string>();
  if (filters.userType === 'STUDENT' && userIds.length > 0) {
    const documentOwners = await prisma.academicDocument.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true },
      distinct: ['userId'],
    });
    studentIdsWithDocuments = new Set(documentOwners.map((doc) => doc.userId));
  }

  // Drives the 💬 icon next to a suspended user's name (Students/Parents/Institutions
  // pages) — only ever meaningful for suspended users, so skip the query otherwise.
  let userIdsWithSupportMessages = new Set<string>();
  const suspendedUserIds = usersWithWallets.filter((user) => user.suspended).map((user) => user.id);
  if (suspendedUserIds.length > 0) {
    const messageOwners = await prisma.supportMessage.findMany({
      where: { userId: { in: suspendedUserIds } },
      select: { userId: true },
      distinct: ['userId'],
    });
    userIdsWithSupportMessages = new Set(messageOwners.map((message) => message.userId));
  }

  const users = usersWithWallets.map((userWithWallets) => {
    const { wallets, ...user } = userWithWallets;
    return {
      ...toSafeUser(user),
      wallets,
      hasSupportMessage: userIdsWithSupportMessages.has(user.id),
      ...(filters.userType === 'PARENT'
        ? { linkedStudentsCount: linkedStudentsCountByParent.get(user.id) ?? 0 }
        : {}),
      ...(filters.userType === 'INSTITUTION'
        ? { disbursementsCount: disbursementsCountByInstitution.get(user.id) ?? 0 }
        : {}),
      ...(filters.userType === 'STUDENT'
        ? { hasDocuments: studentIdsWithDocuments.has(user.id) }
        : {}),
    };
  });

  return { users, total, page: filters.page, limit: filters.limit };
}

export async function getUserById(userId: string): Promise<{
  user: SafeUser;
  wallets: Wallet[];
  transactionsCount: number;
  kycDocuments: AcademicDocument[];
}> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const wallets = await prisma.wallet.findMany({ where: { userId } });
  const walletIds = wallets.map((wallet) => wallet.id);

  const transactionsCount = await prisma.transaction.count({
    where: { OR: [{ fromWalletId: { in: walletIds } }, { toWalletId: { in: walletIds } }] },
  });

  const kycDocuments = await prisma.academicDocument.findMany({ where: { userId } });

  return { user: toSafeUser(user), wallets, transactionsCount, kycDocuments };
}

export async function suspendUser(
  adminId: string,
  userId: string,
  reason: string
): Promise<SafeUser> {
  if (adminId === userId) {
    throw new AppError(400, 'CANNOT_SUSPEND_SELF', 'You cannot suspend your own account');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { suspended: true, suspensionReason: reason },
  });

  await createNotification(
    userId,
    'Account Suspended',
    `Your account has been suspended: ${reason}`,
    'ACCOUNT_SUSPENDED'
  );

  await logAdminAction(adminId, 'SUSPEND_USER', userId, reason);

  return toSafeUser(updated);
}

export async function unsuspendUser(adminId: string, userId: string): Promise<SafeUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { suspended: false, suspensionReason: null },
  });

  await createNotification(
    userId,
    'Account Reactivated',
    'Your account has been reactivated.',
    'ACCOUNT_REACTIVATED'
  );

  await logAdminAction(adminId, 'UNSUSPEND_USER', userId);

  return toSafeUser(updated);
}

export async function getAllTransactions(filters: GetAllTransactionsInput): Promise<{
  transactions: (TransactionWithParties & { fraudAlerts: FraudAlert[] })[];
  total: number;
  page: number;
  limit: number;
}> {
  const where: Prisma.TransactionWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.flagged !== undefined
      ? { fraudAlerts: filters.flagged ? { some: {} } : { none: {} } }
      : {}),
  };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { ...transactionPartyInclude, fraudAlerts: true },
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return { transactions, total, page: filters.page, limit: filters.limit };
}

export async function getFraudAlerts(
  resolved?: boolean
): Promise<(FraudAlert & { transaction: TransactionWithParties })[]> {
  return prisma.fraudAlert.findMany({
    // undefined = "All" tab, no filter at all — must NOT collapse to { resolved: false }
    // or a resolved alert disappears from the table entirely instead of showing Resolved.
    where: resolved === undefined ? {} : { resolved },
    include: { transaction: { include: transactionPartyInclude } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function addFunds(
  adminId: string,
  userId: string,
  input: AddFundsInput
): Promise<Wallet> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  // Students only ever receive money through the funding flows that actually enforce
  // education-locking and parental oversight (parent transfers, institution scholarships,
  // agent withdrawals) — a raw admin top-up would hand a student unlocked, unaccounted-for
  // cash outside all of that, so it's restricted to PARENT and INSTITUTION wallets only.
  if (user.userType !== 'PARENT' && user.userType !== 'INSTITUTION') {
    throw new AppError(
      400,
      'INVALID_TOPUP_TARGET',
      'Admin can only top up Parent or Institution wallets.'
    );
  }

  const wallet = await prisma.wallet.upsert({
    where: { userId_currency: { userId, currency: input.currency } },
    create: { userId, currency: input.currency, balance: input.amount },
    update: { balance: { increment: input.amount } },
  });

  await prisma.transaction.create({
    data: {
      toWalletId: wallet.id,
      amount: input.amount,
      currency: input.currency,
      category: 'GENERAL',
      status: 'AUTO_APPROVED',
      note: 'Admin added funds',
    },
  });

  await createNotification(
    userId,
    'Funds Added',
    `Admin added ${input.amount} ${input.currency} to your wallet.`,
    'ADMIN_ADD_FUNDS'
  );

  await logAdminAction(adminId, 'ADD_FUNDS', userId, `${input.amount} ${input.currency}`);

  return wallet;
}

export type RelationshipRow = ParentalControl & {
  parent: { id: string; fullName: string; email: string };
  student: { id: string; fullName: string; email: string };
  pendingApprovalsCount: number;
};

export async function getRelationships(): Promise<RelationshipRow[]> {
  const links = await prisma.parentalControl.findMany({
    include: {
      parent: { select: { id: true, fullName: true, email: true } },
      student: { select: { id: true, fullName: true, email: true } },
    },
    orderBy: { id: 'asc' },
  });

  if (links.length === 0) {
    return [];
  }

  const studentIds = [...new Set(links.map((link) => link.studentUserId))];
  const wallets = await prisma.wallet.findMany({
    where: { userId: { in: studentIds } },
    select: { id: true, userId: true },
  });

  const pendingByWallet = await prisma.transaction.groupBy({
    by: ['fromWalletId'],
    where: { fromWalletId: { in: wallets.map((wallet) => wallet.id) }, status: 'PENDING' },
    _count: true,
  });
  const pendingCountByWalletId = new Map(
    pendingByWallet.map((row) => [row.fromWalletId, row._count])
  );

  const pendingCountByStudentId = new Map<string, number>();
  for (const wallet of wallets) {
    const count = pendingCountByWalletId.get(wallet.id) ?? 0;
    pendingCountByStudentId.set(wallet.userId, (pendingCountByStudentId.get(wallet.userId) ?? 0) + count);
  }

  return links.map((link) => ({
    ...link,
    pendingApprovalsCount: pendingCountByStudentId.get(link.studentUserId) ?? 0,
  }));
}

export async function resolveFraudAlert(
  adminId: string,
  alertId: string,
  note: string
): Promise<FraudAlert> {
  const alert = await prisma.fraudAlert.findUnique({ where: { id: alertId } });
  if (!alert) {
    throw new AppError(404, 'FRAUD_ALERT_NOT_FOUND', 'Fraud alert not found');
  }
  if (alert.resolved) {
    throw new AppError(400, 'ALREADY_RESOLVED', 'This fraud alert has already been resolved');
  }

  const updated = await prisma.fraudAlert.update({
    where: { id: alertId },
    data: { resolved: true, resolutionNote: note },
  });

  await logAdminAction(adminId, 'RESOLVE_FRAUD_ALERT', alertId, note);

  return updated;
}

export type SystemStats = {
  users: {
    total: number;
    byType: Record<string, number>;
    studentCount: number;
    parentCount: number;
    institutionCount: number;
  };
  transactions: { total: number; byStatus: Record<string, number>; totalVolume: number };
  fraudAlerts: { active: number };
  kyc: { pending: number };
  wallets: { total: number; balanceByCurrency: Record<string, number> };
  withdrawals: { totalCompleted: number };
  reportRequests: { pending: number };
  emailChangeRequests: { pending: number };
  personalSavings: { totalBalance: number };
  scholarships: { totalThisMonth: number };
};

function getCurrentMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

export async function getSystemStats(): Promise<SystemStats> {
  const [usersByType, totalUsers, transactionsByStatus, totalTransactions, volumeResult] =
    await Promise.all([
      prisma.user.groupBy({ by: ['userType'], _count: true }),
      prisma.user.count(),
      prisma.transaction.groupBy({ by: ['status'], _count: true }),
      prisma.transaction.count(),
      prisma.transaction.aggregate({
        where: { status: { in: ['AUTO_APPROVED', 'APPROVED'] } },
        _sum: { amount: true },
      }),
    ]);

  const [activeFraudAlerts, pendingKYC, walletsByCurrency, totalWallets] = await Promise.all([
    prisma.fraudAlert.count({ where: { resolved: false } }),
    prisma.user.count({
      where: { userType: 'STUDENT', kycStatus: 'PENDING', academicDocuments: { some: {} } },
    }),
    prisma.wallet.groupBy({ by: ['currency'], _sum: { balance: true } }),
    prisma.wallet.count(),
  ]);

  const { start: monthStart, end: monthEnd } = getCurrentMonthRange();

  const [
    totalCompletedWithdrawals,
    pendingReportRequests,
    pendingEmailChangeRequests,
    personalSavingsSum,
    scholarshipsThisMonth,
  ] = await Promise.all([
    prisma.withdrawalRequest.count({ where: { status: 'COMPLETED' } }),
    prisma.reportRequest.count({ where: { status: 'PENDING' } }),
    prisma.emailChangeRequest.count({ where: { status: 'PENDING' } }),
    prisma.personalSavings.aggregate({ _sum: { balance: true } }),
    prisma.transaction.aggregate({
      where: {
        status: { in: ['AUTO_APPROVED', 'APPROVED'] },
        fromWallet: { user: { userType: 'INSTITUTION' } },
        createdAt: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amount: true },
    }),
  ]);

  const byType = Object.fromEntries(usersByType.map((row) => [row.userType, row._count]));

  return {
    users: {
      total: totalUsers,
      byType,
      studentCount: byType.STUDENT ?? 0,
      parentCount: byType.PARENT ?? 0,
      institutionCount: byType.INSTITUTION ?? 0,
    },
    transactions: {
      total: totalTransactions,
      byStatus: Object.fromEntries(transactionsByStatus.map((row) => [row.status, row._count])),
      totalVolume: Number(volumeResult._sum.amount ?? 0),
    },
    fraudAlerts: { active: activeFraudAlerts },
    kyc: { pending: pendingKYC },
    wallets: {
      total: totalWallets,
      balanceByCurrency: Object.fromEntries(
        walletsByCurrency.map((row) => [row.currency, Number(row._sum.balance ?? 0)])
      ),
    },
    withdrawals: { totalCompleted: totalCompletedWithdrawals },
    reportRequests: { pending: pendingReportRequests },
    emailChangeRequests: { pending: pendingEmailChangeRequests },
    personalSavings: { totalBalance: Number(personalSavingsSum._sum.balance ?? 0) },
    scholarships: { totalThisMonth: Number(scholarshipsThisMonth._sum.amount ?? 0) },
  };
}

export type AnalyticsResult = {
  spending: {
    byCategory: Array<{ category: string; total: number }>;
    dailyVolume: Array<{ date: string; total: number }>;
  };
  funding: {
    byCategory: Array<{ category: string; total: number }>;
  };
  withdrawals: {
    byCategory: Array<{ category: string; total: number }>;
    totalThisMonth: number;
    verificationSuccessRate: number;
  };
  scholarships: {
    byCategory: Array<{ category: string; total: number }>;
    totalInstitutions: number;
    totalAllTime: number;
    fullCount: number;
    partialCount: number;
  };
  savings: {
    monthlyTrend: Array<{ month: string; total: number }>;
    totalBalance: number;
    averagePerStudent: number;
    pendingWithdrawals: number;
  };
  fraud: {
    byType: Array<{ type: string; count: number }>;
    total: number;
    resolved: number;
    resolutionRate: number;
    mostCommon: string | null;
  };
};

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getAnalytics(): Promise<AnalyticsResult> {
  const { start: monthStart, end: monthEnd } = getCurrentMonthRange();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  // --- Spending analytics ---
  // Real spending is money LEAVING the system entirely — a card payment (incl. QR, which
  // pays through the same /cards/use path) or a cash withdrawal, both of which have no
  // toWalletId since the recipient (a merchant, or "cash in hand") isn't a wallet at all.
  // A wallet-to-wallet transfer (toWalletId set) is money still inside the platform — a
  // parent/institution funding transfer, or P2P — never spending, and previously got swept
  // into this same total by mistake (see `funding` below for the split-out side).
  const [spendingByCategory, spendingTransactions] = await Promise.all([
    prisma.transaction.groupBy({
      by: ['category'],
      where: {
        status: { in: ['AUTO_APPROVED', 'APPROVED'] },
        fromWalletId: { not: null },
        toWalletId: null,
        createdAt: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amount: true },
    }),
    prisma.transaction.findMany({
      where: {
        status: { in: ['AUTO_APPROVED', 'APPROVED'] },
        fromWalletId: { not: null },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { amount: true, createdAt: true },
    }),
  ]);

  // --- Funding analytics ---
  // A parent locking money into a student's category, or an institution disbursing a
  // scholarship — both wallet-to-wallet transfers INTO a student, which is what was
  // incorrectly inflating "Total Spent per Category" above before the toWalletId split.
  const fundingByCategory = await prisma.transaction.groupBy({
    by: ['category'],
    where: {
      status: { in: ['AUTO_APPROVED', 'APPROVED'] },
      createdAt: { gte: monthStart, lt: monthEnd },
      fromWallet: { user: { userType: { in: ['PARENT', 'INSTITUTION'] } } },
      toWallet: { user: { userType: 'STUDENT' } },
    },
    _sum: { amount: true },
  });

  const dailyVolumeMap = new Map<string, number>();
  for (const tx of spendingTransactions) {
    const key = dateKey(tx.createdAt);
    dailyVolumeMap.set(key, (dailyVolumeMap.get(key) ?? 0) + Number(tx.amount));
  }
  const dailyVolume: Array<{ date: string; total: number }> = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    const key = dateKey(d);
    dailyVolume.push({ date: key, total: dailyVolumeMap.get(key) ?? 0 });
  }

  // --- Withdrawal analytics ---
  const [withdrawalsByCategory, withdrawalsThisMonth, withdrawalsWithReceipts, autoVerifiedWithdrawals] =
    await Promise.all([
      prisma.withdrawalRequest.groupBy({
        by: ['category'],
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      prisma.withdrawalRequest.aggregate({
        where: { status: 'COMPLETED', completedAt: { gte: monthStart, lt: monthEnd } },
        _sum: { amount: true },
      }),
      prisma.withdrawalRequest.count({ where: { receiptPath: { not: null } } }),
      prisma.withdrawalRequest.count({
        where: { receiptPath: { not: null }, receiptVerificationStatus: 'AUTO_VERIFIED' },
      }),
    ]);

  // --- Scholarship analytics ---
  const [scholarshipsByCategory, totalInstitutions, scholarshipsAllTime, universityStudents] =
    await Promise.all([
      prisma.transaction.groupBy({
        by: ['category'],
        where: {
          status: { in: ['AUTO_APPROVED', 'APPROVED'] },
          fromWallet: { user: { userType: 'INSTITUTION' } },
        },
        _sum: { amount: true },
      }),
      prisma.user.count({ where: { userType: 'INSTITUTION' } }),
      prisma.transaction.aggregate({
        where: {
          status: { in: ['AUTO_APPROVED', 'APPROVED'] },
          fromWallet: { user: { userType: 'INSTITUTION' } },
        },
        _sum: { amount: true },
      }),
      prisma.universityStudent.findMany({
        where: { userId: { not: null } },
        select: { userId: true, totalCreditCost: true },
      }),
    ]);

  let fullCount = 0;
  let partialCount = 0;
  if (universityStudents.length > 0) {
    const studentUserIds = universityStudents
      .map((s) => s.userId)
      .filter((id): id is string => id !== null);
    const wallets = await prisma.wallet.findMany({
      where: { userId: { in: studentUserIds } },
      select: { id: true, userId: true },
    });
    const walletIdsByUser = new Map<string, string[]>();
    for (const wallet of wallets) {
      const list = walletIdsByUser.get(wallet.userId) ?? [];
      list.push(wallet.id);
      walletIdsByUser.set(wallet.userId, list);
    }
    const allWalletIds = wallets.map((w) => w.id);
    const receivedByWallet = await prisma.transaction.groupBy({
      by: ['toWalletId'],
      where: {
        toWalletId: { in: allWalletIds },
        status: { in: ['AUTO_APPROVED', 'APPROVED'] },
        fromWallet: { user: { userType: 'INSTITUTION' } },
      },
      _sum: { amount: true },
    });
    const receivedByWalletId = new Map(
      receivedByWallet.map((row) => [row.toWalletId, Number(row._sum.amount ?? 0)])
    );

    for (const student of universityStudents) {
      if (!student.userId) continue;
      const walletIds = walletIdsByUser.get(student.userId) ?? [];
      const received = walletIds.reduce((sum, id) => sum + (receivedByWalletId.get(id) ?? 0), 0);
      if (received <= 0) continue;
      if (received >= Number(student.totalCreditCost)) {
        fullCount++;
      } else {
        partialCount++;
      }
    }
  }

  // --- Savings analytics ---
  const [monthlyTrendRaw, savingsSum, studentSavingsCount, pendingWithdrawalRequests] =
    await Promise.all([
      prisma.personalSavingsHistory.groupBy({
        by: ['month'],
        where: { type: 'ROLLOVER', month: { not: null } },
        _sum: { amount: true },
      }),
      prisma.personalSavings.aggregate({ _sum: { balance: true } }),
      prisma.personalSavings.count(),
      prisma.withdrawalRequest.count({
        where: { status: { in: ['PENDING', 'PENDING_PARENT_APPROVAL'] } },
      }),
    ]);

  const monthlyTrend = monthlyTrendRaw
    .filter((row): row is typeof row & { month: string } => row.month !== null)
    .map((row) => ({ month: row.month, total: Number(row._sum.amount ?? 0) }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // --- Fraud analytics ---
  const [fraudByType, totalFraud, resolvedFraud] = await Promise.all([
    prisma.fraudAlert.groupBy({ by: ['alertType'], _count: true }),
    prisma.fraudAlert.count(),
    prisma.fraudAlert.count({ where: { resolved: true } }),
  ]);

  const mostCommonFraud = fraudByType.reduce<{ type: string; count: number } | null>(
    (best, row) => (best === null || row._count > best.count ? { type: row.alertType, count: row._count } : best),
    null
  );

  return {
    spending: {
      byCategory: spendingByCategory.map((row) => ({
        category: row.category,
        total: Number(row._sum.amount ?? 0),
      })),
      dailyVolume,
    },
    funding: {
      byCategory: fundingByCategory.map((row) => ({
        category: row.category,
        total: Number(row._sum.amount ?? 0),
      })),
    },
    withdrawals: {
      byCategory: withdrawalsByCategory.map((row) => ({
        category: row.category,
        total: Number(row._sum.amount ?? 0),
      })),
      totalThisMonth: Number(withdrawalsThisMonth._sum.amount ?? 0),
      verificationSuccessRate:
        withdrawalsWithReceipts > 0 ? autoVerifiedWithdrawals / withdrawalsWithReceipts : 0,
    },
    scholarships: {
      byCategory: scholarshipsByCategory.map((row) => ({
        category: row.category,
        total: Number(row._sum.amount ?? 0),
      })),
      totalInstitutions,
      totalAllTime: Number(scholarshipsAllTime._sum.amount ?? 0),
      fullCount,
      partialCount,
    },
    savings: {
      monthlyTrend,
      totalBalance: Number(savingsSum._sum.balance ?? 0),
      averagePerStudent:
        studentSavingsCount > 0 ? Number(savingsSum._sum.balance ?? 0) / studentSavingsCount : 0,
      pendingWithdrawals: pendingWithdrawalRequests,
    },
    fraud: {
      byType: fraudByType.map((row) => ({ type: row.alertType, count: row._count })),
      total: totalFraud,
      resolved: resolvedFraud,
      resolutionRate: totalFraud > 0 ? resolvedFraud / totalFraud : 0,
      mostCommon: mostCommonFraud?.type ?? null,
    },
  };
}

export async function getAuditLog(): Promise<AdminAuditLog[]> {
  return prisma.adminAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}
