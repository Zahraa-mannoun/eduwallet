function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

// One gradient per letter of the alphabet — everyone whose name starts with the same letter
// reads as the same "color identity" across the whole app, rather than a color that shifts
// depending on someone's full name. Kept to combinations that stay legible with white text.
const LETTER_GRADIENTS: Record<string, [string, string]> = {
  A: ['#6366F1', '#8B5CF6'],
  B: ['#3B82F6', '#06B6D4'],
  C: ['#10B981', '#059669'],
  D: ['#F59E0B', '#EF4444'],
  E: ['#EC4899', '#8B5CF6'],
  F: ['#14B8A6', '#3B82F6'],
  G: ['#F97316', '#EC4899'],
  H: ['#8B5CF6', '#6366F1'],
  I: ['#06B6D4', '#3B82F6'],
  J: ['#EF4444', '#F97316'],
  K: ['#059669', '#10B981'],
  L: ['#6366F1', '#3B82F6'],
  M: ['#8B5CF6', '#EC4899'],
  N: ['#F59E0B', '#F97316'],
  O: ['#3B82F6', '#8B5CF6'],
  P: ['#EC4899', '#EF4444'],
  Q: ['#14B8A6', '#10B981'],
  R: ['#6366F1', '#06B6D4'],
  S: ['#F97316', '#F59E0B'],
  T: ['#10B981', '#14B8A6'],
  U: ['#8B5CF6', '#3B82F6'],
  V: ['#EF4444', '#EC4899'],
  W: ['#06B6D4', '#14B8A6'],
  X: ['#F59E0B', '#EC4899'],
  Y: ['#3B82F6', '#6366F1'],
  Z: ['#059669', '#3B82F6'],
};
const FALLBACK_GRADIENT: [string, string] = ['#64748B', '#475569'];

function gradientForName(name: string): string {
  const letter = name.trim()[0]?.toUpperCase() ?? '';
  const [from, to] = LETTER_GRADIENTS[letter] ?? FALLBACK_GRADIENT;
  return `linear-gradient(135deg, ${from}, ${to})`;
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const dimensions = size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-10 w-10 text-xs';
  return (
    <span
      style={{ background: gradientForName(name) }}
      className={`inline-flex ${dimensions} shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-sm`}
    >
      {getInitials(name)}
    </span>
  );
}
