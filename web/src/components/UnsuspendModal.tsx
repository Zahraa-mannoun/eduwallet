import { useState } from 'react';
import { api, getErrorMessage } from '../lib/api';
import { Modal } from './Modal';

export function UnsuspendModal({
  user,
  onClose,
  onDone,
}: {
  user: { id: string; fullName: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await api.patch(`/admin/users/${user.id}/unsuspend`);
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={`Unsuspend Account — ${user.fullName}`} onClose={onClose}>
      <p className="text-sm text-slate-600">
        Are you sure you want to unsuspend {user.fullName}? Their account access will be
        restored immediately.
      </p>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={isSubmitting}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {isSubmitting ? 'Unsuspending…' : 'Confirm'}
        </button>
      </div>
    </Modal>
  );
}
