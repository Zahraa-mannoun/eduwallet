import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { AcademicDocument, ApiResponse } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { Modal } from '../components/Modal';
import { formatDate } from '../lib/format';
import type { PendingKYCRow } from '../types/admin';

type KYCStudentRow = {
  userId: string;
  studentName: string;
  studentEmail: string;
  studentIdDoc: AcademicDocument | null;
  enrollmentDoc: AcademicDocument | null;
  submittedAt: string;
};

function toStudentRow(user: PendingKYCRow): KYCStudentRow {
  const studentIdDoc = user.documents.find((doc) => doc.documentType === 'STUDENT_ID') ?? null;
  const enrollmentDoc =
    user.documents.find((doc) => doc.documentType === 'ENROLLMENT_CERTIFICATE') ?? null;
  const submittedAt = user.documents.reduce<string>(
    (latest, doc) => (doc.createdAt > latest ? doc.createdAt : latest),
    user.createdAt
  );
  return {
    userId: user.id,
    studentName: user.fullName,
    studentEmail: user.email,
    studentIdDoc,
    enrollmentDoc,
    submittedAt,
  };
}

export function KYC() {
  const [rows, setRows] = useState<KYCStudentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<KYCStudentRow | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<ApiResponse<PendingKYCRow[]>>('/kyc/pending');
      const users = unwrap(response.data);
      setRows(users.map(toStudentRow));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const viewDocument = async (documentId: string) => {
    try {
      const response = await api.get(`/kyc/document/${documentId}/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data as Blob);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const approve = async (row: KYCStudentRow) => {
    setBusyUserId(row.userId);
    try {
      await api.post('/kyc/review', { userId: row.userId, decision: 'APPROVED' });
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Student Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Documents</th>
              <th className="px-4 py-3 text-left">Submitted</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No pending KYC submissions
                </td>
              </tr>
            )}
            {!isLoading &&
              rows.map((row) => (
                <tr key={row.userId}>
                  <td className="px-4 py-3 font-medium text-slate-900">{row.studentName}</td>
                  <td className="px-4 py-3 text-slate-600">{row.studentEmail}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {row.studentIdDoc ? (
                        <button
                          type="button"
                          onClick={() => void viewDocument(row.studentIdDoc!.id)}
                          className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          View Student ID
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">Student ID not uploaded</span>
                      )}
                      {row.enrollmentDoc ? (
                        <button
                          type="button"
                          onClick={() => void viewDocument(row.enrollmentDoc!.id)}
                          className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          View Enrollment Certificate
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">Enrollment certificate not uploaded</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(row.submittedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyUserId === row.userId}
                        onClick={() => void approve(row)}
                        className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busyUserId === row.userId}
                        onClick={() => setRejectTarget(row)}
                        className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {rejectTarget && (
        <RejectModal
          row={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onDone={() => {
            setRejectTarget(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function RejectModal({
  row,
  onClose,
  onDone,
}: {
  row: KYCStudentRow;
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
      await api.post('/kyc/review', { userId: row.userId, decision: 'REJECTED', reason });
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={`Reject KYC — ${row.studentName}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="reason" className="mb-1 block text-sm font-medium text-slate-700">
            Reason
          </label>
          <textarea
            id="reason"
            required
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
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
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {isSubmitting ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
