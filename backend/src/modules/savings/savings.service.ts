import type { PersonalSavingsHistory, TransactionCategory, Wallet } from '@prisma/client';
import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { getCurrentMonth } from '../budget/budget.service';
import { createNotification } from '../notifications/notifications.service';
import { getSpentByCategory } from '../wallet/wallet.service';
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
      data: { status: 'APPROVED', type: 'WITHDRAWAL_APPROVED', approvedAt: new Date() },
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

export type AgentSavingsWithdrawalRow = {
  id: string;
  amount: string;
  reason: string | null;
  requestedAt: string;
  approvedAt: string | null;
  dispensedAt: string | null;
  agentId: string | null;
  student: { id: string; fullName: string; email: string };
};

const savingsWithdrawalStudentInclude = {
  wallet: { include: { user: { select: { id: true, fullName: true, email: true } as const } } },
} as const;

type SavingsWithdrawalWithStudent = PersonalSavingsHistory & {
  wallet: Wallet & { user: { id: string; fullName: string; email: string } };
};

function toAgentSavingsWithdrawalRow(row: SavingsWithdrawalWithStudent): AgentSavingsWithdrawalRow {
  return {
    id: row.id,
    amount: formatMoney(row.amount),
    reason: row.reason,
    requestedAt: row.createdAt.toISOString(),
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    dispensedAt: row.dispensedAt ? row.dispensedAt.toISOString() : null,
    agentId: row.agentId,
    student: row.wallet.user,
  };
}

// Every WITHDRAWAL_APPROVED row, dispensed or not — the agent portal's Savings Withdrawals page
// derives its Pending Dispense / Dispensed / All tabs from this one fetch (same pattern as every
// other tabbed list in this app) rather than three separate endpoints.
export async function getAgentSavingsWithdrawals(): Promise<AgentSavingsWithdrawalRow[]> {
  const rows = await prisma.personalSavingsHistory.findMany({
    where: { type: 'WITHDRAWAL_APPROVED' },
    include: savingsWithdrawalStudentInclude,
    orderBy: { approvedAt: 'desc' },
  });
  return rows.map(toAgentSavingsWithdrawalRow);
}

// The agent's confirmation that cash was physically handed over — PersonalSavings.balance was
// already decremented when the parent approved this request (see approveWithdrawal() above), so
// this does not touch the balance again, and there is no receipt step: unlike a locked-category
// cash withdrawal, this money already left a category-agnostic Personal Savings pot the parent
// explicitly signed off on, so there's no spend category left to verify against.
export async function dispenseSavingsWithdrawal(
  agentId: string,
  historyId: string
): Promise<AgentSavingsWithdrawalRow> {
  const request = await prisma.personalSavingsHistory.findUnique({ where: { id: historyId } });
  if (!request || request.type !== 'WITHDRAWAL_APPROVED') {
    throw new AppError(404, 'SAVINGS_WITHDRAWAL_NOT_FOUND', 'Savings withdrawal not found');
  }
  if (request.dispensedAt) {
    throw new AppError(400, 'ALREADY_DISPENSED', 'This savings withdrawal has already been dispensed');
  }

  const updated = await prisma.personalSavingsHistory.update({
    where: { id: historyId },
    data: { agentId, dispensedAt: new Date() },
    include: savingsWithdrawalStudentInclude,
  });

  await createNotification(
    updated.wallet.userId,
    'Savings Withdrawal Dispensed',
    `Your $${formatMoney(updated.amount)} Personal Savings withdrawal has been dispensed in cash.`,
    'SAVINGS_WITHDRAWAL_DISPENSED'
  );

  return toAgentSavingsWithdrawalRow(updated);
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

  // Wrapped in one outer transaction (rather than one $transaction per wallet) so a crash
  // partway through a rollover run can't leave some wallets rolled over and others not — the
  // whole cohort commits or rolls back together. For a very large student population this would
  // be a throughput/lock-duration concern, but that's out of scope for this demo's data volume.
  await prisma.$transaction(async (tx) => {
    for (const wallet of studentWallets) {
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

      // Snapshot per-category amounts now — the updateMany below zeroes LockedFund.amount in the
      // same transaction, so this is the only point where the per-category breakdown is still
      // available to persist onto the PersonalSavingsHistory row (see its categoryBreakdown field).
      const categoryBreakdown: Record<string, number> = {};
      for (const fund of lockedFunds) {
        const amount = Number(fund.amount);
        if (amount > 0) {
          categoryBreakdown[fund.category] = amount;
        }
      }

      // BudgetCategory is keyed by (walletId, category, month), so deleting the current month's
      // rows here — not just zeroing their `spent` — is what guarantees "next month starts at
      // $0": any row created for a new month is necessarily a brand-new row (setBudget()'s
      // create-branch relies on `spent`'s schema default of 0; updateSpent()'s create-branch
      // sets `spent` to exactly the new spend, nothing carried over). A zero-out here instead of
      // a delete would be redundant with this and would still need the row to exist to affect
      // anything — it wouldn't run before this point either way, since MonthlyBudgetHistory needs
      // the pre-reset `spent` value archived first.
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

      // Snapshot + reset every category that was actually locked this cycle (totalLocked > 0),
      // independent of whether the wallet's overall totalUnspent nets to 0 — a student who fully
      // spent a category shouldn't leave that category's totalLocked stale, and its cycle should
      // still be archived to LockedFundHistory even though there's nothing left to sweep.
      const lockedThisCycle = lockedFunds.filter((fund) => Number(fund.totalLocked) > 0);
      if (lockedThisCycle.length > 0) {
        // Snapshot this cycle's per-category totals into LockedFundHistory before the updateMany
        // below zeroes them — otherwise "how much was locked/spent in Books last month" becomes
        // unanswerable the moment this transaction commits (LockedFund only ever reflects the
        // current cycle).
        const spentThisMonth = await getSpentByCategory(wallet.id, month);
        const historyRows = lockedThisCycle.map((fund) => ({
          walletId: wallet.id,
          category: fund.category,
          totalLocked: fund.totalLocked,
          totalSpent: spentThisMonth.get(fund.category) ?? 0,
          rolledOver: fund.amount,
          month,
        }));
        await tx.lockedFundHistory.createMany({ data: historyRows });

        // Funds have been rolled over — zero out both the remaining balance AND totalLocked, so
        // next month's locked-funds tracking starts completely fresh per category rather than
        // totalLocked accumulating forever across rollover cycles (a parent locking $200 next
        // month should show "$200 of $200", not "$200 of $500" stacked on top of money that's
        // already been swept to savings). Scoped to just the categories locked this cycle, not
        // every non-excluded category, so an untouched category with totalLocked already at 0
        // isn't needlessly rewritten.
        await tx.lockedFund.updateMany({
          where: {
            walletId: wallet.id,
            category: { in: lockedThisCycle.map((fund) => fund.category) },
          },
          data: { amount: 0, totalLocked: 0 },
        });
      }

      if (totalUnspent > 0) {
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
            categoryBreakdown,
          },
        });

        const student = await tx.user.findUnique({
          where: { id: wallet.userId },
          select: { fullName: true },
        });
        const monthLabel = formatMonthLabel(month);

        await createNotification(
          wallet.userId,
          'Personal Savings Updated',
          `Your $${formatMoney(totalUnspent)} unspent funds from ${monthLabel} have been added to your Personal Savings`,
          'SAVINGS_ROLLOVER'
        );

        await notifyLinkedParents(
          wallet.userId,
          'Personal Savings Update',
          `${student?.fullName ?? 'Your child'} saved $${formatMoney(totalUnspent)} this month in Personal Savings`,
          'SAVINGS_ROLLOVER'
        );

        processed.push({
          walletId: wallet.id,
          userId: wallet.userId,
          amountSaved: formatMoney(totalUnspent),
        });
      }
    }
  });

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
