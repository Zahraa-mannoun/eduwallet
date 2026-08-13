// Converts a SCREAMING_SNAKE_CASE (or snake_case) enum value into Title Case for display —
// the generic fallback for any raw enum string that doesn't have a bespoke label map
// (see badgeTones.ts / transactionStatus.ts / kycDisplayStatus.ts for the richer, context-aware
// ones that should be preferred wherever they apply).
export function humanizeEnum(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
