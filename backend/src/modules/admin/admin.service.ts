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
  users: (SafeUser & { wallets: Wallet[] })[];
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

  const users = usersWithWallets.map((userWithWallets) => {
    const { wallets, ...user } = userWithWallets;
    return { ...toSafeUser(user), wallets };
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
    data: { suspended: true },
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
    data: { suspended: false },
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
  resolved: boolean
): Promise<(FraudAlert & { transaction: TransactionWithParties })[]> {
  return prisma.fraudAlert.findMany({
    where: { resolved },
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
  users: { total: number; byType: Record<string, number> };
  transactions: { total: number; byStatus: Record<string, number>; totalVolume: number };
  fraudAlerts: { active: number };
  kyc: { pending: number };
  wallets: { total: number; balanceByCurrency: Record<string, number> };
};

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
    prisma.user.count({ where: { kycStatus: 'PENDING' } }),
    prisma.wallet.groupBy({ by: ['currency'], _sum: { balance: true } }),
    prisma.wallet.count(),
  ]);

  return {
    users: {
      total: totalUsers,
      byType: Object.fromEntries(usersByType.map((row) => [row.userType, row._count])),
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
  };
}

export async function getAuditLog(): Promise<AdminAuditLog[]> {
  return prisma.adminAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}
