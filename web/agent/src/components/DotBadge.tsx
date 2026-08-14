import type { ReactNode } from 'react';
import { Badge } from './Badge';
import type { BadgeTone } from './Badge';

export const DOT_COLOR: Record<BadgeTone, string> = {
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  purple: 'bg-purple-500',
  red: 'bg-red-500',
  yellow: 'bg-amber-500',
  orange: 'bg-orange-500',
  gray: 'bg-slate-400',
};

// A Badge with a small leading status dot — for the "at a glance, before you've even read the
// word" signal a plain colored pill doesn't quite give (withdrawal status, receipt status, ...).
export function DotBadge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <Badge tone={tone}>
      <span className={`mr-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${DOT_COLOR[tone]}`} />
      {children}
    </Badge>
  );
}
