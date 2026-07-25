import { IconRefresh } from './icons';

export function RefreshButton({
  onClick,
  isLoading,
}: Readonly<{ onClick: () => void; isLoading?: boolean }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
    >
      <IconRefresh className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
      Refresh
    </button>
  );
}
