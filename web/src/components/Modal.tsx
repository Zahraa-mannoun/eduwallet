import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export type ModalTone = 'neutral' | 'primary' | 'danger' | 'success';

const HEADER_GRADIENT: Record<ModalTone, string> = {
  neutral: '',
  primary: 'bg-gradient-to-r from-blue-500 to-indigo-500',
  danger: 'bg-gradient-to-r from-red-500 to-rose-500',
  success: 'bg-gradient-to-r from-emerald-500 to-teal-500',
};

// The shell every modal in the app is built on. tone/icon/subtitle are optional — callers that
// only pass title/onClose/children (most of the app, e.g. KYC's Approve/Reject confirmations,
// Dashboard's rollover trigger) still get the rounded-2xl/shadow-2xl/backdrop-blur/animation
// upgrade with a plain white header, same as before. Callers that DO pass a tone+icon (the
// account-action modals — suspend, unsuspend, add funds, ...) get the full gradient header.
export function Modal({
  title,
  subtitle,
  icon,
  tone = 'neutral',
  onClose,
  children,
  maxWidthClassName = 'max-w-md',
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  tone?: ModalTone;
  onClose: () => void;
  children: ReactNode;
  maxWidthClassName?: string;
}) {
  const isColored = tone !== 'neutral';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className={`animate-modal-in w-full ${maxWidthClassName} overflow-hidden rounded-2xl bg-white shadow-2xl`}
      >
        <div
          className={`flex items-start justify-between gap-3 px-6 py-5 ${
            isColored ? `${HEADER_GRADIENT[tone]} text-white` : 'border-b border-slate-200'
          }`}
        >
          <div className="flex items-start gap-3.5">
            {icon && (
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                  isColored ? 'bg-white/20' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {icon}
              </div>
            )}
            <div>
              <h2 className={`text-lg font-bold ${isColored ? 'text-white' : 'text-slate-900'}`}>
                {title}
              </h2>
              {subtitle && (
                <p className={`text-sm ${isColored ? 'text-white/80' : 'text-slate-500'}`}>{subtitle}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`rounded p-1 transition-colors ${
              isColored
                ? 'text-white/80 hover:bg-white/20 hover:text-white'
                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
            }`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
