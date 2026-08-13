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

const borderClasses: Record<StatAccent, string> = {
  primary: 'border-l-primary',
  blue: 'border-l-blue-500',
  indigo: 'border-l-indigo-500',
  teal: 'border-l-teal-500',
  purple: 'border-l-purple-500',
  slate: 'border-l-slate-300',
  red: 'border-l-red-500',
  orange: 'border-l-orange-500',
  yellow: 'border-l-amber-500',
  green: 'border-l-emerald-500',
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
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  accent?: StatAccent;
  /** Colors the value text to match the accent (for metrics where a nonzero value is a warning). */
  emphasizeValue?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-l-4 border-slate-200 bg-white p-5 shadow-sm ${borderClasses[accent]}`}
    >
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${emphasizeValue ? emphasizedValueClasses[accent] : 'text-slate-900'}`}>
        {value}
      </p>
      {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
}
