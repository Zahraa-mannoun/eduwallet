import { useState } from 'react';
import type { FormEvent } from 'react';
import { ChevronDown, Info, Wallet } from 'lucide-react';
import type { Currency } from '@eduwallet/shared';
import { api, getErrorMessage } from '../lib/api';
import { Modal } from './Modal';
import { CURRENCIES } from '../types/admin';

const CURRENCY_SYMBOLS: Record<Currency, string> = { USD: '$', EUR: '€', LBP: 'L£' };

export function AddFundsModal({
  userId,
  userName,
  defaultCurrency,
  onClose,
  onDone,
}: {
  userId: string;
  userName: string;
  defaultCurrency?: Currency;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>(defaultCurrency ?? 'USD');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Enter a valid amount greater than 0');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await api.patch(`/admin/users/${userId}/add-funds`, { amount: numericAmount, currency });
      setSuccess(true);
      setTimeout(onDone, 900);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title="Add Funds"
      subtitle={userName}
      icon={<Wallet className="h-6 w-6 text-white" />}
      tone="primary"
      onClose={onClose}
    >
      {success ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Funds added successfully.
        </p>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="amount" className="mb-1.5 block text-sm font-medium text-slate-700">
              Amount
            </label>
            <div className="flex items-center rounded-xl border-2 border-slate-200 bg-white transition-colors focus-within:border-blue-400">
              <span className="pl-3.5 text-lg font-semibold text-slate-400">
                {CURRENCY_SYMBOLS[currency]}
              </span>
              <input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                autoFocus
                placeholder="0.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="w-full border-none bg-transparent px-2 py-3 text-xl font-semibold text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-0"
              />
              <span className="pr-3.5 text-sm font-semibold text-slate-400">{currency}</span>
            </div>
          </div>

          <div>
            <label htmlFor="currency" className="mb-1.5 block text-sm font-medium text-slate-700">
              Currency
            </label>
            <div className="relative">
              <select
                id="currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value as Currency)}
                className="w-full appearance-none rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2.5 pr-9 text-sm text-slate-900 transition-colors focus:border-blue-400 focus:outline-none"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
            <p className="text-xs text-blue-700">
              Funds will be added directly to the user&apos;s wallet balance.
            </p>
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border-2 border-slate-200 px-6 py-3 text-sm font-semibold text-slate-600 transition-all duration-200 hover:scale-[1.02] hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-primary-600 disabled:opacity-60 disabled:hover:scale-100"
            >
              {isSubmitting ? 'Adding…' : 'Confirm'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
