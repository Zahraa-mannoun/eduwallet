import { Search } from 'lucide-react';
import type { FormEvent } from 'react';

export function SearchInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Search by name or email…',
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  placeholder?: string;
}) {
  return (
    <form onSubmit={onSubmit} className="relative w-full max-w-xs">
      <button
        type="submit"
        aria-label="Search"
        className="absolute inset-y-0 left-0 flex w-9 items-center justify-center text-slate-400 hover:text-primary"
      >
        <Search className="h-4 w-4" />
      </button>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </form>
  );
}
