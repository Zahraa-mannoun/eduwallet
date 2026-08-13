import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ApiResponse, User } from '@eduwallet/shared';
import { api, getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 pr-9 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';
const labelClass = 'mb-1 block text-sm font-medium text-slate-700';

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.24 4.24M9.4 5.5A9.6 9.6 0 0 1 12 5c6 0 9.5 7 9.5 7a13.8 13.8 0 0 1-3.2 4.15M6.3 6.9C4 8.5 2.5 12 2.5 12a13.7 13.7 0 0 0 4.15 4.9"
      />
    </svg>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  minLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-slate-400 hover:text-slate-600"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          <EyeIcon open={visible} />
        </button>
      </div>
    </div>
  );
}

function EmailSection() {
  const { admin, logout } = useAuth();
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
      <p className="mt-1 text-sm text-slate-500">Current email: {admin?.email}</p>

      {success ? (
        <p className="mt-4 max-w-sm rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Email updated. Signing you out so you can sign back in with your new email…
        </p>
      ) : (
        <form className="mt-4 max-w-sm space-y-4" onSubmit={handleSubmit}>
          <PasswordField
            id="email-current-password"
            label="Current Password"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
          />

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
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-60"
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
        <p className="mt-4 max-w-sm rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Password updated. Signing you out so you can sign back in with your new password…
        </p>
      ) : (
        <form className="mt-4 max-w-sm space-y-4" onSubmit={handleSubmit}>
          <PasswordField
            id="password-current-password"
            label="Current Password"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
          />

          <PasswordField
            id="new-password"
            label="New Password"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            minLength={8}
          />

          <PasswordField
            id="confirm-password"
            label="Confirm New Password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            minLength={8}
          />

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-60"
          >
            {isSubmitting ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      )}
    </div>
  );
}

export function Settings() {
  return (
    <div className="space-y-6">
      <EmailSection />
      <PasswordSection />
    </div>
  );
}
