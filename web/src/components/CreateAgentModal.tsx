import { useState } from 'react';
import type { FormEvent } from 'react';
import { Eye, EyeOff, Lock, Mail, User, UserPlus } from 'lucide-react';
import { api, getErrorMessage } from '../lib/api';
import { Modal } from './Modal';

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
    <Modal
      title="Create Agent"
      subtitle="New agent portal account"
      icon={<UserPlus className="h-6 w-6 text-white" />}
      tone="primary"
      onClose={onClose}
    >
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
          <label htmlFor="agent-name" className="mb-1.5 block text-sm font-medium text-slate-700">
            Full Name
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="agent-name"
              type="text"
              required
              autoComplete="off"
              value={fullName}
              onChange={(event) => handleFullNameChange(event.target.value)}
              className="w-full rounded-xl border-2 border-slate-200 py-2.5 pl-10 pr-3.5 text-sm transition-colors focus:border-blue-400 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label htmlFor="agent-email" className="mb-1.5 block text-sm font-medium text-slate-700">
            Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
              className="w-full rounded-xl border-2 border-slate-200 py-2.5 pl-10 pr-3.5 text-sm transition-colors focus:border-blue-400 focus:outline-none"
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-400">Auto-generated from the name — editable.</p>
        </div>

        <div>
          <label htmlFor="agent-password" className="mb-1.5 block text-sm font-medium text-slate-700">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
              className="w-full rounded-xl border-2 border-slate-200 py-2.5 pl-10 pr-9 text-sm transition-colors focus:border-blue-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setPasswordVisible((visible) => !visible)}
              className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-slate-400 hover:text-slate-600"
              aria-label={passwordVisible ? 'Hide password' : 'Show password'}
            >
              {passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-slate-400">Auto-generated — editable.</p>
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
            {isSubmitting ? 'Creating…' : 'Create Agent'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
