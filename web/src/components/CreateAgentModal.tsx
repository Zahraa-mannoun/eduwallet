import { useState } from 'react';
import type { FormEvent } from 'react';
import { api, getErrorMessage } from '../lib/api';
import { Modal } from './Modal';

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.24 4.24M9.4 5.5A9.6 9.6 0 0 1 12 5c6 0 9.5 7 9.5 7a13.8 13.8 0 0 1-3.2 4.15M6.3 6.9C4 8.5 2.5 12 2.5 12a13.7 13.7 0 0 0 4.15 4.9"
      />
    </svg>
  );
}

function generateEmail(fullName: string): string {
  const slug = fullName
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join('.');
  return slug ? `${slug}@eduwallet-agent.com` : '';
}

function generatePassword(): string {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return `Agent@${digits}`;
}

export function CreateAgentModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailEdited, setEmailEdited] = useState(false);
  const [passwordEdited, setPasswordEdited] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFullNameChange = (value: string) => {
    setFullName(value);
    if (!emailEdited) {
      setEmail(generateEmail(value));
    }
    if (!passwordEdited && !password) {
      setPassword(generatePassword());
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post('/admin/agents', { fullName, email, password });
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Create Agent" onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit} autoComplete="off">
        {/* Chrome ignores autoComplete="off" on real fields it thinks are a login form —
            these decoys sit first in the DOM so its autofill heuristics target them instead
            of the actual name/email/password inputs below. Kept out of tab order and hidden
            from screen readers since they're never meant to be seen or filled by a person. */}
        <input
          type="text"
          name="fake-name"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ display: 'none' }}
        />
        <input
          type="password"
          name="fake-password"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ display: 'none' }}
        />

        <div>
          <label htmlFor="agent-name" className="mb-1 block text-sm font-medium text-slate-700">
            Full Name
          </label>
          <input
            id="agent-name"
            type="text"
            required
            autoComplete="off"
            value={fullName}
            onChange={(event) => handleFullNameChange(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label htmlFor="agent-email" className="mb-1 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="agent-email"
            type="email"
            required
            autoComplete="off"
            value={email}
            onChange={(event) => {
              setEmailEdited(true);
              setEmail(event.target.value);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <p className="mt-1 text-xs text-slate-400">Auto-generated from the name — editable.</p>
        </div>

        <div>
          <label htmlFor="agent-password" className="mb-1 block text-sm font-medium text-slate-700">
            Password
          </label>
          <div className="relative">
            <input
              id="agent-password"
              type={passwordVisible ? 'text' : 'password'}
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => {
                setPasswordEdited(true);
                setPassword(event.target.value);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-9 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => setPasswordVisible((visible) => !visible)}
              className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-slate-400 hover:text-slate-600"
              aria-label={passwordVisible ? 'Hide password' : 'Show password'}
            >
              <EyeIcon open={passwordVisible} />
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-400">Auto-generated — editable.</p>
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
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
          >
            {isSubmitting ? 'Creating…' : 'Create Agent'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
