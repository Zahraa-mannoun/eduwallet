import type { ReactNode } from 'react';

// The shared shell every data table sits inside: white rounded-2xl card, a subtle blue-to-indigo
// gradient bar carrying the table's own title/subtitle plus whatever filters or actions that
// page needs, and a scroll container for the <table> itself. children is the <table> element —
// column structure varies too much page to page to templatize further than this.
export function TableCard({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

// Shared classnames for the <thead>/<tr>/<td> markup every page still writes itself (column
// counts and content differ too much to template) — keeps every table's header weight, row
// padding, zebra striping, and hover accent identical without repeating the class strings.
export const TABLE_HEAD_ROW_CLASS = 'text-xs font-semibold uppercase tracking-widest text-slate-400';
export const TABLE_TH_CLASS = 'border-b border-slate-200 px-6 py-3.5 text-left';
export const TABLE_TD_CLASS = 'px-6 py-4';

// A left border applied directly to a <tr> doesn't reliably render — HTML's default
// border-collapse: separate table model does not paint borders on rows, only on cells, so
// browsers only show it inconsistently at table edges. An inset box-shadow isn't subject to
// that table border model and paints correctly on every row, so it's used here instead.
export function tableRowClass(index: number, extra = ''): string {
  const stripe = index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
  return `${stripe} shadow-[inset_2px_0_0_0_transparent] transition-all duration-150 hover:shadow-[inset_2px_0_0_0_#60a5fa] hover:bg-blue-50/30 ${extra}`;
}
