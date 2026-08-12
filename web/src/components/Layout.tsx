import { useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: IconDashboard },
  { to: '/analytics', label: 'Analytics', icon: IconAnalytics },
];

const usersSubItems = [
  { to: '/users/students', label: 'Students', icon: IconGraduation },
  { to: '/users/parents', label: 'Parents', icon: IconUsers },
  { to: '/users/institutions', label: 'Institutions', icon: IconBuilding },
];

const agentsSubItems = [
  { to: '/agents', label: 'Manage Agents', icon: IconBriefcase },
  { to: '/agent-withdrawals', label: 'Agent Withdrawals', icon: IconCash },
  { to: '/agent-messages', label: 'Agent Messages', icon: IconSupport },
];

const trailingNavItems = [
  { to: '/transactions', label: 'Transactions', icon: IconTransactions },
  { to: '/relationships', label: 'Relationships', icon: IconLink },
  { to: '/kyc', label: 'KYC Review', icon: IconShield },
  { to: '/resubmissions', label: 'Resubmissions', icon: IconRepeat },
  { to: '/support', label: 'Support', icon: IconSupport },
  { to: '/fraud', label: 'Fraud Alerts', icon: IconAlert },
  { to: '/scholarships', label: 'Scholarships', icon: IconGraduation },
  { to: '/reports', label: 'Reports', icon: IconReports },
  { to: '/email-requests', label: 'Email Requests', icon: IconEmail },
  { to: '/settings', label: 'Settings', icon: IconSettings },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-primary text-white' : 'text-slate-600 hover:bg-primary-50 hover:text-primary'
  }`;

type NavSubItem = { to: string; label: string; icon: IconComponent };

function NavGroup({
  label,
  icon: Icon,
  items,
  isActive,
  isExpanded,
  onToggle,
}: {
  label: string;
  icon: IconComponent;
  items: NavSubItem[];
  isActive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          isActive ? 'bg-primary text-white' : 'text-slate-600 hover:bg-primary-50 hover:text-primary'
        }`}
      >
        <Icon className="h-5 w-5" />
        <span className="flex-1 text-left">{label}</span>
        <IconChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>
      {isExpanded && (
        <div className="mt-1 space-y-1 pl-4">
          {items.map(({ to, label: itemLabel, icon: ItemIcon }) => (
            <NavLink key={to} to={to} className={navLinkClass}>
              <ItemIcon className="h-4 w-4" />
              {itemLabel}
            </NavLink>
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

  const usersActive = location.pathname.startsWith('/users');
  const agentsActive = location.pathname.startsWith('/agents') || location.pathname === '/agent-withdrawals';

  const [usersExpanded, setUsersExpanded] = useState(usersActive);
  const [agentsExpanded, setAgentsExpanded] = useState(agentsActive);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-white">
            E
          </div>
          <span className="text-lg font-semibold text-slate-900">EduWallet</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={navLinkClass}>
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}

          <NavGroup
            label="Users"
            icon={IconUsers}
            items={usersSubItems}
            isActive={usersActive}
            isExpanded={usersExpanded}
            onToggle={() => setUsersExpanded((expanded) => !expanded)}
          />

          <NavGroup
            label="Agents"
            icon={IconBriefcase}
            items={agentsSubItems}
            isActive={agentsActive}
            isExpanded={agentsExpanded}
            onToggle={() => setAgentsExpanded((expanded) => !expanded)}
          />

          {trailingNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={navLinkClass}>
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <h1 className="text-base font-semibold text-slate-900">EduWallet Admin</h1>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <span className="text-sm text-slate-600">{admin?.fullName}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <IconLogout className="h-4 w-4" />
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden p-6">{children}</main>
      </div>
    </div>
  );
}
