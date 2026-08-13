import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Currency } from '@eduwallet/shared';
import { api, getErrorMessage } from '../lib/api';
import { Modal } from './Modal';
import { CURRENCIES } from '../types/admin';

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
    <Modal title={`Add Funds to ${userName}`} onClose={onClose}>
      {success ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Funds added successfully.
        </p>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="amount" className="mb-1 block text-sm font-medium text-slate-700">
              Amount
            </label>
            <input
              id="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="currency" className="mb-1 block text-sm font-medium text-slate-700">
              Currency
            </label>
            <select
              id="currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value as Currency)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
            >
              {isSubmitting ? 'Adding…' : 'Confirm'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
