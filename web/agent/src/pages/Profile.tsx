import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ApiResponse, User } from '../types';
import { api, getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';
const labelClass = 'mb-1 block text-sm font-medium text-slate-700';

function EmailSection() {
  const { agent, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.patch<ApiResponse<User>>('/auth/admin/update-credentials', {
        currentPassword,
        newEmail,
      });
      setSuccess(true);
      setTimeout(() => {
        logout();
        navigate('/login', { replace: true });
      }, 1500);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Change Email</h2>
      <p className="mt-1 text-sm text-slate-500">Current email: {agent?.email}</p>

      {success ? (
        <p className="mt-4 max-w-sm rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Email updated. Signing you out so you can sign back in with your new email…
        </p>
      ) : (
        <form className="mt-4 max-w-sm space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email-current-password" className={labelClass}>
              Current Password
            </label>
            <input
              id="email-current-password"
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="new-email" className={labelClass}>
              New Email
            </label>
            <input
              id="new-email"
              type="email"
              required
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              className={inputClass}
            />
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-60"
          >
            {isSubmitting ? 'Updating…' : 'Update Email'}
          </button>
        </form>
      )}
    </div>
  );
}

function PasswordSection() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.patch<ApiResponse<User>>('/auth/admin/update-credentials', {
        currentPassword,
        newPassword,
      });
      setSuccess(true);
      setTimeout(() => {
        logout();
        navigate('/login', { replace: true });
      }, 1500);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Change Password</h2>
      <p className="mt-1 text-sm text-slate-500">Choose a new password of at least 8 characters.</p>

      {success ? (
        <p className="mt-4 max-w-sm rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Password updated. Signing you out so you can sign back in with your new password…
        </p>
      ) : (
        <form className="mt-4 max-w-sm space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="password-current-password" className={labelClass}>
              Current Password
            </label>
            <input
              id="password-current-password"
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="new-password" className={labelClass}>
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className={labelClass}>
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className={inputClass}
            />
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-60"
          >
            {isSubmitting ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      )}
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Profile() {
  const { agent } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">My Profile</h1>
        <p className="mt-1 text-sm text-slate-500">Your agent account details and credentials.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-100 text-lg font-semibold text-primary">
            {agent ? getInitials(agent.fullName) : ''}
          </div>
          <div>
            <p className="text-base font-semibold text-slate-900">{agent?.fullName}</p>
            <p className="text-sm text-slate-500">{agent?.email}</p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              Agent
            </span>
          </div>
        </div>
      </div>

      <EmailSection />
      <PasswordSection />
    </div>
  );
}
