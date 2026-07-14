import type { MockTransaction } from '../constants/mockTransactions';
import type { BudgetCategoryKey } from '../constants/budgetCategories';

export function getCategorySpendTotals(
  transactions: MockTransaction[]
): Map<BudgetCategoryKey, number> {
  const totals = new Map<BudgetCategoryKey, number>();
  transactions
    .filter((tx) => tx.type === 'SENT')
    .forEach((tx) => {
      totals.set(tx.category, (totals.get(tx.category) ?? 0) + tx.amount);
    });
  return totals;
}
