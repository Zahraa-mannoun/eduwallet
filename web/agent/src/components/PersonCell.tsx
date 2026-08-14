import type { ReactNode } from 'react';
import { Avatar } from './Avatar';

// The "avatar + name (+ inline extras) + email below" layout shared by every people-listing
// table in the portal.
export function PersonCell({
  name,
  email,
  extra,
}: {
  name: string;
  email: string;
  extra?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={name} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium text-slate-900">{name}</span>
          {extra}
        </div>
        <p className="truncate text-xs text-slate-500">{email}</p>
      </div>
    </div>
  );
}
