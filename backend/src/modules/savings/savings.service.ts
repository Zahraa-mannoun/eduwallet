import type { PersonalSavingsHistory, TransactionCategory, Wallet } from '@prisma/client';
import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { getCurrentMonth } from '../budget/budget.service';
import { createNotification } from '../notifications/notifications.service';
import type { RequestWithdrawalInput } from './savings.schema';

// Categories excluded from the "unspent locked funds" rollover sum — TUITION is essential/
// locked spending, not discretionary money to sweep into savings, and PERSONAL_SAVINGS would
// double-count money that's already been swept into savings by a prior rollover.
const ROLLOVER_EXCLUDED_CATEGORIES = new Set<TransactionCategory>(['TUITION', 'PERSONAL_SAVINGS']);
const ROLLOVER_EXCLUDED_CATEGORIES_LIST = [...ROLLOVER_EXCLUDED_CATEGORIES];

function formatMoney(amount: number | string | { toString(): string }): string {
  return Number(amount.toString()).toFixed(2);
}

function formatMonthLabel(month: string): string {
  const [year, monthNum] = month.split('-').map(Number);
  const date = new Date(year, (monthNum ?? 1) - 1, 1);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
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

async function getSavingsBalance(walletId: string): Promise<number> {
  const savings = await prisma.personalSavings.findUnique({ where: { walletId } });
  return savings ? Number(savings.balance) : 0;
}

async function notifyLinkedParents(studentUserId: string, title: string, message: string, type: string): Promise<void> {
  const links = await prisma.parentalControl.findMany({ where: { studentUserId } });
  await Promise.all(
    links.map((link) => createNotification(link.parentUserId, title, message, type))
  );
}

export type MySavings = {
  balance: string;
  history: PersonalSavingsHistory[];
};

export async function getMySavings(studentUserId: string): Promise<MySavings> {
  const wallet = await getPrimaryWallet(studentUserId);
  const [balance, history] = await Promise.all([
    getSavingsBalance(wallet.id),
    prisma.personalSavingsHistory.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return { balance: formatMoney(balance), history };
}

export async function requestWithdrawal(
  studentUserId: string,
  input: RequestWithdrawalInput
): Promise<PersonalSavingsHistory> {
  const wallet = await getPrimaryWallet(studentUserId);
  const balance = await getSavingsBalance(wallet.id);

  if (input.amount > balance) {
    throw new AppError(
      400,
      'INSUFFICIENT_SAVINGS_BALANCE',
      'Withdrawal amount exceeds your Personal Savings balance'
    );
  }

  const request = await prisma.personalSavingsHistory.create({
    data: {
      walletId: wallet.id,
      type: 'WITHDRAWAL_REQUEST',
      amount: input.amount,
      reason: input.reason,
      status: 'PENDING',
    },
  });

  const student = await prisma.user.findUnique({
    where: { id: studentUserId },
    select: { fullName: true },
  });

  await notifyLinkedParents(
    studentUserId,
    'Savings Withdrawal Request',
    `${student?.fullName ?? 'Your child'} is requesting to withdraw $${formatMoney(input.amount)} from Personal Savings. Reason: ${input.reason}`,
    'SAVINGS_WITHDRAWAL_REQUESTED'
  );

  return request;
}

export async function getWithdrawalRequests(parentUserId: string): Promise<PersonalSavingsHistory[]> {
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

  return prisma.personalSavingsHistory.findMany({
    where: { walletId: { in: walletIds }, type: 'WITHDRAWAL_REQUEST', status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });
}

async function getPendingWithdrawalRequestForParent(
  parentUserId: string,
  historyId: string
): Promise<{ request: PersonalSavingsHistory; wallet: Wallet }> {
  const request = await prisma.personalSavingsHistory.findUnique({ where: { id: historyId } });
  if (!request || request.type !== 'WITHDRAWAL_REQUEST') {
    throw new AppError(404, 'WITHDRAWAL_REQUEST_NOT_FOUND', 'Withdrawal request not found');
  }
  if (request.status !== 'PENDING') {
    throw new AppError(
      400,
      'WITHDRAWAL_REQUEST_NOT_PENDING',
      'This withdrawal request has already been resolved'
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

export async function approveWithdrawal(
  parentUserId: string,
  historyId: string
): Promise<PersonalSavingsHistory> {
  const { request, wallet } = await getPendingWithdrawalRequestForParent(parentUserId, historyId);

  const updated = await prisma.$transaction(async (tx) => {
    const debited = await tx.personalSavings.updateMany({
      where: { walletId: wallet.id, balance: { gte: request.amount } },
      data: { balance: { decrement: request.amount } },
    });
    if (debited.count === 0) {
      throw new AppError(
        400,
        'INSUFFICIENT_SAVINGS_BALANCE',
        'Student no longer has enough Personal Savings balance'
      );
    }

    return tx.personalSavingsHistory.update({
      where: { id: request.id },
      data: { status: 'APPROVED', type: 'WITHDRAWAL_APPROVED' },
    });
  });

  const parent = await prisma.user.findUnique({
    where: { id: parentUserId },
    select: { fullName: true },
  });

  await createNotification(
    wallet.userId,
    'Withdrawal Request Approved',
    `Your withdrawal request of $${formatMoney(request.amount)} has been approved by ${parent?.fullName ?? 'your parent'}`,
    'SAVINGS_WITHDRAWAL_APPROVED'
  );

  return updated;
}

export async function rejectWithdrawal(
  parentUserId: string,
  historyId: string,
  reason: string
): Promise<PersonalSavingsHistory> {
  const { request, wallet } = await getPendingWithdrawalRequestForParent(parentUserId, historyId);

  const updated = await prisma.personalSavingsHistory.update({
    where: { id: request.id },
    data: { status: 'REJECTED', type: 'WITHDRAWAL_REJECTED' },
  });

  await createNotification(
    wallet.userId,
    'Withdrawal Request Rejected',
    `Your withdrawal request of $${formatMoney(request.amount)} was rejected. Reason: ${reason}`,
    'SAVINGS_WITHDRAWAL_REJECTED'
  );

  return updated;
}

export type RolloverResult = {
  month: string;
  processed: Array<{ walletId: string; userId: string; amountSaved: string }>;
};

export async function runRollover(): Promise<RolloverResult> {
  const month = getCurrentMonth();
  const studentWallets = await prisma.wallet.findMany({
    where: { user: { userType: 'STUDENT' } },
  });

  const processed: RolloverResult['processed'] = [];

  for (const wallet of studentWallets) {
    const totalRolledOver = await prisma.$transaction(async (tx) => {
      // The actual remaining unspent money is the current LockedFund balance — not the
      // student's own BudgetCategory.monthlyLimit, which is an independent, self-set goal
      // that has nothing to do with how much locked money a parent actually sent. This sum
      // is only correct as long as every spend path against a locked category decrements
      // LockedFund.amount (see the field comment in schema.prisma) — that includes future
      // spend types (cash withdrawal, OCR merchant payments), not just the two paths that
      // exist today (cards.service.ts useCard(), wallet.service.ts transfer()).
      const lockedFunds = await tx.lockedFund.findMany({
        where: { walletId: wallet.id, category: { notIn: ROLLOVER_EXCLUDED_CATEGORIES_LIST } },
      });
      const totalUnspent = lockedFunds.reduce((sum, fund) => sum + Number(fund.amount), 0);

      const budgets = await tx.budgetCategory.findMany({
        where: { walletId: wallet.id, month },
      });

      if (budgets.length > 0) {
        await tx.monthlyBudgetHistory.createMany({
          data: budgets.map((budget) => ({
            walletId: wallet.id,
            category: budget.category,
            monthlyLimit: budget.monthlyLimit,
            totalSpent: budget.spent,
            month,
          })),
        });
        await tx.budgetCategory.deleteMany({ where: { walletId: wallet.id, month } });
      }

      if (totalUnspent > 0) {
        // Funds have been rolled over — zero out the remaining balance, but totalLocked
        // (the all-time total ever locked) is deliberately left untouched.
        await tx.lockedFund.updateMany({
          where: { walletId: wallet.id, category: { notIn: ROLLOVER_EXCLUDED_CATEGORIES_LIST } },
          data: { amount: 0 },
        });

        // The locked-fund balance being rolled over was still counted in Wallet.balance (locked
        // funds are a ring-fenced portion of the wallet, not a separate pot) — without this
        // decrement, the same money would exist in both Wallet.balance and
        // PersonalSavings.balance simultaneously.
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: totalUnspent } },
        });

        await tx.personalSavings.upsert({
          where: { walletId: wallet.id },
          create: { walletId: wallet.id, balance: totalUnspent },
          update: { balance: { increment: totalUnspent } },
        });
        await tx.personalSavingsHistory.create({
          data: {
            walletId: wallet.id,
            type: 'ROLLOVER',
            amount: totalUnspent,
            month,
            status: 'APPROVED',
          },
        });
      }

      return totalUnspent;
    });

    if (totalRolledOver > 0) {
      const student = await prisma.user.findUnique({
        where: { id: wallet.userId },
        select: { fullName: true },
      });
      const monthLabel = formatMonthLabel(month);

      await createNotification(
        wallet.userId,
        'Personal Savings Updated',
        `Your $${formatMoney(totalRolledOver)} unspent funds from ${monthLabel} have been added to your Personal Savings`,
        'SAVINGS_ROLLOVER'
      );

      await notifyLinkedParents(
        wallet.userId,
        'Personal Savings Update',
        `${student?.fullName ?? 'Your child'} saved $${formatMoney(totalRolledOver)} this month in Personal Savings`,
        'SAVINGS_ROLLOVER'
      );

      processed.push({
        walletId: wallet.id,
        userId: wallet.userId,
        amountSaved: formatMoney(totalRolledOver),
      });
    }
  }

  return { month, processed };
}

// Minute Hour DayOfMonth Month DayOfWeek — "L" is node-cron's Quartz-style "last day of the
// month", so this fires once at 00:00 on whichever day that month's last day falls on. This
// calls the exact same runRollover() as POST /savings/rollover (admin manual trigger) —
// there is only one rollover implementation, just two ways to invoke it.
const MONTHLY_ROLLOVER_CRON_EXPRESSION = '0 0 L * *';

let rolloverTask: ScheduledTask | null = null;

export function startSavingsCron(app: FastifyInstance): void {
  rolloverTask = cron.schedule(
    MONTHLY_ROLLOVER_CRON_EXPRESSION,
    async () => {
      app.log.info('Running scheduled monthly Personal Savings rollover');
      try {
        const result = await runRollover();
        app.log.info({ result }, 'Monthly Personal Savings rollover completed');
      } catch (error) {
        app.log.error({ err: error }, 'Monthly Personal Savings rollover failed');
      }
    },
    { name: 'monthly-savings-rollover', timezone: 'UTC', noOverlap: true }
  );
}

export function stopSavingsCron(): void {
  rolloverTask?.stop();
  rolloverTask = null;
}
