import { colors } from '../theme/colors';

const WARNING_COLOR = '#F59E0B';

// Traffic-light color for "how much of a pool has been used" bars — 0-50% green, 50-80% amber,
// 80-100%+ red. Shared by every locked-funds / budget progress bar in the app so the same
// percentage always reads as the same color everywhere.
export function progressColorFor(percentUsed: number): string {
  if (percentUsed > 80) return colors.danger;
  if (percentUsed > 50) return WARNING_COLOR;
  return colors.accent;
}
