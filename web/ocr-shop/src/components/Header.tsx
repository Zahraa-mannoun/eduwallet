import { Link, useNavigate } from 'react-router-dom';
import { LogOut, ShoppingBag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

interface HeaderProps {
  onCartClick: () => void;
}

export function Header({ onCartClick }: Readonly<HeaderProps>) {
  const { user, isAuthenticated, logout } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/home" className="shrink-0">
          <span className="text-xl font-extrabold tracking-tight text-primary-700">ScanMart</span>
        </Link>

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={onCartClick}
            className="relative flex items-center gap-1.5 rounded-lg px-2 py-2 text-slate-700 transition hover:bg-slate-100"
            aria-label="Open cart"
          >
            <ShoppingBag className="h-6 w-6" />
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
                {itemCount}
              </span>
            )}
          </button>

          {isAuthenticated && (
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 sm:flex">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
                  {user?.fullName.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-slate-700">{user?.fullName}</span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
