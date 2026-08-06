import type { MaterialCommunityIcons } from '@expo/vector-icons';
import { categoryColors } from '../theme/colors';

export type BudgetCategoryKey =
  | 'tuition'
  | 'books'
  | 'food'
  | 'transport'
  | 'software'
  | 'rent'
  | 'lifestyle'
  | 'personal_savings'
  | 'general';

export type BudgetCategoryDefinition = {
  key: BudgetCategoryKey;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  label: string;
};

export const BUDGET_CATEGORIES: BudgetCategoryDefinition[] = [
  { key: 'tuition', icon: 'school-outline', color: categoryColors.tuition, label: 'Tuition' },
  { key: 'books', icon: 'book-open-outline', color: categoryColors.books, label: 'Books' },
  { key: 'food', icon: 'food-outline', color: categoryColors.food, label: 'Food' },
  { key: 'transport', icon: 'bus', color: categoryColors.transport, label: 'Transport' },
  { key: 'software', icon: 'laptop', color: categoryColors.software, label: 'Software' },
  { key: 'rent', icon: 'home-outline', color: categoryColors.rent, label: 'Rent' },
  { key: 'lifestyle', icon: 'account-outline', color: categoryColors.lifestyle, label: 'Lifestyle' },
  {
    key: 'personal_savings',
    icon: 'piggy-bank-outline',
    color: categoryColors.personalSavings,
    label: 'Personal Savings',
  },
  { key: 'general', icon: 'shape-outline', color: categoryColors.general, label: 'General' },
];

// Card creation and parent-to-student transfers never offer Personal Savings as a lockable
// category — it's an auto-accumulating pool, not something funds can be sent/locked into.
export const LOCKABLE_BUDGET_CATEGORIES: BudgetCategoryDefinition[] = BUDGET_CATEGORIES.filter(
  (category) => category.key !== 'personal_savings'
);
