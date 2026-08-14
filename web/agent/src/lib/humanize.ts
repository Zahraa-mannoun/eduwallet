// Converts a SCREAMING_SNAKE_CASE (or snake_case) enum value into Title Case for display.
export function humanizeEnum(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
