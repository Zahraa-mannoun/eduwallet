import { useState } from 'react';
import type { FormEvent } from 'react';
import { api, getErrorMessage } from '../lib/api';
import { Modal } from './Modal';
import type { AgentRow } from '../types/admin';

export function DeactivateAgentModal({
  agent,
  onClose,
  onDone,
}: {
  agent: AgentRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!reason.trim()) {
      setError('A reason is required');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await api.delete(`/admin/agents/${agent.id}`, { data: { reason } });
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={`Deactivate Agent — ${agent.fullName}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="deactivate-reason" className="mb-1 block text-sm font-medium text-slate-700">
            Reason
          </label>
          <textarea
            id="deactivate-reason"
            required
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why is this agent being deactivated?"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <p className="mt-1 text-xs text-slate-400">
            The agent will be logged out immediately and shown this reason if they try to sign
            back in.
          </p>
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
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {isSubmitting ? 'Deactivating…' : 'Deactivate'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
