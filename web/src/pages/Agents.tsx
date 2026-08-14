import { useCallback, useEffect, useState } from 'react';
import { Bell, Briefcase, RotateCcw, UserX } from 'lucide-react';
import type { ApiResponse } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { CreateAgentModal } from '../components/CreateAgentModal';
import { DeactivateAgentModal } from '../components/DeactivateAgentModal';
import { SendNotificationModal } from '../components/SendNotificationModal';
import { DotBadge } from '../components/DotBadge';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { PersonCell } from '../components/PersonCell';
import { SkeletonRows } from '../components/SkeletonRows';
import { TableCard, TABLE_HEAD_ROW_CLASS, TABLE_TD_CLASS, TABLE_TH_CLASS, tableRowClass } from '../components/TableCard';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { formatDate } from '../lib/format';
import type { AgentRow } from '../types/admin';

export function Agents() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyAgentId, setBusyAgentId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<AgentRow | null>(null);
  const [notifyTarget, setNotifyTarget] = useState<AgentRow | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<ApiResponse<AgentRow[]>>('/admin/agents');
      setAgents(unwrap(response.data));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useVisibilityRefetch(load);

  const handleReactivate = async (agent: AgentRow) => {
    setBusyAgentId(agent.id);
    setError(null);
    try {
      await api.patch(`/admin/agents/${agent.id}/reactivate`);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyAgentId(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Agents"
        subtitle="Agent accounts that process cash withdrawals from the agent portal"
        actions={
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-primary-600"
          >
            Create Agent
          </button>
        }
      />

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <TableCard title="All Agents" subtitle={`${agents.length} agents`}>
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className={TABLE_HEAD_ROW_CLASS}>
            <tr>
              <th className={TABLE_TH_CLASS}>Agent</th>
              <th className={TABLE_TH_CLASS}>Created</th>
              <th className={TABLE_TH_CLASS}>Withdrawals Processed</th>
              <th className={TABLE_TH_CLASS}>Status</th>
              <th className={TABLE_TH_CLASS}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <SkeletonRows columns={5} />}
            {!isLoading && agents.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EmptyState
                    icon={<Briefcase className="h-8 w-8" />}
                    title="No agents yet"
                    message="Create an agent to start processing cash withdrawals."
                  />
                </td>
              </tr>
            )}
            {!isLoading &&
              agents.map((agent, index) => (
                <tr key={agent.id} className={tableRowClass(index)}>
                  <td className={TABLE_TD_CLASS}>
                    <PersonCell name={agent.fullName} email={agent.email} />
                  </td>
                  <td className={`${TABLE_TD_CLASS} text-slate-500`}>{formatDate(agent.createdAt)}</td>
                  <td className={`${TABLE_TD_CLASS} text-slate-600`}>{agent.withdrawalsCount}</td>
                  <td className={TABLE_TD_CLASS}>
                    <DotBadge tone={agent.suspended ? 'red' : 'green'}>
                      <span title={agent.suspensionReason ?? undefined}>
                        {agent.suspended ? 'Suspended' : 'Active'}
                      </span>
                    </DotBadge>
                  </td>
                  <td className={TABLE_TD_CLASS}>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setNotifyTarget(agent)}
                        className="inline-flex items-center gap-1.5 rounded-full border-2 border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold text-primary transition-all duration-200 hover:scale-[1.03] hover:bg-primary-100"
                      >
                        <Bell className="h-3.5 w-3.5" />
                        Notify
                      </button>
                      {agent.suspended ? (
                        <button
                          type="button"
                          disabled={busyAgentId === agent.id}
                          onClick={() => void handleReactivate(agent)}
                          className="inline-flex items-center gap-1.5 rounded-full border-2 border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-600 transition-all duration-200 hover:scale-[1.03] hover:bg-emerald-50 disabled:opacity-50"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Reactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyAgentId === agent.id}
                          onClick={() => setDeactivateTarget(agent)}
                          className="inline-flex items-center gap-1.5 rounded-full border-2 border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition-all duration-200 hover:scale-[1.03] hover:bg-red-50 disabled:opacity-50"
                        >
                          <UserX className="h-3.5 w-3.5" />
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </TableCard>

      {createModalOpen && (
        <CreateAgentModal
          onClose={() => setCreateModalOpen(false)}
          onDone={() => {
            setCreateModalOpen(false);
            void load();
          }}
        />
      )}

      {deactivateTarget && (
        <DeactivateAgentModal
          agent={deactivateTarget}
          onClose={() => setDeactivateTarget(null)}
          onDone={() => {
            setDeactivateTarget(null);
            void load();
          }}
        />
      )}

      {notifyTarget && (
        <SendNotificationModal
          agent={notifyTarget}
          onClose={() => setNotifyTarget(null)}
          onDone={() => setNotifyTarget(null)}
        />
      )}
    </div>
  );
}
