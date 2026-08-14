import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

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
        {icon ?? <Inbox className="h-8 w-8" />}
      </div>
      <div>
        <p className="text-base font-bold text-slate-700">{title}</p>
        {message && <p className="mt-1 text-sm text-slate-400">{message}</p>}
      </div>
    </div>
  );
}
