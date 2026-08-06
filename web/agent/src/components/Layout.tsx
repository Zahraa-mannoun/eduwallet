import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/process', label: 'Process Withdrawal' },
  { to: '/history', label: 'Withdrawal History' },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive ? 'bg-primary text-white' : 'text-slate-600 hover:bg-primary-50 hover:text-primary'
  }`;

export function Layout({ children }: { children: ReactNode }) {
  const { agent, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-white">
              E
            </div>
            <span className="text-base font-semibold text-slate-900">EduWallet Agent Portal</span>
          </div>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={navLinkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">{agent?.fullName}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}
