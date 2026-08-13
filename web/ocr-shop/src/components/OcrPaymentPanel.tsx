import { useState, type FormEvent } from 'react';
import type { Category, UseCardResponseData } from '../types';
import { payWithCard } from '../services/cards';
import { getErrorMessage } from '../services/api';
import {
  formatCardNumberInput,
  formatCvvInput,
  formatExpiryInput,
  parseLockedCategoryFromError,
} from '../lib/format';
import { CATEGORY_META } from '../lib/ocr';
import { transactionStatusLabel } from '../lib/transactionStatus';

type PaymentStatus = 'idle' | 'processing' | 'success' | 'failed';

interface OcrPaymentPanelProps {
  category: Category;
  amount: number;
  index: number;
  onSuccess: () => void;
  // True when this category was already paid earlier in the same checkout session (restored
  // from sessionStorage by CheckoutPage) — the original transaction details aren't persisted,
  // just the fact that it's done, so the success view below falls back to a simpler message.
  initiallyPaid?: boolean;
}

const GENERIC_PAYMENT_ERROR = 'Payment failed. Please check your card details and try again.';

export function OcrPaymentPanel({
  category,
  amount,
  index,
  onSuccess,
  initiallyPaid = false,
}: OcrPaymentPanelProps) {
  const [cardNumber, setCardNumber] = useState('');
  const [cvv, setCvv] = useState('');
  const [expiry, setExpiry] = useState('');
  const [status, setStatus] = useState<PaymentStatus>(initiallyPaid ? 'success' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const [transaction, setTransaction] = useState<UseCardResponseData['transaction'] | null>(null);

  const meta = CATEGORY_META[category];
  const cardNumberValid = /^\d{4}-\d{4}-\d{4}-\d{4}$/.test(cardNumber);
  const cvvValid = /^\d{3}$/.test(cvv);
  const expiryValid = /^\d{2}\/\d{2}$/.test(expiry);
  const canSubmit = cardNumberValid && cvvValid && expiryValid && status !== 'processing';
  const last4 = cardNumber.replace(/-/g, '').slice(-4);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setStatus('processing');
    setError(null);
    try {
      const result = await payWithCard({ cardNumber, cvv, expiry, amount, category });
      setTransaction(result.transaction);
      setStatus('success');
      onSuccess();
    } catch (err) {
      const rawMessage = getErrorMessage(err);
      const lockedCategory = parseLockedCategoryFromError(rawMessage);
      setError(
        lockedCategory
          ? `Your ${lockedCategory} card cannot be used for ${category} purchases. Please use a ${category} card or a General card.`
          : rawMessage || GENERIC_PAYMENT_ERROR
      );
      setStatus('failed');
      // Don't leave credentials sitting in the form after a failed attempt.
      setCardNumber('');
      setCvv('');
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <h3 className="text-lg font-bold text-emerald-700">Payment Approved!</h3>
        {transaction ? (
          <dl className="mx-auto mt-3 max-w-xs space-y-1 text-left text-sm text-emerald-900">
            <div className="flex justify-between">
              <dt className="text-emerald-600">Amount Paid</dt>
              <dd className="font-medium">${Number(transaction.amount).toFixed(2)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-emerald-600">Detected Category</dt>
              <dd className="font-medium">
                {meta.emoji} {meta.label}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-emerald-600">Card Used</dt>
              <dd className="font-mono font-medium">•••• {last4}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-emerald-600">Transaction ID</dt>
              <dd className="truncate pl-2 font-mono text-xs">{transaction.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-emerald-600">Status</dt>
              <dd className="font-medium">{transactionStatusLabel(transaction.status)}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-emerald-700">
            {meta.label} was already paid for earlier in this checkout.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">Payment {index}</h3>
        <span className="rounded-full bg-primary-50 px-3 py-1 text-sm font-bold text-primary-700">
          ${amount.toFixed(2)}
        </span>
      </div>

      <div className="mt-3 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3">
        <p className="text-sm font-medium text-primary-800">
          We detected your purchase is for: {meta.emoji} {meta.label}
        </p>
      </div>

      <p className="mt-3 text-sm text-slate-500">Pay with EduWallet Virtual Card</p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Card Number</label>
          <input
            type="text"
            inputMode="numeric"
            value={cardNumber}
            onChange={(event) => setCardNumber(formatCardNumberInput(event.target.value))}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Expiry (MM/YY)</label>
            <input
              type="text"
              inputMode="numeric"
              value={expiry}
              onChange={(event) => setExpiry(formatExpiryInput(event.target.value))}
              placeholder="MM/YY"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">CVV</label>
            <input
              type="password"
              inputMode="numeric"
              value={cvv}
              onChange={(event) => setCvv(formatCvvInput(event.target.value))}
              placeholder="123"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
              required
            />
          </div>
        </div>

        {status === 'failed' && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
            <p className="text-sm font-semibold text-red-700">Payment Failed</p>
            <p className="text-xs text-red-600">{error || GENERIC_PAYMENT_ERROR}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'processing' && (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          )}
          {status === 'processing' ? 'Processing...' : `Pay $${amount.toFixed(2)}`}
        </button>
      </form>
    </div>
  );
}
