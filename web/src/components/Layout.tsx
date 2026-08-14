import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import type { ApiResponse } from '@eduwallet/shared';
import { api, unwrap } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useSocketRefetch } from '../hooks/useSocketRefetch';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { Avatar } from './Avatar';
import { NotificationBell } from './NotificationBell';
import {
  IconAlert,
  IconAnalytics,
  IconBriefcase,
  IconBuilding,
  IconCash,
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

// Top-level items (plain leaves, and a group header whose child is active) get a left accent
// bar + a subdued lighter-navy fill — a deliberately different, quieter treatment from the solid
// blue pill used for the specific active item once you've drilled into a group (see
// subNavLinkClass below), so the two levels of "you are here" never look identical.
const topNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 border-l-[3px] px-3 py-2 text-sm font-medium transition-all duration-200 ${
    isActive
      ? 'border-white bg-sidebar-hover text-white'
      : 'border-transparent text-sidebar-muted hover:border-white/25 hover:bg-sidebar-hover/60 hover:text-white'
  }`;

const subNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
    isActive ? 'bg-primary text-white shadow-sm' : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-white'
  }`;

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function NavLeafLink({ item, sub = false }: { item: NavLeaf; sub?: boolean }) {
  return (
    <NavLink to={item.to} className={sub ? subNavLinkClass : topNavLinkClass}>
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
        className={`flex w-full items-center gap-3 border-l-[3px] px-3 py-2 text-sm font-medium transition-all duration-200 ${
          isActive
            ? 'border-white bg-sidebar-hover text-white'
            : 'border-transparent text-sidebar-muted hover:border-white/25 hover:bg-sidebar-hover/60 hover:text-white'
        }`}
      >
        <group.icon className="h-5 w-5 shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-300 ease-in-out ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className={`grid overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0">
          <div className="mt-1 space-y-1 py-0.5 pl-4">
            {group.items.map((item) => (
              <NavLeafLink key={item.to} item={item} sub />
            ))}
          </div>
        </div>
      </div>
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

  return (
    <div className="flex min-h-screen bg-surface font-sans">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-sidebar">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
            EW
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-white">EduWallet</p>
            <p className="text-xs leading-tight text-sidebar-muted">Admin Panel</p>
          </div>
        </div>

        <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 pb-4">
          {sections.map((section, index) => (
            <div
              key={section.heading}
              className={index > 0 ? 'mt-5 border-t border-white/10 pt-5' : ''}
            >
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
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

        <div className="border-t border-white/10 bg-black/10 px-4 py-4">
          <div className="flex items-center gap-2.5">
            <Avatar name={admin?.fullName ?? 'Admin User'} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{admin?.fullName ?? 'Admin User'}</p>
              <p className="truncate text-xs text-sidebar-muted">{admin?.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Logout"
              aria-label="Logout"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-white"
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
              <Avatar name={admin?.fullName ?? 'Admin User'} size="sm" />
              <span className="text-sm font-medium text-slate-700">{admin?.fullName}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden p-6">{children}</main>
      </div>
    </div>
  );
}
