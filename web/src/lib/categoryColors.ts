import type { TransactionCategory } from '@eduwallet/shared';

// Distinct chart color per spending/funding category — separate from badgeTones.ts's
// BadgeTone palette because chart bars need actual hex fills, not Tailwind pill classes.
export const CATEGORY_COLORS: Record<TransactionCategory, string> = {
  TUITION: '#2E5FAC',
  BOOKS: '#7C3AED',
  FOOD: '#10B981',
  TRANSPORT: '#F59E0B',
  SOFTWARE: '#0EA5E9',
  RENT: '#DC2626',
  LIFESTYLE: '#EC4899',
  PERSONAL_SAVINGS: '#D97706',
  GENERAL: '#64748B',
};

export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category as TransactionCategory] ?? '#64748B';
}
