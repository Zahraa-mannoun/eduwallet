import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, RefreshCw, Save, TrendingUp, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ApiResponse, User } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { DotBadge } from '../components/DotBadge';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { severityTone } from '../lib/badgeTones';
import { formatDateTime } from '../lib/format';
import { humanizeEnum } from '../lib/humanize';
import { useAuth } from '../context/AuthContext';
import type { AnalyticsResult, FraudRuleRow } from '../types/admin';

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

type FraudRuleFieldMeta = {
  displayUnit: string;
  min: number;
  max: number;
  step: number;
  toDisplay: (raw: number) => number;
  toRaw: (display: number) => number;
};

// value on the wire is always in the FraudRule row's native unit (milliseconds for every *_MS
// key, matching fraud.service.ts's own hardcoded defaults before this table existed) — these
// conversions are purely a friendlier display/edit experience, never sent to the API as-is.
const FRAUD_RULE_FIELD_META: Record<string, FraudRuleFieldMeta> = {
  DUPLICATE_WINDOW_MS: {
    displayUnit: 'seconds',
    min: 5,
    max: 300,
    step: 1,
    toDisplay: (raw) => Math.round(raw / 1000),
    toRaw: (display) => display * 1000,
  },
  VELOCITY_WINDOW_MS: {
    displayUnit: 'minutes',
    min: 1,
    max: 120,
    step: 1,
    toDisplay: (raw) => Math.round(raw / 60000),
    toRaw: (display) => display * 60000,
  },
  VELOCITY_THRESHOLD: {
    displayUnit: 'transactions',
    min: 2,
    max: 50,
    step: 1,
    toDisplay: (raw) => raw,
    toRaw: (display) => display,
  },
  CIRCULAR_WINDOW_MS: {
    displayUnit: 'minutes',
    min: 5,
    max: 1440,
    step: 1,
    toDisplay: (raw) => Math.round(raw / 60000),
    toRaw: (display) => display * 60000,
  },
  UNUSUAL_AMOUNT_MULTIPLIER: {
    displayUnit: 'x average',
    min: 1.5,
    max: 20,
    step: 0.5,
    toDisplay: (raw) => raw,
    toRaw: (display) => display,
  },
  UNUSUAL_AMOUNT_HISTORY_SIZE: {
    displayUnit: 'transactions',
    min: 5,
    max: 200,
    step: 1,
    toDisplay: (raw) => raw,
    toRaw: (display) => display,
  },
};

type FraudRuleGroup = {
  key: string;
  title: string;
  color: string;
  icon: LucideIcon;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  fieldKeys: string[];
};

const FRAUD_RULE_GROUPS: FraudRuleGroup[] = [
  {
    key: 'DUPLICATE',
    title: 'Duplicate Detection',
    color: '#3B82F6',
    icon: Copy,
    severity: 'MEDIUM',
    description:
      'Flags a second payment of the exact same amount to the exact same recipient sent shortly after the first — almost always an accidental double-tap on the send button rather than a second real payment.',
    fieldKeys: ['DUPLICATE_WINDOW_MS'],
  },
  {
    key: 'VELOCITY',
    title: 'Velocity Check',
    color: '#F59E0B',
    icon: Zap,
    severity: 'MEDIUM',
    description:
      'Flags a wallet that sends or receives an unusually high number of transactions in a short window — a pattern typical of a compromised account or automated abuse rather than normal student spending.',
    fieldKeys: ['VELOCITY_WINDOW_MS', 'VELOCITY_THRESHOLD'],
  },
  {
    key: 'CIRCULAR',
    title: 'Circular Transfer Detection',
    color: '#EF4444',
    icon: RefreshCw,
    severity: 'HIGH',
    description:
      'Flags money sent right back to where it just came from — wallet A pays wallet B, and B pays A back within the window below. This pattern is often used to launder funds or artificially inflate activity.',
    fieldKeys: ['CIRCULAR_WINDOW_MS'],
  },
  {
    key: 'UNUSUAL_AMOUNT',
    title: 'Unusual Amount Detection',
    color: '#8B5CF6',
    icon: TrendingUp,
    severity: 'LOW',
    description:
      "Flags a payment significantly larger than a sender's own average, sent to a recipient they have no history with. A sender's normal habits — even large ones — are never flagged on their own.",
    fieldKeys: ['UNUSUAL_AMOUNT_MULTIPLIER', 'UNUSUAL_AMOUNT_HISTORY_SIZE'],
  },
];

function FraudRuleCard({
  group,
  rules,
  onSaved,
}: {
  group: FraudRuleGroup;
  rules: FraudRuleRow[];
  onSaved: (updated: FraudRuleRow[]) => void;
}) {
  const fields = group.fieldKeys
    .map((key) => rules.find((rule) => rule.key === key))
    .filter((rule): rule is FraudRuleRow => rule !== undefined);

  const serverDisplayValues = useMemo(
    () =>
      Object.fromEntries(
        fields.map((rule) => [rule.key, FRAUD_RULE_FIELD_META[rule.key].toDisplay(rule.value)])
      ),
    [fields]
  );

  const [draft, setDraft] = useState<Record<string, number>>(serverDisplayValues);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraft(serverDisplayValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules]);

  const isDirty = fields.some((rule) => draft[rule.key] !== serverDisplayValues[rule.key]);
  const lastUpdated = fields.reduce<string | null>(
    (latest, rule) => (!latest || rule.updatedAt > latest ? rule.updatedAt : latest),
    null
  );

  const handleSave = async () => {
    setError(null);
    setIsSaving(true);
    try {
      const changed = fields.filter((rule) => draft[rule.key] !== serverDisplayValues[rule.key]);
      const updates = await Promise.all(
        changed.map(async (rule) => {
          const meta = FRAUD_RULE_FIELD_META[rule.key];
          const response = await api.patch<ApiResponse<FraudRuleRow>>(`/admin/fraud-rules/${rule.key}`, {
            value: meta.toRaw(draft[rule.key]),
          });
          return unwrap(response.data);
        })
      );
      const updatedByKey = new Map(updates.map((rule) => [rule.key, rule]));
      onSaved(rules.map((rule) => updatedByKey.get(rule.key) ?? rule));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const Icon = group.icon;

  return (
    <div
      className="overflow-hidden rounded-2xl bg-white p-5 shadow-md"
      style={{ borderLeft: `4px solid ${group.color}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${group.color}1A`, color: group.color }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">{group.title}</h3>
            <div className="mt-0.5">
              <DotBadge tone={severityTone[group.severity] ?? 'gray'}>{humanizeEnum(group.severity)}</DotBadge>
            </div>
          </div>
        </div>
        {isDirty && (
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-[#16305C] to-[#4F46E5] px-3 py-1.5 text-xs font-semibold text-white transition-all duration-200 hover:scale-[1.03] disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? 'Saving…' : 'Save Changes'}
          </button>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-slate-500">{group.description}</p>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-4">
        {fields.map((rule) => {
          const meta = FRAUD_RULE_FIELD_META[rule.key];
          return (
            <div key={rule.key} className="min-w-[150px]">
              <label htmlFor={`fraud-rule-${rule.key}`} className="mb-1 block text-xs font-medium text-slate-600">
                {rule.label}
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={`fraud-rule-${rule.key}`}
                  type="number"
                  min={meta.min}
                  max={meta.max}
                  step={meta.step}
                  value={draft[rule.key] ?? serverDisplayValues[rule.key]}
                  onChange={(event) => {
                    const raw = Number(event.target.value);
                    const clamped = Number.isNaN(raw) ? meta.min : Math.min(meta.max, Math.max(meta.min, raw));
                    setDraft((prev) => ({ ...prev, [rule.key]: clamped }));
                  }}
                  className="w-24 rounded-[10px] border border-[#E2E8F0] bg-white px-2 py-2 text-sm text-slate-800 transition-colors focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <span className="text-xs text-slate-400">{meta.displayUnit}</span>
              </div>
            </div>
          );
        })}
      </div>

      {lastUpdated && <p className="mt-4 text-xs text-slate-400">Last updated {formatDateTime(lastUpdated)}</p>}
    </div>
  );
}

function FraudRulesSection() {
  const [rules, setRules] = useState<FraudRuleRow[]>([]);
  const [fraudStats, setFraudStats] = useState<AnalyticsResult['fraud'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [rulesResponse, analyticsResponse] = await Promise.all([
        api.get<ApiResponse<FraudRuleRow[]>>('/admin/fraud-rules'),
        api.get<ApiResponse<AnalyticsResult>>('/admin/analytics'),
      ]);
      setRules(unwrap(rulesResponse.data));
      setFraudStats(unwrap(analyticsResponse.data).fraud);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SectionCard
      title="Fraud Detection Rules"
      subtitle="Configure thresholds for the automated fraud detection system"
    >
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {isLoading ? (
        <p className="py-6 text-center text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="space-y-6">
          {fraudStats && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium text-slate-500">Total Alerts</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{fraudStats.total}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium text-slate-500">Resolution Rate</p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {Math.round(fraudStats.resolutionRate * 100)}%
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium text-slate-500">Most Triggered Rule</p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {fraudStats.mostCommon ? humanizeEnum(fraudStats.mostCommon) : '—'}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {FRAUD_RULE_GROUPS.map((group) => (
              <FraudRuleCard key={group.key} group={group} rules={rules} onSaved={setRules} />
            ))}
          </div>
        </div>
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
        <FraudRulesSection />
      </div>
    </div>
  );
}
