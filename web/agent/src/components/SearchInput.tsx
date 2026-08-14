import { Search } from 'lucide-react';

// Live-filters an already-fetched list as the agent types — no submit step, since every current
// caller filters an in-memory array rather than re-querying the server per keystroke.
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search by name or email…',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-slate-400" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}
