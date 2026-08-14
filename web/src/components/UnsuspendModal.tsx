import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
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
    <Modal
      title="Reactivate Account"
      subtitle={user.fullName}
      icon={<CheckCircle2 className="h-6 w-6 text-white" />}
      tone="success"
      onClose={onClose}
    >
      <p className="text-sm text-slate-600">
        Are you sure you want to reactivate <span className="font-medium text-slate-900">{user.fullName}</span>?
        Their account access will be restored immediately.
      </p>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="rounded-xl border-2 border-slate-200 px-6 py-3 text-sm font-semibold text-slate-600 transition-all duration-200 hover:scale-[1.02] hover:bg-slate-50 disabled:opacity-60 disabled:hover:scale-100"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={isSubmitting}
          className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-700 disabled:opacity-60 disabled:hover:scale-100"
        >
          {isSubmitting ? 'Reactivating…' : 'Reactivate'}
        </button>
      </div>
    </Modal>
  );
}
