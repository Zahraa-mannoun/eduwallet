import { useState } from 'react';
import type { FormEvent } from 'react';
import { api, getErrorMessage } from '../lib/api';
import { Modal } from './Modal';
import type { AgentRow } from '../types/admin';

export function SendNotificationModal({
  agent,
  onClose,
  onDone,
}: {
  agent: AgentRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim()) {
      setError('A message is required');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await api.post(`/admin/agents/${agent.id}/notify`, { message });
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={`Send Notification — ${agent.fullName}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="notify-message" className="mb-1 block text-sm font-medium text-slate-700">
            Message
          </label>
          <textarea
            id="notify-message"
            required
            rows={3}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="What would you like to tell this agent?"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <p className="mt-1 text-xs text-slate-400">
            The agent will see this in their notifications bell in the agent portal.
          </p>
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
            {isSubmitting ? 'Sending…' : 'Send Notification'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
