import type {
  AcademicDocument,
  AdminAuditLog,
  FraudAlert,
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
  GetAllTransactionsInput,
  GetUsersInput,
} from './admin.schema';

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
  transactions: (Transaction & { fraudAlerts: FraudAlert[] })[];
  total: number;
  page: number;
  limit: number;
}> {
  const where: Prisma.TransactionWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.flagged !== undefined
      ? { fraudAlerts: filters.flagged ? { some: {} } : { none: {} } }
      : {}),
  };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { fraudAlerts: true },
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
): Promise<(FraudAlert & { transaction: Transaction })[]> {
  return prisma.fraudAlert.findMany({
    where: { resolved },
    include: { transaction: true },
    orderBy: { createdAt: 'desc' },
  });
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
    data: { resolved: true },
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
