import { useState } from 'react';
import type { FormEvent } from 'react';
import { UserX } from 'lucide-react';
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
    <Modal
      title="Deactivate Agent"
      subtitle={agent.fullName}
      icon={<UserX className="h-6 w-6 text-white" />}
      tone="danger"
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="deactivate-reason" className="mb-1.5 block text-sm font-medium text-slate-700">
            Reason
          </label>
          <textarea
            id="deactivate-reason"
            required
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why is this agent being deactivated?"
            className="w-full rounded-xl border-2 border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-400 focus:outline-none"
          />
          <p className="mt-1.5 text-xs text-slate-400">
            The agent will be logged out immediately and shown this reason if they try to sign
            back in.
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
            className="rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-red-700 disabled:opacity-60 disabled:hover:scale-100"
          >
            {isSubmitting ? 'Deactivating…' : 'Deactivate'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
