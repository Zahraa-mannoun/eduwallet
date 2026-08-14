import { useState } from 'react';
import type { FormEvent } from 'react';
import { Bell } from 'lucide-react';
import { api, getErrorMessage } from '../lib/api';
import { Modal } from './Modal';
import type { AgentRow } from '../types/admin';

const MAX_LENGTH = 500;

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
    <Modal
      title="Send Notification"
      subtitle={agent.fullName}
      icon={<Bell className="h-6 w-6 text-white" />}
      tone="primary"
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="notify-message" className="block text-sm font-medium text-slate-700">
              Message
            </label>
            <span
              className={`text-xs ${message.length > MAX_LENGTH ? 'font-semibold text-red-500' : 'text-slate-400'}`}
            >
              {message.length}/{MAX_LENGTH}
            </span>
          </div>
          <textarea
            id="notify-message"
            required
            rows={4}
            maxLength={MAX_LENGTH}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="What would you like to tell this agent?"
            className="w-full rounded-xl border-2 border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-400 focus:outline-none"
          />
          <p className="mt-1.5 text-xs text-slate-400">
            The agent will see this in their notifications bell in the agent portal.
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
            className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-primary-600 disabled:opacity-60 disabled:hover:scale-100"
          >
            {isSubmitting ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
