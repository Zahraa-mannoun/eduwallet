import { useCallback, useEffect, useState } from 'react';
import type { ApiResponse } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { CreateAgentModal } from '../components/CreateAgentModal';
import { DeactivateAgentModal } from '../components/DeactivateAgentModal';
import { SendNotificationModal } from '../components/SendNotificationModal';
import { EmptyState } from '../components/EmptyState';
import { SkeletonRows } from '../components/SkeletonRows';
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Agents</h1>
          <p className="mt-1 text-sm text-slate-500">
            Agent accounts that process cash withdrawals from the agent portal.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600"
        >
          Create Agent
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3 text-left">Withdrawals Processed</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <SkeletonRows columns={6} />}
            {!isLoading && agents.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <EmptyState title="No agents yet" message="Create an agent to start processing cash withdrawals." />
                </td>
              </tr>
            )}
            {!isLoading &&
              agents.map((agent) => (
                <tr key={agent.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{agent.fullName}</td>
                  <td className="px-4 py-3 text-slate-600">{agent.email}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(agent.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-600">{agent.withdrawalsCount}</td>
                  <td className="px-4 py-3">
                    {agent.suspended ? (
                      <span
                        className="text-xs font-medium text-red-500"
                        title={agent.suspensionReason ?? undefined}
                      >
                        Deactivated
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-emerald-600">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setNotifyTarget(agent)}
                        className="rounded-lg border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-100"
                      >
                        Send Notification
                      </button>
                      {agent.suspended ? (
                        <button
                          type="button"
                          disabled={busyAgentId === agent.id}
                          onClick={() => void handleReactivate(agent)}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          Reactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyAgentId === agent.id}
                          onClick={() => setDeactivateTarget(agent)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

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
