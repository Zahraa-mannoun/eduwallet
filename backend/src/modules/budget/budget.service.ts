import type { BudgetCategory, Prisma, TransactionCategory } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import type { SetBudgetInput, UpdateBudgetInput } from './budget.schema';

const OVERSPENT_ALERT_THRESHOLD = 100;
const APPROACHING_LIMIT_ALERT_THRESHOLD = 90;

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function getPrimaryWallet(userId: string) {
  const wallet = await prisma.wallet.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });
  if (!wallet) {
    throw new AppError(404, 'WALLET_NOT_FOUND', 'No wallet found for this user');
  }
  return wallet;
}

async function getOwnedBudget(
  userId: string,
  category: TransactionCategory,
  month: string
): Promise<BudgetCategory> {
  const wallet = await getPrimaryWallet(userId);
  const budget = await prisma.budgetCategory.findUnique({
    where: { walletId_category_month: { walletId: wallet.id, category, month } },
  });
  if (!budget) {
    throw new AppError(404, 'BUDGET_NOT_FOUND', 'No budget set for this category and month');
  }
  return budget;
}

export async function setBudget(userId: string, input: SetBudgetInput): Promise<BudgetCategory> {
  const wallet = await getPrimaryWallet(userId);
  return prisma.budgetCategory.upsert({
    where: {
      walletId_category_month: {
        walletId: wallet.id,
        category: input.category,
        month: input.month,
      },
    },
    create: {
      walletId: wallet.id,
      category: input.category,
      month: input.month,
      monthlyLimit: input.monthlyLimit,
    },
    update: {
      monthlyLimit: input.monthlyLimit,
    },
  });
}

export async function getBudgets(userId: string, month: string): Promise<BudgetCategory[]> {
  const wallet = await getPrimaryWallet(userId);
  return prisma.budgetCategory.findMany({
    where: { walletId: wallet.id, month },
    orderBy: { category: 'asc' },
  });
}

export async function updateBudget(
  userId: string,
  category: TransactionCategory,
  month: string,
  input: UpdateBudgetInput
): Promise<BudgetCategory> {
  const budget = await getOwnedBudget(userId, category, month);
  return prisma.budgetCategory.update({
    where: { id: budget.id },
    data: { monthlyLimit: input.monthlyLimit },
  });
}

export async function deleteBudget(
  userId: string,
  category: TransactionCategory,
  month: string
): Promise<void> {
  const budget = await getOwnedBudget(userId, category, month);
  await prisma.budgetCategory.delete({ where: { id: budget.id } });
}

export async function updateSpent(
  walletId: string,
  category: TransactionCategory,
  amount: number,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const month = getCurrentMonth();
  const client = tx ?? prisma;
  // Upsert rather than updateMany: spending must be tracked even for a category the
  // student never set a personal monthly limit for (monthlyLimit 0 = "no limit"), so
  // screens that show spend against locked funds have real numbers to work with.
  await client.budgetCategory.upsert({
    where: { walletId_category_month: { walletId, category, month } },
    create: { walletId, category, month, monthlyLimit: 0, spent: amount },
    update: { spent: { increment: amount } },
  });
}

export type BudgetCategorySummary = {
  category: TransactionCategory;
  monthlyLimit: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  overspent: boolean;
};

export type BudgetAlert = {
  category: TransactionCategory;
  severity: 'OVERSPENT' | 'APPROACHING_LIMIT';
  message: string;
};

export type BudgetSummary = {
  month: string;
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  categories: BudgetCategorySummary[];
  alerts: BudgetAlert[];
};

export async function getBudgetSummary(userId: string, month: string): Promise<BudgetSummary> {
  const budgets = await getBudgets(userId, month);

  const categories: BudgetCategorySummary[] = budgets.map((budget) => {
    const monthlyLimit = Number(budget.monthlyLimit);
    const spent = Number(budget.spent);
    const percentUsed =
      monthlyLimit > 0 ? Math.round((spent / monthlyLimit) * 10000) / 100 : 0;

    return {
      category: budget.category,
      monthlyLimit,
      spent,
      remaining: monthlyLimit - spent,
      percentUsed,
      overspent: monthlyLimit > 0 && spent > monthlyLimit,
    };
  });

  const alerts: BudgetAlert[] = categories
    .filter((c) => c.percentUsed >= APPROACHING_LIMIT_ALERT_THRESHOLD)
    .map((c) =>
      c.percentUsed >= OVERSPENT_ALERT_THRESHOLD
        ? {
            category: c.category,
            severity: 'OVERSPENT' as const,
            message: `You have overspent your ${c.category.toLowerCase()} budget by ${(c.spent - c.monthlyLimit).toFixed(2)}`,
          }
        : {
            category: c.category,
            severity: 'APPROACHING_LIMIT' as const,
            message: `You have used ${c.percentUsed.toFixed(0)}% of your ${c.category.toLowerCase()} budget`,
          }
    );

  const totalBudget = categories.reduce((sum, c) => sum + c.monthlyLimit, 0);
  const totalSpent = categories.reduce((sum, c) => sum + c.spent, 0);

  return {
    month,
    totalBudget,
    totalSpent,
    remaining: totalBudget - totalSpent,
    categories,
    alerts,
  };
}
