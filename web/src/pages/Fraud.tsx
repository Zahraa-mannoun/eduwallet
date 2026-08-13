import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { ApiResponse } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { useSocketRefetch } from '../hooks/useSocketRefetch';
import { severityTone } from '../lib/badgeTones';
import { formatDateTime, formatMoney } from '../lib/format';
import type { FraudAlertRow } from '../types/admin';

export function Fraud() {
  const [alerts, setAlerts] = useState<FraudAlertRow[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [resolveTarget, setResolveTarget] = useState<FraudAlertRow | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<ApiResponse<FraudAlertRow[]>>('/admin/fraud-alerts', {
        params: showAll ? {} : { resolved: 'false' },
      });
      setAlerts(unwrap(response.data));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [showAll]);

  useEffect(() => {
    void load();
  }, [load]);

  useVisibilityRefetch(load);
  useSocketRefetch(load);

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            !showAll ? 'bg-primary text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          Unresolved only
        </button>
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            showAll ? 'bg-primary text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          All
        </button>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Severity</th>
              <th className="px-4 py-3 text-left">Amount</th>
              <th className="px-4 py-3 text-left">From User</th>
              <th className="px-4 py-3 text-left">To User</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && alerts.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                  No fraud alerts found
                </td>
              </tr>
            )}
            {!isLoading &&
              alerts.map((alert) => (
                <tr key={alert.id}>
                  <td className="px-4 py-3">
                    <Badge tone="gray">{alert.alertType}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={severityTone[alert.severity] ?? 'gray'}>{alert.severity}</Badge>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {formatMoney(alert.transaction.amount, alert.transaction.currency)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {alert.transaction.fromWallet?.user.fullName ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {alert.transaction.toWallet?.user.fullName ?? alert.transaction.receiverName ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDateTime(alert.createdAt)}</td>
                  <td className="px-4 py-3">
                    {alert.resolved ? (
                      <Badge tone="green">Resolved</Badge>
                    ) : (
                      <Badge tone="yellow">Open</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!alert.resolved && (
                      <button
                        type="button"
                        onClick={() => setResolveTarget(alert)}
                        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Resolve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {resolveTarget && (
        <ResolveModal
          alert={resolveTarget}
          onClose={() => setResolveTarget(null)}
          onDone={() => {
            setResolveTarget(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function ResolveModal({
  alert,
  onClose,
  onDone,
}: {
  alert: FraudAlertRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!note.trim()) {
      setError('A resolution note is required');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await api.patch(`/admin/fraud-alerts/${alert.id}/resolve`, { note });
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Resolve Fraud Alert" onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="note" className="mb-1 block text-sm font-medium text-slate-700">
            Resolution note
          </label>
          <textarea
            id="note"
            required
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
          >
            {isSubmitting ? 'Resolving…' : 'Resolve'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
