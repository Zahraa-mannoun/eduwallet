export function FilterTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-full bg-slate-100 p-1.5">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
            value === tab.value
              ? 'bg-primary text-white shadow-sm'
              : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
