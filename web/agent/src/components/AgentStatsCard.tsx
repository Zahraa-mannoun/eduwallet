import { useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';
import { useState } from 'react';
import { Banknote, CalendarCheck, CalendarRange, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AgentStats, ApiResponse } from '../types';
import { api, getErrorMessage, unwrap } from '../lib/api';

export type AgentStatsCardHandle = {
  refresh: () => void;
};

const TILES: Array<{
  key: keyof AgentStats;
  label: string;
  icon: LucideIcon;
  accent: string;
  format: (value: string) => string;
}> = [
  {
    key: 'withdrawalsToday',
    label: 'Withdrawals Today',
    icon: CalendarCheck,
    accent: 'border-l-blue-400',
    format: (value) => value,
  },
  {
    key: 'withdrawalsThisMonth',
    label: 'Withdrawals This Month',
    icon: CalendarRange,
    accent: 'border-l-indigo-400',
    format: (value) => value,
  },
  {
    key: 'totalDispensedToday',
    label: 'Dispensed Today',
    icon: Banknote,
    accent: 'border-l-teal-400',
    format: (value) => `$${value}`,
  },
  {
    key: 'totalDispensedThisMonth',
    label: 'Dispensed This Month',
    icon: TrendingUp,
    accent: 'border-l-green-400',
    format: (value) => `$${value}`,
  },
];

function StatTile({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  accent: string;
}) {
  return (
    <div className={`rounded-xl border border-l-4 border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${accent}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-0.5 text-xl font-semibold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function StatTileSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-100" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-2.5 w-20 rounded bg-slate-100" />
          <div className="h-4 w-12 rounded bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

export const AgentStatsCard = forwardRef<AgentStatsCardHandle>(function AgentStatsCard(_props, ref) {
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await api.get<ApiResponse<AgentStats>>('/agent/stats');
      setStats(unwrap(response.data));
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useImperativeHandle(ref, () => ({ refresh: () => void load() }), [load]);

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-slate-900">My Stats</h2>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {isLoading && !stats
          ? TILES.map((tile) => <StatTileSkeleton key={tile.key} />)
          : stats &&
            TILES.map((tile) => (
              <StatTile
                key={tile.key}
                label={tile.label}
                value={tile.format(String(stats[tile.key]))}
                icon={tile.icon}
                accent={tile.accent}
              />
            ))}
      </div>
    </div>
  );
});
