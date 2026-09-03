import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Banknote,
  CheckCircle2,
  Search,
  ShieldCheck,
  Users,
  UserSearch,
  Wallet,
  X,
} from 'lucide-react';
import type {
  ApiResponse,
  ProcessWithdrawalResult,
  StudentLookup,
  TransactionCategory,
  VerifiedStudentSummary,
  WithdrawalRequest,
} from '../types';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { AgentStatsCard } from '../components/AgentStatsCard';
import type { AgentStatsCardHandle } from '../components/AgentStatsCard';
import { useAuth } from '../context/AuthContext';
import { formatDateTime } from '../lib/format';
import { humanizeEnum } from '../lib/humanize';
import { useSocketRefetch } from '../hooks/useSocketRefetch';

function formatMoney(amount: string): string {
  return `$${Number(amount).toFixed(2)}`;
}

const SUCCESS_MESSAGE_TIMEOUT_MS = 4000;

function ReadyToDispenseSection({
  withdrawals,
  onDispensed,
}: {
  withdrawals: WithdrawalRequest[];
  onDispensed: () => void;
}) {
  const [dispensingId, setDispensingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (withdrawals.length === 0) return null;

  const handleDispense = async (request: WithdrawalRequest) => {
    setDispensingId(request.id);
    setError(null);
    try {
      await api.patch(`/withdrawals/${request.id}/complete`);
      onDispensed();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDispensingId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <Banknote className="h-4 w-4" />
        </div>
        <h2 className="text-sm font-bold text-slate-900">Ready to Dispense</h2>
        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">
          {withdrawals.length}
        </span>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="space-y-2">
        {withdrawals.map((request) => (
          <div
            key={request.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white px-4 py-3"
          >
            <div>
              <p className="text-sm font-semibold text-slate-900">{request.wallet.user.fullName}</p>
              <p className="text-xs text-slate-500">
                {formatMoney(request.amount)} · {humanizeEnum(request.category)}
                {request.approvedAt ? ` · Approved ${formatDateTime(request.approvedAt)}` : ''}
              </p>
            </div>
            <button
              type="button"
              disabled={dispensingId === request.id}
              onClick={() => void handleDispense(request)}
              className="rounded-full bg-primary px-3.5 py-1.5 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.03] hover:bg-primary-600 disabled:opacity-60 disabled:hover:scale-100"
            >
              {dispensingId === request.id ? 'Dispensing…' : 'Dispense Cash'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfirmDispenseModal({
  student,
  amount,
  category,
  onClose,
  onProcessed,
}: {
  student: StudentLookup;
  amount: number;
  category: TransactionCategory;
  onClose: () => void;
  onProcessed: (result: ProcessWithdrawalResult) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await api.post<ApiResponse<ProcessWithdrawalResult>>('/withdrawals/process', {
        studentEmail: student.user.email,
        amount,
        category,
      });
      onProcessed(unwrap(res.data));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title="Confirm Cash Withdrawal"
      subtitle="Verify the student's identity before dispensing"
      icon={<ShieldCheck className="h-6 w-6 text-white" />}
      tone="primary"
      onClose={onClose}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Confirm the student&apos;s identity before dispensing cash.
        </p>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="flex justify-between py-1">
            <span className="text-slate-500">Student</span>
            <span className="font-medium text-slate-900">{student.user.fullName}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-slate-500">Email</span>
            <span className="font-medium text-slate-900">{student.user.email}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-slate-500">Amount</span>
            <span className="font-medium text-slate-900">${amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-slate-500">Category</span>
            <span className="font-medium text-slate-900">{humanizeEnum(category)}</span>
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-all duration-200 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting}
            className="rounded-xl bg-gradient-to-r from-primary to-[#4a7fd4] px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
          >
            {isSubmitting ? 'Dispensing…' : 'Dispense Cash'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function initialsFor(fullName: string): string {
  return fullName
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function BrowseStudentsModal({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (student: VerifiedStudentSummary) => void;
}) {
  const [students, setStudents] = useState<VerifiedStudentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<ApiResponse<VerifiedStudentSummary[]>>('/withdrawals/verified-students');
        if (!cancelled) setStudents(unwrap(res.data));
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const trimmed = filter.trim().toLowerCase();
    if (!trimmed) return students;
    return students.filter(
      (candidate) =>
        candidate.fullName.toLowerCase().includes(trimmed) ||
        candidate.email.toLowerCase().includes(trimmed)
    );
  }, [students, filter]);

  return (
    <Modal
      title="Browse Students"
      subtitle="Every KYC-verified student — pick one to load into the form"
      icon={<Users className="h-6 w-6 text-white" />}
      tone="primary"
      onClose={onClose}
      maxWidthClassName="max-w-lg"
    >
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter by name or email"
          autoFocus
          className="w-full rounded-full border-2 border-slate-200 py-2.5 pl-10 pr-4 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="max-h-80 space-y-1.5 overflow-y-auto">
        {isLoading && <p className="py-6 text-center text-sm text-slate-400">Loading students…</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-400">No verified students match that search.</p>
        )}
        {!isLoading &&
          filtered.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => onSelect(candidate)}
              className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors hover:border-primary-100 hover:bg-primary-50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary">
                {initialsFor(candidate.fullName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{candidate.fullName}</p>
                <p className="truncate text-xs text-slate-500">{candidate.email}</p>
              </div>
              {candidate.studentNumber && (
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                  {candidate.studentNumber}
                </span>
              )}
            </button>
          ))}
      </div>
    </Modal>
  );
}

export function ProcessWithdrawal() {
  const { agent } = useAuth();
  const statsRef = useRef<AgentStatsCardHandle>(null);
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [student, setStudent] = useState<StudentLookup | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [category, setCategory] = useState<TransactionCategory | null>(null);
  const [amount, setAmount] = useState('');
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ text: string; tone: 'success' | 'info' } | null>(
    null
  );
  const [approvedWithdrawals, setApprovedWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [isBrowseOpen, setIsBrowseOpen] = useState(false);

  const loadApprovedWithdrawals = useCallback(async () => {
    try {
      const res = await api.get<ApiResponse<WithdrawalRequest[]>>('/withdrawals');
      setApprovedWithdrawals(unwrap(res.data).filter((request) => request.status === 'APPROVED'));
    } catch {
      // Non-critical — the section just stays empty/stale until the next successful refresh
      // rather than blocking the rest of the page on this fetch.
    }
  }, []);

  useEffect(() => {
    void loadApprovedWithdrawals();
  }, [loadApprovedWithdrawals]);

  useSocketRefetch(
    useCallback(() => {
      void loadApprovedWithdrawals();
      statsRef.current?.refresh();
    }, [loadApprovedWithdrawals])
  );

  // Only the success (green) banner times out on its own — the info (amber) one flags that a
  // withdrawal still needs parent approval, which the agent shouldn't lose track of just because
  // 4s passed. Both stay manually dismissible via the X button either way.
  useEffect(() => {
    if (resultMessage?.tone !== 'success') return;
    const timer = setTimeout(() => setResultMessage(null), SUCCESS_MESSAGE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [resultMessage]);

  // Shared by the search form, the "Browse Students" modal's row click, and the post-dispense
  // refresh — all three end up wanting the exact same "resolve this query to a StudentLookup"
  // round trip, just with a different source for the query string.
  const performLookup = useCallback(async (rawQuery: string) => {
    const trimmed = rawQuery.trim();
    if (!trimmed) return;
    setIsSearching(true);
    setSearchError(null);
    setStudent(null);
    setResultMessage(null);
    setHasSearched(true);
    try {
      const res = await api.get<ApiResponse<StudentLookup>>('/withdrawals/lookup-student', {
        params: { query: trimmed },
      });
      const found = unwrap(res.data);
      setStudent(found);
      setCategory(null);
      setAmount('');
    } catch (err) {
      setSearchError(getErrorMessage(err));
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Background refresh for the open student panel — deliberately separate from performLookup
  // above, which resets category/amount and briefly nulls student (to show its own loading
  // state) on every call. Neither is acceptable for a silent poll: it would wipe out whatever
  // category/amount the agent is mid-way through entering, and flash the panel closed, every
  // 10 seconds. This only updates the balance-derived fields on the already-open student, so a
  // card payment or P2P transfer the student makes elsewhere shows up here without disturbing
  // anything the agent is doing.
  const refreshStudentBalance = useCallback(async (email: string) => {
    try {
      const res = await api.get<ApiResponse<StudentLookup>>('/withdrawals/lookup-student', {
        params: { query: email },
      });
      setStudent(unwrap(res.data));
    } catch {
      // Silent — a failed background poll shouldn't surface an error banner; the next poll (or
      // the agent's own next lookup/dispense) will pick fresh data back up.
    }
  }, []);

  useEffect(() => {
    if (!student) return;
    const studentEmail = student.user.email;
    const interval = setInterval(() => {
      void refreshStudentBalance(studentEmail);
    }, 10000);
    return () => clearInterval(interval);
  }, [student, refreshStudentBalance]);

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    void performLookup(query);
  };

  const handleBrowseSelect = (candidate: VerifiedStudentSummary) => {
    setIsBrowseOpen(false);
    setQuery(candidate.email);
    void performLookup(candidate.email);
  };

  // GENERAL is always selectable (it draws from the free/unlocked wallet balance, not a
  // LockedFund row) — every other category only shows up once the parent has actually locked
  // money into it.
  const categoryOptions: Array<{ category: TransactionCategory; available: number }> = student
    ? [
        { category: 'GENERAL' as TransactionCategory, available: Number(student.freeBalance) },
        ...student.lockedFunds
          .filter((fund) => Number(fund.amount) > 0)
          .map((fund) => ({ category: fund.category, available: Number(fund.amount) })),
      ]
    : [];

  const availableForCategory = (cat: TransactionCategory | null): number => {
    if (!cat) return 0;
    return categoryOptions.find((option) => option.category === cat)?.available ?? 0;
  };

  const parsedAmount = Number(amount);
  const canDispense =
    student !== null &&
    category !== null &&
    parsedAmount > 0 &&
    parsedAmount <= availableForCategory(category);

  const handleProcessed = (result: ProcessWithdrawalResult) => {
    setConfirmVisible(false);

    // Re-run the same lookup for the student just dispensed to, instead of clearing the panel —
    // so the displayed wallet balance and per-category amounts reflect the dispense immediately,
    // with no manual refresh needed. Fired before the result banner below so its own
    // setResultMessage(null) doesn't wipe the message we're about to show.
    if (student) {
      void performLookup(student.user.email);
    }

    if (result.pending) {
      setResultMessage({
        text: `Withdrawal request for ${result.studentName} needs parent approval before it can be dispensed (GENERAL over their approval threshold). They'll be notified.`,
        tone: 'info',
      });
    } else {
      setResultMessage({
        text: `$${Number(result.request.amount).toFixed(2)} dispensed to ${result.studentName}. New balance: $${result.newBalance ?? '—'}.`,
        tone: 'success',
      });
    }
    setCategory(null);
    setAmount('');
    statsRef.current?.refresh();
    void loadApprovedWithdrawals();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Process Withdrawal"
        subtitle={`Welcome back, ${agent?.fullName ?? 'Agent'} — search for a student to dispense a cash withdrawal.`}
      />

      <ReadyToDispenseSection
        withdrawals={approvedWithdrawals}
        onDispensed={() => {
          void loadApprovedWithdrawals();
          statsRef.current?.refresh();
        }}
      />

      <AgentStatsCard ref={statsRef} />

      {resultMessage && (
        <div
          className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${
            resultMessage.tone === 'success'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-amber-50 text-amber-700'
          }`}
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{resultMessage.text}</span>
          <button
            type="button"
            onClick={() => setResultMessage(null)}
            aria-label="Dismiss"
            className="shrink-0 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary">
            <Search className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-bold text-slate-900">Find a Student</h2>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Student name, email, or student number"
              className="w-full rounded-full border-2 border-slate-200 py-2.5 pl-10 pr-4 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-primary-600 disabled:opacity-60 disabled:hover:scale-100"
          >
            {isSearching ? 'Searching…' : 'Search'}
          </button>
          <button
            type="button"
            onClick={() => setIsBrowseOpen(true)}
            className="flex items-center gap-1.5 rounded-full border-2 border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-all duration-200 hover:border-primary-200 hover:bg-primary-50 hover:text-primary"
          >
            <Users className="h-4 w-4" />
            Browse Students
          </button>
        </form>

        {searchError && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{searchError}</p>
        )}
      </div>

      {!hasSearched && !student && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white">
          <EmptyState
            icon={<UserSearch className="h-8 w-8" />}
            title="No student selected yet"
            message="Search by email or student number above to get started."
          />
        </div>
      )}

      {student && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary">
                {student.user.fullName
                  .split(/\s+/)
                  .map((part) => part[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>
              <div>
                <p className="text-base font-bold text-slate-900">{student.user.fullName}</p>
                <p className="text-sm text-slate-500">{student.user.email}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-1 text-xs text-slate-500">
                <Wallet className="h-3.5 w-3.5" />
                Wallet Balance
              </div>
              <p className="text-lg font-bold text-slate-900">{formatMoney(student.wallet.balance)}</p>
              <p className="mt-1 text-xs text-slate-500">Free (unlocked)</p>
              <p className="text-sm font-medium text-slate-700">{formatMoney(student.freeBalance)}</p>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-slate-700">Category</p>
            <div className="flex flex-wrap gap-2">
              {categoryOptions.map((option) => (
                <button
                  key={option.category}
                  type="button"
                  onClick={() => {
                    setCategory(option.category);
                    setAmount('');
                  }}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    category === option.category
                      ? 'bg-primary text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {humanizeEnum(option.category)} · ${option.available.toFixed(2)}
                </button>
              ))}
            </div>
            {categoryOptions.length === 1 && (
              <p className="mt-2 text-xs text-slate-400">
                No locked funds in any category — only General is available.
              </p>
            )}
          </div>

          {category && (
            <div className="mt-4 max-w-xs">
              <label htmlFor="amount" className="mb-1 block text-sm font-medium text-slate-700">
                Amount (available: ${availableForCategory(category).toFixed(2)})
              </label>
              <div className="flex items-center rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2.5 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary-100">
                <span className="text-lg font-bold text-slate-900">$</span>
                <input
                  id="amount"
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))}
                  className="w-full border-0 p-0 text-lg font-bold text-slate-900 focus:outline-none focus:ring-0"
                  placeholder="0.00"
                />
              </div>
              {parsedAmount > availableForCategory(category) && (
                <p className="mt-1 text-xs text-red-600">Amount exceeds available balance.</p>
              )}
              {category === 'GENERAL' &&
                student.approvalThreshold &&
                Number(student.approvalThreshold) > 0 &&
                parsedAmount > Number(student.approvalThreshold) && (
                  <p className="mt-1 text-xs text-amber-600">
                    Above the parent&apos;s approval threshold (${student.approvalThreshold}) — this
                    will need parent approval before it can be dispensed.
                  </p>
                )}
            </div>
          )}

          <div className="mt-6">
            <button
              type="button"
              disabled={!canDispense}
              onClick={() => setConfirmVisible(true)}
              className="rounded-xl bg-gradient-to-r from-primary to-[#4a7fd4] px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:hover:scale-100"
            >
              Dispense Cash
            </button>
          </div>
        </div>
      )}

      {confirmVisible && student && category && (
        <ConfirmDispenseModal
          student={student}
          amount={parsedAmount}
          category={category}
          onClose={() => setConfirmVisible(false)}
          onProcessed={handleProcessed}
        />
      )}

      {isBrowseOpen && (
        <BrowseStudentsModal onClose={() => setIsBrowseOpen(false)} onSelect={handleBrowseSelect} />
      )}
    </div>
  );
}
