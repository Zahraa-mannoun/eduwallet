import type { MaterialCommunityIcons } from '@expo/vector-icons';
import { categoryColors } from '../theme/colors';

export type BudgetCategoryKey =
  | 'tuition'
  | 'books'
  | 'food'
  | 'transport'
  | 'software'
  | 'rent'
  | 'personal'
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
  { key: 'personal', icon: 'account-outline', color: categoryColors.personal, label: 'Personal' },
  { key: 'general', icon: 'shape-outline', color: categoryColors.general, label: 'General' },
];
