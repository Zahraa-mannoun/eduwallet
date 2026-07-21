export function StatCard({
  label,
  value,
  subtitle,
  accent = 'primary',
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  accent?: 'primary' | 'red' | 'yellow' | 'green';
}) {
  const accentClasses = {
    primary: 'text-primary',
    red: 'text-red-600',
    yellow: 'text-amber-600',
    green: 'text-emerald-600',
  }[accent];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${accentClasses}`}>{value}</p>
      {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
}
