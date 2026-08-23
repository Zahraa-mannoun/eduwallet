import { Fragment, useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';
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

type Filter = 'unresolved' | 'resolved' | 'all';

// Static, human-readable descriptions of what each check actually does — the real thresholds are
// admin-configurable now (Settings > Fraud Detection Rules), so this stays deliberately
// approximate ("typically") rather than a number that can drift out of sync with what an admin
// has since changed.
const ALERT_TYPE_EXPLANATIONS: Record<string, string> = {
  DUPLICATE:
    'The same amount was sent to the same recipient again within a short window (typically 30 seconds) — usually an accidental double-tap on the send button rather than a second real payment.',
  VELOCITY:
    'This wallet made an unusually high number of transfers in a short window (typically 5+ within 10 minutes) — a pattern common to a compromised account or automated abuse.',
  CIRCULAR:
    'Money was sent right back to where it came from within a short window (typically within 1 hour) — a pattern often used to launder funds or artificially inflate activity.',
  UNUSUAL_AMOUNT:
    "This payment was significantly larger than the sender's own average (typically 3x+) and went to a recipient they have no prior history with.",
};

export function Fraud() {
  const [alerts, setAlerts] = useState<FraudAlertRow[]>([]);
  const [filter, setFilter] = useState<Filter>('unresolved');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [resolveTarget, setResolveTarget] = useState<FraudAlertRow | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<ApiResponse<FraudAlertRow[]>>('/admin/fraud-alerts', {
        params: filter === 'all' ? {} : { resolved: filter === 'resolved' ? 'true' : 'false' },
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
              { value: 'resolved', label: 'Resolved only' },
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
              <th className={TABLE_TH_CLASS} />
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
            {isLoading && <SkeletonRows columns={8} />}
            {!isLoading && alerts.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <EmptyState icon={<ShieldAlert className="h-8 w-8" />} title="No fraud alerts found" />
                </td>
              </tr>
            )}
            {!isLoading &&
              alerts.map((alert, index) => {
                const party = alert.transaction.fromWallet?.user ?? alert.transaction.toWallet?.user;
                const isExpanded = expandedId === alert.id;
                return (
                  <Fragment key={alert.id}>
                    <tr className={tableRowClass(index)}>
                      <td className={TABLE_TD_CLASS}>
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                          title="View details"
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </td>
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
                    {isExpanded && (
                      <tr className="bg-slate-50">
                        <td colSpan={8} className="px-6 py-4">
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Transaction Details
                              </p>
                              <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                                <p>
                                  <span className="text-slate-400">Amount: </span>
                                  {formatMoney(alert.transaction.amount, alert.transaction.currency)}
                                </p>
                                <p>
                                  <span className="text-slate-400">Category: </span>
                                  {humanizeEnum(alert.transaction.category)}
                                </p>
                                <p>
                                  <span className="text-slate-400">Date: </span>
                                  {formatDateTime(alert.transaction.createdAt)}
                                </p>
                              </div>
                            </div>

                            <div>
                              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Why This Was Flagged
                              </p>
                              <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                                <span className="font-semibold text-slate-800">{humanizeEnum(alert.alertType)}: </span>
                                {ALERT_TYPE_EXPLANATIONS[alert.alertType] ?? 'No description available for this alert type.'}
                              </div>
                            </div>

                            {alert.resolved && (
                              <div className="md:col-span-2">
                                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-600">
                                  Resolution
                                </p>
                                <div className="rounded-xl border-l-4 border-l-emerald-400 bg-emerald-50 p-3 text-sm text-slate-700">
                                  Resolved by Admin{alert.resolutionNote ? ` • ${alert.resolutionNote}` : ''}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
