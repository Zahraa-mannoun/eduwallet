import { useState } from 'react';
import type { FormEvent } from 'react';
import type { ApiResponse, ProcessWithdrawalResult, StudentLookup, TransactionCategory } from '../types';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { Modal } from '../components/Modal';

function formatMoney(amount: string): string {
  return `$${Number(amount).toFixed(2)}`;
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
    <Modal title="Confirm Cash Withdrawal" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Confirm the student&apos;s identity before dispensing cash.
        </p>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
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
            <span className="font-medium text-slate-900">{category}</span>
          </div>
        </div>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
          >
            {isSubmitting ? 'Dispensing…' : 'Dispense Cash'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function ProcessWithdrawal() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [student, setStudent] = useState<StudentLookup | null>(null);

  const [category, setCategory] = useState<TransactionCategory | null>(null);
  const [amount, setAmount] = useState('');
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ text: string; tone: 'success' | 'info' } | null>(
    null
  );

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    setSearchError(null);
    setStudent(null);
    setResultMessage(null);
    try {
      const res = await api.get<ApiResponse<StudentLookup>>('/withdrawals/lookup-student', {
        params: { query: query.trim() },
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
  };

  // GENERAL is always selectable (it draws from the free wallet balance, not a LockedFund
  // row) — every other category only shows up once the parent has actually locked money
  // into it.
  const categoryOptions: Array<{ category: TransactionCategory; available: number }> = student
    ? [
        { category: 'GENERAL' as TransactionCategory, available: Number(student.wallet.balance) },
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
    setStudent(null);
    setQuery('');
    setCategory(null);
    setAmount('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Process Withdrawal</h1>
        <p className="mt-1 text-sm text-slate-500">
          Search for a student to dispense cash from their wallet.
        </p>
      </div>

      {resultMessage && (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            resultMessage.tone === 'success'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-amber-50 text-amber-700'
          }`}
        >
          {resultMessage.text}
        </p>
      )}

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Student email or student number"
          className="w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={isSearching || !query.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
        >
          {isSearching ? 'Searching…' : 'Search'}
        </button>
      </form>

      {searchError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{searchError}</p>}

      {student && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <p className="text-base font-semibold text-slate-900">{student.user.fullName}</p>
              <p className="text-sm text-slate-500">{student.user.email}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Wallet Balance</p>
              <p className="text-lg font-semibold text-slate-900">{formatMoney(student.wallet.balance)}</p>
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
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    category === option.category
                      ? 'bg-primary text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {option.category} · ${option.available.toFixed(2)}
                </button>
              ))}
            </div>
            {categoryOptions.length === 1 && (
              <p className="mt-2 text-xs text-slate-400">
                No locked funds in any category — only GENERAL is available.
              </p>
            )}
          </div>

          {category && (
            <div className="mt-4 max-w-xs">
              <label htmlFor="amount" className="mb-1 block text-sm font-medium text-slate-700">
                Amount (available: ${availableForCategory(category).toFixed(2)})
              </label>
              <input
                id="amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="0.00"
              />
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
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
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
    </div>
  );
}
