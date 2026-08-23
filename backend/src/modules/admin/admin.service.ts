import bcrypt from 'bcrypt';
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
import { revokeRefreshToken } from '../auth/auth.service';
import { toSafeUser } from '../auth/auth.types';
import type { SafeUser } from '../auth/auth.types';
import { createNotification } from '../notifications/notifications.service';
import type {
  AddFundsInput,
  CreateAgentInput,
  GetAllTransactionsInput,
  GetUsersInput,
} from './admin.schema';

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);

const transactionPartyInclude = {
  fromWallet: { include: { user: { select: { id: true, fullName: true, email: true, userType: true } } } },
  toWallet: { include: { user: { select: { id: true, fullName: true, email: true, userType: true } } } },
} satisfies Prisma.TransactionInclude;

export type TransactionWithParties = Transaction & {
  fromWallet: (Wallet & { user: { id: string; fullName: string; email: string; userType: string } }) | null;
  toWallet: (Wallet & { user: { id: string; fullName: string; email: string; userType: string } }) | null;
};

// A cash withdrawal only produces a real Transaction row once an agent actually dispenses it
// (disburse() in withdrawals.service.ts) — before that, while parked awaiting parent approval
// or agent action, there's nothing in the Transaction table for the admin view to show. This is
// the wire shape for that in-flight window: same fields as TransactionWithParties, but `status`
// also allows the one WithdrawalStatus value with no TransactionStatus equivalent. Every
// synthesized row is marked with receiverName 'Cash Withdrawal' — the same marker disburse()
// stamps on the real completed-withdrawal Transaction row, so the client can recognize "this is
// a cash withdrawal" uniformly regardless of which table it actually came from.
export type AdminTransactionRow = Omit<TransactionWithParties, 'status'> & {
  status: TransactionWithParties['status'] | 'PENDING_PARENT_APPROVAL';
  fraudAlerts: FraudAlert[];
};

// Withdrawal statuses that never gain a real Transaction row and so must be synthesized: still
// awaiting parent approval, approved but not yet dispensed by an agent, or rejected outright.
// Plain 'PENDING' (the schema default) is excluded — this codebase never actually leaves a
// withdrawal request in that state (see processWithdrawal/disburse in withdrawals.service.ts),
// it goes straight from "doesn't exist" to either COMPLETED or PENDING_PARENT_APPROVAL.
const IN_FLIGHT_WITHDRAWAL_STATUSES = ['PENDING_PARENT_APPROVAL', 'APPROVED', 'REJECTED'] as const;

export async function logAdminAction(
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
    hasResubmitted?: boolean;
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
  // Same "rejected, then uploaded something newer" definition as kyc.service.ts's
  // getPendingKYC() — a student only counts once they've actually resubmitted, not just
  // because they were rejected at some point.
  let studentIdsWithResubmission = new Set<string>();
  if (filters.userType === 'STUDENT' && userIds.length > 0) {
    const documentOwners = await prisma.academicDocument.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true },
      distinct: ['userId'],
    });
    studentIdsWithDocuments = new Set(documentOwners.map((doc) => doc.userId));

    const rejectedUsers = usersWithWallets.filter((user) => user.kycRejectedAt !== null);
    if (rejectedUsers.length > 0) {
      const rejectedAtByUserId = new Map(
        rejectedUsers.map((user) => [user.id, user.kycRejectedAt as Date])
      );
      const documentsForRejected = await prisma.academicDocument.findMany({
        where: { userId: { in: [...rejectedAtByUserId.keys()] } },
        select: { userId: true, createdAt: true },
      });
      for (const document of documentsForRejected) {
        const rejectedAt = rejectedAtByUserId.get(document.userId);
        if (rejectedAt && document.createdAt > rejectedAt) {
          studentIdsWithResubmission.add(document.userId);
        }
      }
    }
  }

  // Drives the 💬 icon next to a suspended user's name (Students/Parents/Institutions
  // pages) — only ever meaningful for suspended users, so skip the query otherwise. A user
  // suspended, unsuspended, then suspended again must not surface a message sent during the
  // PRIOR suspension cycle, so a message only counts if it's strictly newer than suspendedAt
  // (see suspendUser() above, which stamps suspendedAt fresh on every suspension).
  let userIdsWithSupportMessages = new Set<string>();
  const suspendedUsersById = new Map(
    usersWithWallets.filter((user) => user.suspended).map((user) => [user.id, user])
  );
  if (suspendedUsersById.size > 0) {
    const messages = await prisma.supportMessage.findMany({
      where: { userId: { in: [...suspendedUsersById.keys()] } },
      select: { userId: true, createdAt: true },
    });
    for (const message of messages) {
      const suspendedAt = suspendedUsersById.get(message.userId)?.suspendedAt;
      if (suspendedAt && new Date(message.createdAt) > new Date(suspendedAt)) {
        userIdsWithSupportMessages.add(message.userId);
      }
    }
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
        ? {
            hasDocuments: studentIdsWithDocuments.has(user.id),
            hasResubmitted: studentIdsWithResubmission.has(user.id),
          }
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
    data: { suspended: true, suspensionReason: reason, suspendedAt: new Date() },
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
    data: { suspended: false, suspensionReason: null, suspendedAt: null },
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
  transactions: AdminTransactionRow[];
  total: number;
  page: number;
  limit: number;
}> {
  // PENDING_PARENT_APPROVAL can never match a real Transaction row — skip that query entirely
  // rather than asking Prisma to filter TransactionStatus by a value it doesn't have.
  const skipRealTransactions = filters.status === 'PENDING_PARENT_APPROVAL';
  // COMPLETED has no TransactionStatus equivalent either — a completed cash withdrawal's real
  // Transaction row carries AUTO_APPROVED or APPROVED (see disburse()), identified as
  // "completed" only by receiverName + note. Filtering by literal status: 'COMPLETED' would
  // never match anything, so this asks for that marker combination instead.
  const isCompletedFilter = filters.status === 'COMPLETED';
  const realStatus =
    filters.status !== 'PENDING_PARENT_APPROVAL' && filters.status !== 'COMPLETED' ? filters.status : undefined;

  const where: Prisma.TransactionWhereInput = {
    ...(realStatus ? { status: realStatus } : {}),
    ...(isCompletedFilter ? { receiverName: 'Cash Withdrawal', note: 'Cash withdrawal' } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.flagged !== undefined
      ? { fraudAlerts: filters.flagged ? { some: {} } : { none: {} } }
      : {}),
  };

  // A flagged-only view can never include a withdrawal-derived row (they never go through
  // fraud.service, so they can never have a fraud alert to flag). A completed-only view never
  // includes one either — completed withdrawals are covered by the real Transaction row above.
  const withdrawalStatuses: readonly string[] = skipRealTransactions
    ? ['PENDING_PARENT_APPROVAL']
    : isCompletedFilter
      ? []
      : filters.status
        ? IN_FLIGHT_WITHDRAWAL_STATUSES.includes(filters.status as (typeof IN_FLIGHT_WITHDRAWAL_STATUSES)[number])
          ? [filters.status]
          : []
        : IN_FLIGHT_WITHDRAWAL_STATUSES;
  const includeWithdrawals =
    filters.page === 1 && filters.flagged !== true && withdrawalStatuses.length > 0;

  const [transactions, total, inFlightWithdrawals] = await Promise.all([
    skipRealTransactions
      ? Promise.resolve([])
      : prisma.transaction.findMany({
          where,
          include: { ...transactionPartyInclude, fraudAlerts: true },
          orderBy: { createdAt: 'desc' },
          skip: (filters.page - 1) * filters.limit,
          take: filters.limit,
        }),
    skipRealTransactions ? Promise.resolve(0) : prisma.transaction.count({ where }),
    includeWithdrawals
      ? prisma.withdrawalRequest.findMany({
          where: {
            status: { in: withdrawalStatuses as Prisma.EnumWithdrawalStatusFilter['in'] },
            ...(filters.category ? { category: filters.category } : {}),
          },
          include: { wallet: { include: { user: { select: { id: true, fullName: true, email: true, userType: true } } } } },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      : [],
  ]);

  const withdrawalEntries: AdminTransactionRow[] = inFlightWithdrawals.map((request) => ({
    id: request.id,
    fromWalletId: request.walletId,
    toWalletId: null,
    amount: request.amount,
    currency: request.wallet.currency,
    category: request.category,
    // Narrowed by the `where` filter above to PENDING_PARENT_APPROVAL | APPROVED | REJECTED.
    status: request.status as AdminTransactionRow['status'],
    note: null,
    receiverName: 'Cash Withdrawal',
    createdAt: request.createdAt,
    fromWallet: request.wallet,
    toWallet: null,
    fraudAlerts: [],
  }));

  const merged = [...transactions, ...withdrawalEntries].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  return {
    transactions: merged,
    total: total + withdrawalEntries.length,
    page: filters.page,
    limit: filters.limit,
  };
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
    agentCount: number;
    adminCount: number;
  };
  transactions: { total: number; byStatus: Record<string, number>; totalVolume: number };
  fraudAlerts: { active: number };
  kyc: { pending: number };
  wallets: { total: number; balanceByCurrency: Record<string, number> };
  withdrawals: { totalCompleted: number; today: number };
  reportRequests: { pending: number };
  emailChangeRequests: { pending: number };
  personalSavings: { totalBalance: number };
  scholarships: { totalThisMonth: number };
  agents: { active: number; suspended: number };
  agentMessages: { pending: number };
};

function getCurrentMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

function getTodayStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
  const todayStart = getTodayStart();

  const [
    totalCompletedWithdrawals,
    withdrawalsToday,
    pendingReportRequests,
    pendingEmailChangeRequests,
    personalSavingsSum,
    scholarshipsThisMonth,
    activeAgents,
    suspendedAgents,
    pendingAgentMessages,
  ] = await Promise.all([
    prisma.withdrawalRequest.count({ where: { status: 'COMPLETED' } }),
    prisma.withdrawalRequest.count({
      where: { status: 'COMPLETED', completedAt: { gte: todayStart } },
    }),
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
    prisma.user.count({ where: { userType: 'AGENT', suspended: false } }),
    prisma.user.count({ where: { userType: 'AGENT', suspended: true } }),
    prisma.supportMessage.count({ where: { type: 'AGENT_MESSAGE', status: 'UNREAD' } }),
  ]);

  const byType = Object.fromEntries(usersByType.map((row) => [row.userType, row._count]));

  return {
    users: {
      total: totalUsers,
      byType,
      studentCount: byType.STUDENT ?? 0,
      parentCount: byType.PARENT ?? 0,
      institutionCount: byType.INSTITUTION ?? 0,
      agentCount: byType.AGENT ?? 0,
      adminCount: byType.ADMIN ?? 0,
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
    withdrawals: { totalCompleted: totalCompletedWithdrawals, today: withdrawalsToday },
    reportRequests: { pending: pendingReportRequests },
    emailChangeRequests: { pending: pendingEmailChangeRequests },
    personalSavings: { totalBalance: Number(personalSavingsSum._sum.balance ?? 0) },
    scholarships: { totalThisMonth: Number(scholarshipsThisMonth._sum.amount ?? 0) },
    agents: { active: activeAgents, suspended: suspendedAgents },
    agentMessages: { pending: pendingAgentMessages },
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

export type AgentRow = SafeUser & { withdrawalsCount: number };

export async function createAgent(adminId: string, input: CreateAgentInput): Promise<SafeUser> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists');
  }

  const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);

  const agent = await prisma.user.create({
    data: {
      email: input.email,
      password: hashedPassword,
      fullName: input.fullName,
      userType: 'AGENT',
      wallets: { create: { balance: 0 } },
    },
  });

  await logAdminAction(adminId, 'CREATE_AGENT', agent.id, input.email);

  return toSafeUser(agent);
}

export async function getAgents(): Promise<AgentRow[]> {
  const agents = await prisma.user.findMany({
    where: { userType: 'AGENT' },
    orderBy: { createdAt: 'desc' },
  });

  const agentIds = agents.map((agent) => agent.id);
  const grouped =
    agentIds.length > 0
      ? await prisma.withdrawalRequest.groupBy({
          by: ['agentId'],
          where: { agentId: { in: agentIds } },
          _count: true,
        })
      : [];
  const withdrawalsCountByAgentId = new Map(grouped.map((row) => [row.agentId, row._count]));

  return agents.map((agent) => ({
    ...toSafeUser(agent),
    withdrawalsCount: withdrawalsCountByAgentId.get(agent.id) ?? 0,
  }));
}

export async function deactivateAgent(
  adminId: string,
  agentId: string,
  reason: string
): Promise<SafeUser> {
  const agent = await prisma.user.findUnique({ where: { id: agentId } });
  if (!agent || agent.userType !== 'AGENT') {
    throw new AppError(404, 'AGENT_NOT_FOUND', 'Agent not found');
  }

  const updated = await prisma.user.update({
    where: { id: agentId },
    data: { suspended: true, suspensionReason: reason, suspendedAt: new Date() },
  });

  // Kills their refresh token immediately (blocks /auth/refresh once the short-lived access
  // token expires) — and if they're actively using the portal, authenticate() below rejects
  // their very next request with ACCOUNT_SUSPENDED anyway since it re-reads `suspended` from
  // the DB on every call, so in practice this logs them out within seconds, not 15 minutes.
  await revokeRefreshToken(agentId);

  await logAdminAction(adminId, 'DEACTIVATE_AGENT', agentId, reason);

  return toSafeUser(updated);
}

export async function sendAgentNotification(
  adminId: string,
  agentId: string,
  message: string
): Promise<void> {
  const agent = await prisma.user.findUnique({ where: { id: agentId } });
  if (!agent || agent.userType !== 'AGENT') {
    throw new AppError(404, 'AGENT_NOT_FOUND', 'Agent not found');
  }

  await createNotification(agentId, 'Message from Admin', message, 'ADMIN_MESSAGE');

  await logAdminAction(adminId, 'NOTIFY_AGENT', agentId, message);
}

export type RolloverHistoryRow = {
  month: string;
  studentCount: number;
  totalAmount: number;
  triggeredAt: string;
  students: Array<{
    id: string;
    name: string;
    email: string;
    amount: number;
    categories: Array<{ category: string; amount: number }>;
  }>;
};

export async function getRolloverHistory(): Promise<RolloverHistoryRow[]> {
  const rollovers = await prisma.personalSavingsHistory.findMany({
    where: { type: 'ROLLOVER' },
    include: {
      wallet: { include: { user: { select: { id: true, fullName: true, email: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // The monthly cron (and a manual admin trigger) processes every student wallet in one run, so
  // every row sharing a month came from the same rollover event — grouped here purely for
  // display, there's no Prisma-level grouping across a Json field and a join this shallow.
  const byMonth = new Map<string, typeof rollovers>();
  for (const entry of rollovers) {
    const key = entry.month ?? 'Unknown';
    const list = byMonth.get(key) ?? [];
    list.push(entry);
    byMonth.set(key, list);
  }

  const rows: RolloverHistoryRow[] = [...byMonth.entries()].map(([month, entries]) => {
    const students = entries.map((entry) => ({
      id: entry.wallet.user.id,
      name: entry.wallet.user.fullName,
      email: entry.wallet.user.email,
      amount: Number(entry.amount),
      categories: Object.entries(
        (entry.categoryBreakdown as Record<string, number> | null) ?? {}
      ).map(([category, amount]) => ({ category, amount: Number(amount) })),
    }));
    const triggeredAt = entries.reduce(
      (earliest, entry) => (entry.createdAt < earliest ? entry.createdAt : earliest),
      entries[0]!.createdAt
    );

    return {
      month,
      studentCount: students.length,
      totalAmount: students.reduce((sum, student) => sum + student.amount, 0),
      triggeredAt: triggeredAt.toISOString(),
      students,
    };
  });

  return rows.sort((a, b) => b.month.localeCompare(a.month));
}

export type LockedFundHistoryRow = {
  month: string;
  studentCount: number;
  totalLocked: number;
  totalSpent: number;
  totalRolledOver: number;
  archivedAt: string;
  students: Array<{
    id: string;
    name: string;
    email: string;
    totalLocked: number;
    totalSpent: number;
    rolledOver: number;
    categories: Array<{ category: string; totalLocked: number; totalSpent: number; rolledOver: number }>;
  }>;
};

// Unlike PersonalSavingsHistory's ROLLOVER rows (one per wallet per month), LockedFundHistory has
// one row per wallet PER CATEGORY per month — grouped by month, then by student, then listing
// each student's categories.
export async function getLockedFundHistory(): Promise<LockedFundHistoryRow[]> {
  const entries = await prisma.lockedFundHistory.findMany({
    include: {
      wallet: { include: { user: { select: { id: true, fullName: true, email: true } } } },
    },
    orderBy: { archivedAt: 'desc' },
  });

  const byMonth = new Map<string, typeof entries>();
  for (const entry of entries) {
    const list = byMonth.get(entry.month) ?? [];
    list.push(entry);
    byMonth.set(entry.month, list);
  }

  const rows: LockedFundHistoryRow[] = [...byMonth.entries()].map(([month, monthEntries]) => {
    const byWallet = new Map<string, typeof monthEntries>();
    for (const entry of monthEntries) {
      const list = byWallet.get(entry.walletId) ?? [];
      list.push(entry);
      byWallet.set(entry.walletId, list);
    }

    const students = [...byWallet.values()].map((walletEntries) => {
      const user = walletEntries[0]!.wallet.user;
      const categories = walletEntries.map((entry) => ({
        category: entry.category,
        totalLocked: Number(entry.totalLocked),
        totalSpent: Number(entry.totalSpent),
        rolledOver: Number(entry.rolledOver),
      }));
      return {
        id: user.id,
        name: user.fullName,
        email: user.email,
        totalLocked: categories.reduce((sum, c) => sum + c.totalLocked, 0),
        totalSpent: categories.reduce((sum, c) => sum + c.totalSpent, 0),
        rolledOver: categories.reduce((sum, c) => sum + c.rolledOver, 0),
        categories,
      };
    });

    const archivedAt = monthEntries.reduce(
      (earliest, entry) => (entry.archivedAt < earliest ? entry.archivedAt : earliest),
      monthEntries[0]!.archivedAt
    );

    return {
      month,
      studentCount: students.length,
      totalLocked: students.reduce((sum, s) => sum + s.totalLocked, 0),
      totalSpent: students.reduce((sum, s) => sum + s.totalSpent, 0),
      totalRolledOver: students.reduce((sum, s) => sum + s.rolledOver, 0),
      archivedAt: archivedAt.toISOString(),
      students,
    };
  });

  return rows.sort((a, b) => b.month.localeCompare(a.month));
}

export async function reactivateAgent(adminId: string, agentId: string): Promise<SafeUser> {
  const agent = await prisma.user.findUnique({ where: { id: agentId } });
  if (!agent || agent.userType !== 'AGENT') {
    throw new AppError(404, 'AGENT_NOT_FOUND', 'Agent not found');
  }

  const updated = await prisma.user.update({
    where: { id: agentId },
    data: { suspended: false, suspensionReason: null, suspendedAt: null },
  });

  await logAdminAction(adminId, 'REACTIVATE_AGENT', agentId);

  return toSafeUser(updated);
}
