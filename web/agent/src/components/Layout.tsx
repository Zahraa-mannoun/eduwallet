import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Clock,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  PiggyBank,
  Search,
  ShieldCheck,
  User,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AgentSavingsWithdrawalRow, ApiResponse } from '../types';
import { api, unwrap } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useSocketRefetch } from '../hooks/useSocketRefetch';
import { NotificationBell } from './NotificationBell';
import { Avatar } from './Avatar';

const POLL_INTERVAL_MS = 30_000;

const navItems: Array<{ to: string; label: string; icon: LucideIcon; badgeKey?: 'savingsWithdrawals' }> = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/process', label: 'Process Withdrawal', icon: Search },
  { to: '/history', label: 'Withdrawal History', icon: Clock },
  { to: '/savings-withdrawals', label: 'Savings Withdrawals', icon: PiggyBank, badgeKey: 'savingsWithdrawals' },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
  { to: '/profile', label: 'Profile', icon: User },
];

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Your activity overview' },
  '/process': { title: 'Process Withdrawal', subtitle: 'Dispense cash withdrawals to students' },
  '/history': { title: 'Withdrawal History', subtitle: 'Every cash withdrawal you have dispensed' },
  '/savings-withdrawals': {
    title: 'Savings Withdrawals',
    subtitle: 'Approved savings withdrawal requests ready to dispense',
  },
  '/messages': { title: 'Messages', subtitle: 'Send a message to the EduWallet admin team' },
  '/profile': { title: 'Profile', subtitle: 'Your agent account details and credentials' },
};

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
    isActive ? 'bg-primary text-white shadow-sm' : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-white'
  }`;

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { agent, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [pendingSavingsWithdrawals, setPendingSavingsWithdrawals] = useState(0);

  const loadBadgeCounts = useCallback(async () => {
    try {
      const response = await api.get<ApiResponse<AgentSavingsWithdrawalRow[]>>('/agent/savings-withdrawals');
      const rows = unwrap(response.data);
      setPendingSavingsWithdrawals(rows.filter((row) => !row.dispensedAt).length);
    } catch {
      // silent — sidebar badge just won't update until the next successful poll
    }
  }, []);

  useEffect(() => {
    void loadBadgeCounts();
    const interval = setInterval(() => void loadBadgeCounts(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadBadgeCounts]);

  useSocketRefetch(loadBadgeCounts);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const pageMeta = PAGE_META[location.pathname] ?? { title: 'EduWallet Agent Portal', subtitle: '' };

  return (
    <div className="flex min-h-screen bg-surface font-sans">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-sidebar">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
            EW
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-white">EduWallet</p>
            <p className="text-xs leading-tight text-sidebar-muted">Agent Portal</p>
          </div>
        </div>

        <nav className="sidebar-scroll flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {navItems.map(({ to, label, icon: Icon, badgeKey }) => (
            <NavLink key={to} to={to} className={navLinkClass}>
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {label}
              {badgeKey === 'savingsWithdrawals' && <NavBadge count={pendingSavingsWithdrawals} />}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 bg-black/10 px-4 py-4">
          <div className="flex items-center gap-2.5">
            <Avatar name={agent?.fullName ?? 'Agent'} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{agent?.fullName ?? 'Agent'}</p>
              <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-primary-900/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-200">
                <ShieldCheck className="h-3 w-3" />
                Agent
              </span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Logout"
              aria-label="Logout"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div>
            <h1 className="text-base font-bold text-slate-900">{pageMeta.title}</h1>
            {pageMeta.subtitle && <p className="text-xs text-slate-400">{pageMeta.subtitle}</p>}
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-2.5">
              <Avatar name={agent?.fullName ?? 'Agent'} size="sm" />
              <span className="text-sm font-medium text-slate-700">{agent?.fullName}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden p-6">{children}</main>
      </div>
    </div>
  );
}
