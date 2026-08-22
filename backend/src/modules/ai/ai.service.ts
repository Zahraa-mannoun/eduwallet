import { getBudgetSummary, getCurrentMonth } from '../budget/budget.service';
import { getTransactions, getWallet } from '../wallet/wallet.service';

const RECENT_TRANSACTION_COUNT = 20;
const OVERSPENT_THRESHOLD = 1;
const APPROACHING_LIMIT_THRESHOLD = 0.8;
const LOCKED_FUND_DEPLETION_THRESHOLD = 0.9;
const MAX_RECOMMENDATIONS = 4;

export type WalletDataForAI = {
  balance: number;
  currency: string;
  lockedFunds: Array<{ category: string; amount: number; totalLocked: number; spent: number }>;
  budgets: Array<{ category: string; monthlyLimit: number; spent: number; remaining: number }>;
  recentTransactions: Array<{ amount: number; category: string; type: 'SENT' | 'RECEIVED'; date: string }>;
};

// Gathers everything the rule-based insights below are computed from — same snapshot shape the
// (now-removed) Gemini integration used, kept as-is since it's still exactly the right data.
export async function buildWalletDataForAI(userId: string): Promise<WalletDataForAI> {
  const [wallet, budgetSummary, transactionsResult] = await Promise.all([
    getWallet(userId),
    getBudgetSummary(userId, getCurrentMonth()),
    getTransactions(userId, { page: 1, limit: RECENT_TRANSACTION_COUNT }),
  ]);

  return {
    balance: Number(wallet.balance),
    currency: wallet.currency,
    lockedFunds: wallet.lockedFunds.map((fund) => ({
      category: fund.category,
      amount: Number(fund.amount),
      totalLocked: Number(fund.totalLocked),
      spent: Math.max(0, Number(fund.totalLocked) - Number(fund.amount)),
    })),
    budgets: budgetSummary.categories.map((category) => ({
      category: category.category,
      monthlyLimit: category.monthlyLimit,
      spent: category.spent,
      remaining: category.remaining,
    })),
    recentTransactions: transactionsResult.transactions.slice(0, RECENT_TRANSACTION_COUNT).map((tx) => ({
      amount: Number(tx.amount),
      category: tx.category,
      type: tx.fromWalletId === wallet.id ? 'SENT' : 'RECEIVED',
      date: tx.createdAt.toISOString(),
    })),
  };
}

export type AIHealthLabel = 'Excellent' | 'Good' | 'Fair' | 'Poor';

export type AIInsights = {
  healthScore: number;
  healthLabel: AIHealthLabel;
  summary: string;
  recommendations: string[];
  predictions: Array<{ category: string; predictedAmount: number }>;
};

function labelForScore(score: number): AIHealthLabel {
  if (score >= 85) return 'Excellent';
  if (score >= 65) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
}

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function currentMonthDayCounts(): { daysElapsed: number; daysRemaining: number } {
  const now = new Date();
  const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = now.getDate();
  return { daysElapsed, daysRemaining: Math.max(0, totalDaysInMonth - daysElapsed) };
}

// Budget adherence (how much of each category's monthly limit is used) and locked-fund
// depletion (how much of what was locked into a category has already been spent) are the two
// signals available without any external service — each overspent/near-limit/near-depleted
// category costs points, clamped to [0, 100].
function computeHealthScore(data: WalletDataForAI): number {
  let score = 100;

  for (const budget of data.budgets) {
    if (budget.monthlyLimit <= 0) continue;
    const percentUsed = budget.spent / budget.monthlyLimit;
    if (percentUsed > OVERSPENT_THRESHOLD) {
      score -= 15;
    } else if (percentUsed > APPROACHING_LIMIT_THRESHOLD) {
      score -= 5;
    }
  }

  for (const fund of data.lockedFunds) {
    if (fund.totalLocked <= 0) continue;
    const spentRatio = fund.spent / fund.totalLocked;
    if (spentRatio > LOCKED_FUND_DEPLETION_THRESHOLD) {
      score -= 8;
    }
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildSummary(data: WalletDataForAI, score: number, label: AIHealthLabel): string {
  const sent = data.recentTransactions.filter((tx) => tx.type === 'SENT');
  if (sent.length === 0) {
    return `You haven't made any spending transactions recently. Your wallet balance is $${data.balance.toFixed(2)}.`;
  }
  const totalSpent = sent.reduce((sum, tx) => sum + tx.amount, 0);
  return `You've spent $${totalSpent.toFixed(2)} across ${sent.length} recent transaction${sent.length === 1 ? '' : 's'}. Your financial health score is ${score}/100 (${label}).`;
}

function buildRecommendations(data: WalletDataForAI): string[] {
  const recommendations: string[] = [];

  for (const budget of data.budgets) {
    if (budget.monthlyLimit <= 0) continue;
    const percentUsed = (budget.spent / budget.monthlyLimit) * 100;
    if (percentUsed > 100) {
      recommendations.push(
        `You've overspent your ${titleCase(budget.category)} budget by $${(budget.spent - budget.monthlyLimit).toFixed(2)} — consider raising the limit or slowing down spending there.`
      );
    } else if (percentUsed >= APPROACHING_LIMIT_THRESHOLD * 100) {
      recommendations.push(
        `You've used ${percentUsed.toFixed(0)}% of your ${titleCase(budget.category)} budget — keep an eye on it for the rest of the month.`
      );
    }
  }

  const sentCount = data.recentTransactions.filter((tx) => tx.type === 'SENT').length;
  if (sentCount === 0) {
    recommendations.push("You haven't used your wallet recently — set a budget or lock funds to a category to get started.");
  } else if (data.balance > 0 && recommendations.length < MAX_RECOMMENDATIONS) {
    recommendations.push(`You have $${data.balance.toFixed(2)} available in your wallet, nice work keeping a healthy balance.`);
  }

  if (recommendations.length === 0) {
    recommendations.push("You're within all your budgets this month — keep up the good habits!");
  }

  return recommendations.slice(0, MAX_RECOMMENDATIONS);
}

// Projects each category's full-month total from its spending rate so far this month
// (spent-to-date / days elapsed) carried forward across the days remaining — a simple linear
// extrapolation, not a model.
function buildPredictions(data: WalletDataForAI): Array<{ category: string; predictedAmount: number }> {
  const { daysElapsed, daysRemaining } = currentMonthDayCounts();
  const spendByCategory = new Map<string, number>();

  for (const tx of data.recentTransactions) {
    if (tx.type !== 'SENT') continue;
    spendByCategory.set(tx.category, (spendByCategory.get(tx.category) ?? 0) + tx.amount);
  }

  return Array.from(spendByCategory.entries()).map(([category, spentSoFar]) => {
    const dailyRate = daysElapsed > 0 ? spentSoFar / daysElapsed : 0;
    const predictedAmount = Math.round((spentSoFar + dailyRate * daysRemaining) * 100) / 100;
    return { category, predictedAmount };
  });
}

export async function getAIInsights(userId: string): Promise<AIInsights> {
  const data = await buildWalletDataForAI(userId);
  const healthScore = computeHealthScore(data);
  const healthLabel = labelForScore(healthScore);

  return {
    healthScore,
    healthLabel,
    summary: buildSummary(data, healthScore, healthLabel),
    recommendations: buildRecommendations(data),
    predictions: buildPredictions(data),
  };
}

export type ChatHistoryMessage = { role: 'user' | 'assistant'; content: string };

const CHAT_COMING_SOON_MESSAGE = 'Chat feature coming soon — check back later!';

// No AI backing this anymore — kept as a stable endpoint (rather than removed outright) so any
// existing caller gets a friendly, predictable reply instead of a 404.
export async function getAIChatReply(
  _userId: string,
  _message: string,
  _history: ChatHistoryMessage[]
): Promise<string> {
  return CHAT_COMING_SOON_MESSAGE;
}
