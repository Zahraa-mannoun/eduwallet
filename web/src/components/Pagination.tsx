import { ChevronLeft, ChevronRight } from 'lucide-react';

function getPageNumbers(current: number, total: number): Array<number | '…'> {
  const delta = 1;
  const rangeStart = Math.max(2, current - delta);
  const rangeEnd = Math.min(total - 1, current + delta);

  const pages: Array<number | '…'> = [1];
  if (rangeStart > 2) pages.push('…');
  for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
  if (rangeEnd < total - 1) pages.push('…');
  if (total > 1) pages.push(total);
  return pages;
}

export function Pagination({
  page,
  totalPages,
  total,
  itemLabel,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
}) {
  const pageNumbers = getPageNumbers(page, totalPages);

  const navButtonClass =
    'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white';

  return (
    <div className="flex flex-col items-center justify-between gap-3 text-sm text-slate-500 sm:flex-row">
      <span>
        Page <span className="font-medium text-slate-700">{page}</span> of{' '}
        <span className="font-medium text-slate-700">{totalPages}</span> (
        <span className="font-medium text-slate-700">{total}</span> total {itemLabel})
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={navButtonClass}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pageNumbers.map((p, index) =>
          p === '…' ? (
            <span key={`ellipsis-${index}`} className="px-1.5 text-slate-300">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                p === page
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className={navButtonClass}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
