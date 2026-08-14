import type { ReactNode } from 'react';

export type StatAccent =
  | 'primary'
  | 'blue'
  | 'indigo'
  | 'teal'
  | 'purple'
  | 'slate'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green';

const ICON_GRADIENT: Record<StatAccent, string> = {
  primary: 'from-blue-500 to-indigo-500',
  blue: 'from-blue-400 to-blue-600',
  indigo: 'from-indigo-400 to-indigo-600',
  teal: 'from-teal-400 to-teal-600',
  purple: 'from-purple-400 to-purple-600',
  slate: 'from-slate-400 to-slate-600',
  red: 'from-red-400 to-red-600',
  orange: 'from-orange-400 to-orange-600',
  yellow: 'from-amber-400 to-amber-600',
  green: 'from-emerald-400 to-emerald-600',
};

const emphasizedValueClasses: Record<StatAccent, string> = {
  primary: 'text-primary',
  blue: 'text-blue-600',
  indigo: 'text-indigo-600',
  teal: 'text-teal-600',
  purple: 'text-purple-600',
  slate: 'text-slate-900',
  red: 'text-red-600',
  orange: 'text-orange-600',
  yellow: 'text-amber-600',
  green: 'text-emerald-600',
};

export function StatCard({
  label,
  value,
  subtitle,
  accent = 'primary',
  emphasizeValue = false,
  icon,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  accent?: StatAccent;
  /** Colors the value text to match the accent (for metrics where a nonzero value is a warning). */
  emphasizeValue?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p
            className={`mt-2 text-2xl font-bold ${emphasizeValue ? emphasizedValueClasses[accent] : 'text-slate-900'}`}
          >
            {value}
          </p>
          {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
        </div>
        {icon && (
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ${ICON_GRADIENT[accent]}`}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
