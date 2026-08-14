import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';
import type { ApiResponse } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { Modal } from '../components/Modal';
import { DotBadge } from '../components/DotBadge';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { useSocketRefetch } from '../hooks/useSocketRefetch';
import { severityTone } from '../lib/badgeTones';
import { formatDateTime, formatMoney } from '../lib/format';
import { humanizeEnum } from '../lib/humanize';
import { EmptyState } from '../components/EmptyState';
import { FilterTabs } from '../components/FilterTabs';
import { PageHeader } from '../components/PageHeader';
import { PersonCell } from '../components/PersonCell';
import { SkeletonRows } from '../components/SkeletonRows';
import { TableCard, TABLE_HEAD_ROW_CLASS, TABLE_TD_CLASS, TABLE_TH_CLASS, tableRowClass } from '../components/TableCard';
import type { FraudAlertRow } from '../types/admin';

type Filter = 'unresolved' | 'all';

export function Fraud() {
  const [alerts, setAlerts] = useState<FraudAlertRow[]>([]);
  const [filter, setFilter] = useState<Filter>('unresolved');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [resolveTarget, setResolveTarget] = useState<FraudAlertRow | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<ApiResponse<FraudAlertRow[]>>('/admin/fraud-alerts', {
        params: filter === 'all' ? {} : { resolved: 'false' },
      });
      setAlerts(unwrap(response.data));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  useVisibilityRefetch(load);
  useSocketRefetch(load);

  return (
    <div className="space-y-4">
      <PageHeader title="Fraud Alerts" subtitle="Review and resolve suspicious transaction activity" />

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <TableCard
        title="Alerts"
        subtitle={`${alerts.length} shown`}
        actions={
          <FilterTabs
            tabs={[
              { value: 'unresolved', label: 'Unresolved only' },
              { value: 'all', label: 'All' },
            ]}
            value={filter}
            onChange={setFilter}
          />
        }
      >
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className={TABLE_HEAD_ROW_CLASS}>
            <tr>
              <th className={TABLE_TH_CLASS}>Student</th>
              <th className={TABLE_TH_CLASS}>Alert Type</th>
              <th className={TABLE_TH_CLASS}>Severity</th>
              <th className={TABLE_TH_CLASS}>Amount</th>
              <th className={TABLE_TH_CLASS}>Date</th>
              <th className={TABLE_TH_CLASS}>Resolved</th>
              <th className={TABLE_TH_CLASS}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <SkeletonRows columns={7} />}
            {!isLoading && alerts.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState icon={<ShieldAlert className="h-8 w-8" />} title="No fraud alerts found" />
                </td>
              </tr>
            )}
            {!isLoading &&
              alerts.map((alert, index) => {
                const party = alert.transaction.fromWallet?.user ?? alert.transaction.toWallet?.user;
                return (
                  <tr key={alert.id} className={tableRowClass(index)}>
                    <td className={TABLE_TD_CLASS}>
                      {party ? (
                        <PersonCell name={party.fullName} email={party.email} />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className={TABLE_TD_CLASS}>
                      <span className="inline-flex items-center gap-1.5 text-slate-700">
                        <AlertTriangle className="h-3.5 w-3.5 text-slate-400" />
                        {humanizeEnum(alert.alertType)}
                      </span>
                    </td>
                    <td className={TABLE_TD_CLASS}>
                      <DotBadge tone={severityTone[alert.severity] ?? 'gray'}>
                        {humanizeEnum(alert.severity)}
                      </DotBadge>
                    </td>
                    <td className={`${TABLE_TD_CLASS} font-bold text-slate-900`}>
                      {formatMoney(alert.transaction.amount, alert.transaction.currency)}
                    </td>
                    <td className={`${TABLE_TD_CLASS} text-slate-500`}>{formatDateTime(alert.createdAt)}</td>
                    <td className={TABLE_TD_CLASS}>
                      {alert.resolved ? (
                        <DotBadge tone="green">Resolved</DotBadge>
                      ) : (
                        <DotBadge tone="red">Active</DotBadge>
                      )}
                    </td>
                    <td className={TABLE_TD_CLASS}>
                      {!alert.resolved && (
                        <button
                          type="button"
                          onClick={() => setResolveTarget(alert)}
                          className="inline-flex items-center gap-1.5 rounded-full border-2 border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-600 transition-all duration-200 hover:scale-[1.03] hover:bg-emerald-50"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </TableCard>

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
    <Modal
      title="Resolve Fraud Alert"
      tone="success"
      icon={<CheckCircle className="h-6 w-6 text-white" />}
      onClose={onClose}
    >
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
            className="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm transition-colors focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border-2 border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-all duration-200 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-700 disabled:opacity-60"
          >
            {isSubmitting ? 'Resolving…' : 'Resolve'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
