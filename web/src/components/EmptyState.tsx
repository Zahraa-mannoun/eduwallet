import type { ReactNode } from 'react';

function DefaultIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-8 w-8">
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="M3.5 9.5h17" />
      <path d="M7.5 13.5h5" />
    </svg>
  );
}

export function EmptyState({
  title,
  message,
  icon,
}: {
  title: string;
  message?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-300">
        {icon ?? <DefaultIcon />}
      </div>
      <div>
        <p className="text-base font-bold text-slate-700">{title}</p>
        {message && <p className="mt-1 text-sm text-slate-400">{message}</p>}
      </div>
    </div>
  );
}
