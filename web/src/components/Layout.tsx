import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import type { ApiResponse } from '@eduwallet/shared';
import { api, unwrap } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useSocketRefetch } from '../hooks/useSocketRefetch';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { NotificationBell } from './NotificationBell';
import {
  IconAlert,
  IconAnalytics,
  IconBriefcase,
  IconBuilding,
  IconCash,
  IconChevronDown,
  IconDashboard,
  IconEmail,
  IconGraduation,
  IconLink,
  IconLogout,
  IconReports,
  IconRepeat,
  IconSettings,
  IconShield,
  IconSupport,
  IconTransactions,
  IconUsers,
} from './icons';
import type { IconComponent } from './icons';
import type { SupportMessageRow, SystemStats } from '../types/admin';

const POLL_INTERVAL_MS = 30_000;

type NavLeaf = { to: string; label: string; icon: IconComponent; badge?: number };
type NavGroupDef = { label: string; icon: IconComponent; items: NavLeaf[]; matchPrefixes: string[] };
type NavSection = { heading: string; items: (NavLeaf | NavGroupDef)[] };

function isGroup(item: NavLeaf | NavGroupDef): item is NavGroupDef {
  return 'items' in item;
}

const PAGE_META: Record<string, { title: string; breadcrumb: string }> = {
  '/dashboard': { title: 'Dashboard', breadcrumb: 'Overview' },
  '/analytics': { title: 'Analytics', breadcrumb: 'Overview / Analytics' },
  '/users/students': { title: 'Students', breadcrumb: 'Users / Students' },
  '/users/parents': { title: 'Parents', breadcrumb: 'Users / Parents' },
  '/users/institutions': { title: 'Institutions', breadcrumb: 'Users / Institutions' },
  '/relationships': { title: 'Relationships', breadcrumb: 'Users / Relationships' },
  '/kyc': { title: 'KYC Review', breadcrumb: 'Users / KYC Review' },
  '/resubmissions': { title: 'Resubmissions', breadcrumb: 'Users / Resubmissions' },
  '/transactions': { title: 'Transactions', breadcrumb: 'Finance / Transactions' },
  '/agent-withdrawals': { title: 'Withdrawals', breadcrumb: 'Finance / Withdrawals' },
  '/scholarships': { title: 'Scholarships', breadcrumb: 'Finance / Scholarships' },
  '/reports': { title: 'Reports', breadcrumb: 'Finance / Reports' },
  '/agents': { title: 'Manage Agents', breadcrumb: 'System / Agents' },
  '/agent-messages': { title: 'Agent Messages', breadcrumb: 'System / Agents / Messages' },
  '/fraud': { title: 'Fraud Alerts', breadcrumb: 'System / Fraud Alerts' },
  '/support': { title: 'Support', breadcrumb: 'System / Support' },
  '/email-requests': { title: 'Email Requests', breadcrumb: 'System / Email Requests' },
  '/settings': { title: 'Settings', breadcrumb: 'System / Settings' },
};

function getInitials(fullName: string | undefined): string {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-primary text-white' : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-white'
  }`;

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function NavLeafLink({ item }: { item: NavLeaf }) {
  return (
    <NavLink to={item.to} className={navLinkClass}>
      <item.icon className="h-5 w-5 shrink-0" />
      <span className="flex-1 text-left">{item.label}</span>
      {item.badge !== undefined && <NavBadge count={item.badge} />}
    </NavLink>
  );
}

function NavGroup({ group }: { group: NavGroupDef }) {
  const location = useLocation();
  const isActive = group.matchPrefixes.some((prefix) => location.pathname.startsWith(prefix));
  const [isExpanded, setIsExpanded] = useState(isActive);

  useEffect(() => {
    if (isActive) setIsExpanded(true);
  }, [isActive]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsExpanded((expanded) => !expanded)}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive ? 'bg-primary text-white' : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-white'
        }`}
      >
        <group.icon className="h-5 w-5 shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        <IconChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>
      {isExpanded && (
        <div className="mt-1 space-y-1 pl-4">
          {group.items.map((item) => (
            <NavLeafLink key={item.to} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [stats, setStats] = useState<SystemStats | null>(null);
  const [supportUnread, setSupportUnread] = useState(0);

  const loadBadgeCounts = useCallback(async () => {
    try {
      const [statsRes, supportRes] = await Promise.all([
        api.get<ApiResponse<SystemStats>>('/admin/stats'),
        api.get<ApiResponse<SupportMessageRow[]>>('/support/messages'),
      ]);
      setStats(unwrap(statsRes.data));
      const unread = unwrap(supportRes.data).filter(
        (message) => message.status === 'UNREAD' && message.type !== 'AGENT_MESSAGE'
      ).length;
      setSupportUnread(unread);
    } catch {
      // silent — sidebar badges just won't update until the next successful poll
    }
  }, []);

  useEffect(() => {
    void loadBadgeCounts();
    const interval = setInterval(() => void loadBadgeCounts(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadBadgeCounts]);

  useVisibilityRefetch(loadBadgeCounts);
  useSocketRefetch(loadBadgeCounts);

  const sections: NavSection[] = [
    {
      heading: 'Overview',
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: IconDashboard },
        { to: '/analytics', label: 'Analytics', icon: IconAnalytics },
      ],
    },
    {
      heading: 'Users',
      items: [
        {
          label: 'Users',
          icon: IconUsers,
          matchPrefixes: ['/users'],
          items: [
            { to: '/users/students', label: 'Students', icon: IconGraduation },
            { to: '/users/parents', label: 'Parents', icon: IconUsers },
            { to: '/users/institutions', label: 'Institutions', icon: IconBuilding },
          ],
        },
        { to: '/relationships', label: 'Relationships', icon: IconLink },
        { to: '/kyc', label: 'KYC Review', icon: IconShield, badge: stats?.kyc.pending ?? 0 },
        { to: '/resubmissions', label: 'Resubmissions', icon: IconRepeat },
      ],
    },
    {
      heading: 'Finance',
      items: [
        { to: '/transactions', label: 'Transactions', icon: IconTransactions },
        { to: '/agent-withdrawals', label: 'Withdrawals', icon: IconCash },
        { to: '/scholarships', label: 'Scholarships', icon: IconGraduation },
        { to: '/reports', label: 'Reports', icon: IconReports },
      ],
    },
    {
      heading: 'System',
      items: [
        {
          label: 'Agents',
          icon: IconBriefcase,
          matchPrefixes: ['/agents', '/agent-messages'],
          items: [
            { to: '/agents', label: 'Manage Agents', icon: IconBriefcase },
            { to: '/agent-messages', label: 'Agent Messages', icon: IconSupport },
          ],
        },
        {
          to: '/fraud',
          label: 'Fraud Alerts',
          icon: IconAlert,
          badge: stats?.fraudAlerts.active ?? 0,
        },
        { to: '/support', label: 'Support', icon: IconSupport, badge: supportUnread },
        {
          to: '/email-requests',
          label: 'Email Requests',
          icon: IconEmail,
          badge: stats?.emailChangeRequests.pending ?? 0,
        },
        { to: '/settings', label: 'Settings', icon: IconSettings },
      ],
    },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const pageMeta = PAGE_META[location.pathname] ?? { title: 'EduWallet Admin', breadcrumb: '' };
  const initials = getInitials(admin?.fullName);

  return (
    <div className="flex min-h-screen bg-surface font-sans">
      <aside className="flex w-64 shrink-0 flex-col bg-sidebar">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
            EW
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-white">EduWallet</p>
            <p className="text-xs leading-tight text-sidebar-muted">Admin Panel</p>
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {sections.map((section) => (
            <div key={section.heading}>
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {section.heading}
              </p>
              <div className="space-y-1">
                {section.items.map((item) =>
                  isGroup(item) ? (
                    <NavGroup key={item.label} group={item} />
                  ) : (
                    <NavLeafLink key={item.to} item={item} />
                  )
                )}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-700 text-xs font-semibold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{admin?.fullName ?? 'Admin User'}</p>
              <p className="truncate text-xs text-sidebar-muted">{admin?.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Logout"
              aria-label="Logout"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-muted hover:bg-sidebar-hover hover:text-white"
            >
              <IconLogout className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div>
            <h1 className="text-base font-bold text-slate-900">{pageMeta.title}</h1>
            {pageMeta.breadcrumb && (
              <p className="text-xs text-slate-400">{pageMeta.breadcrumb}</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary">
                {initials}
              </div>
              <span className="text-sm font-medium text-slate-700">{admin?.fullName}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden p-6">{children}</main>
      </div>
    </div>
  );
}
