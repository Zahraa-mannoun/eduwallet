import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Save } from 'lucide-react';
import type { ApiResponse, User } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';

type RolloverResult = {
  month: string;
  processed: Array<{ walletId: string; userId: string; amountSaved: string }>;
};

function formatMonthLabel(month: string): string {
  const [year, monthNum] = month.split('-').map(Number);
  const date = new Date(year, (monthNum ?? 1) - 1, 1);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

const inputClass =
  'w-full rounded-xl border-2 border-slate-200 px-3 py-2 pr-9 text-sm transition-colors focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100';
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

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
      <div className="border-b border-slate-100 px-6 py-5">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="p-6">{children}</div>
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
    <SectionCard title="Change Email" subtitle={`Current email: ${admin?.email ?? '—'}`}>
      {success ? (
        <p className="max-w-sm rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Email updated. Signing you out so you can sign back in with your new email…
        </p>
      ) : (
        <form className="max-w-sm space-y-4" onSubmit={handleSubmit}>
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
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-primary-600 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {isSubmitting ? 'Updating…' : 'Update Email'}
          </button>
        </form>
      )}
    </SectionCard>
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
    <SectionCard title="Change Password" subtitle="Choose a new password of at least 8 characters">
      {success ? (
        <p className="max-w-sm rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Password updated. Signing you out so you can sign back in with your new password…
        </p>
      ) : (
        <form className="max-w-sm space-y-4" onSubmit={handleSubmit}>
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
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-primary-600 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {isSubmitting ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      )}
    </SectionCard>
  );
}

function RolloverConfirmModal({
  onClose,
  onConfirmed,
}: {
  onClose: () => void;
  onConfirmed: (result: RolloverResult) => void;
}) {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const res = await api.post<ApiResponse<RolloverResult>>('/savings/rollover');
      onConfirmed(unwrap(res.data));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Modal
      title="Trigger Monthly Rollover"
      subtitle="Personal Savings"
      icon={<RefreshCw className="h-6 w-6 text-white" />}
      tone="primary"
      onClose={onClose}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-700">
          Are you sure you want to trigger the monthly rollover for all students?
        </p>
        <p className="text-xs text-slate-400">
          This sweeps every student&apos;s unspent budget for the current month into their
          Personal Savings and archives the month&apos;s budget categories. This is the same job
          that runs automatically at midnight on the last day of every month.
        </p>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isRunning}
            className="rounded-xl border-2 border-slate-200 px-6 py-3 text-sm font-semibold text-slate-600 transition-all duration-200 hover:scale-[1.02] hover:bg-slate-50 disabled:opacity-60 disabled:hover:scale-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isRunning}
            className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-primary-600 disabled:opacity-60 disabled:hover:scale-100"
          >
            {isRunning ? 'Running…' : 'Confirm'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SystemActionsSection() {
  const [modalOpen, setModalOpen] = useState(false);
  const [result, setResult] = useState<RolloverResult | null>(null);

  const totalSaved = result?.processed.reduce((sum, entry) => sum + Number(entry.amountSaved), 0) ?? 0;

  return (
    <SectionCard title="System Actions" subtitle="Administrative actions for system maintenance">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-700">Personal Savings — Monthly Rollover</p>
          <p className="mt-0.5 max-w-md text-sm text-slate-500">
            Runs automatically at midnight on the last day of every month. Trigger manually for
            demo or testing purposes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-primary-600"
        >
          <RefreshCw className="h-4 w-4" />
          Trigger Rollover
        </button>
      </div>

      {result && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Rollover complete for {formatMonthLabel(result.month)} — {result.processed.length}{' '}
          student{result.processed.length === 1 ? '' : 's'} saved a total of ${totalSaved.toFixed(2)}.
        </p>
      )}

      {modalOpen && (
        <RolloverConfirmModal
          onClose={() => setModalOpen(false)}
          onConfirmed={(res) => {
            setResult(res);
            setModalOpen(false);
          }}
        />
      )}
    </SectionCard>
  );
}

export function Settings() {
  return (
    <div className="space-y-4">
      <PageHeader title="Settings" subtitle="Manage your admin account credentials" />
      <div className="space-y-6">
        <EmailSection />
        <PasswordSection />
        <SystemActionsSection />
      </div>
    </div>
  );
}
