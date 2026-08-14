import type { BadgeTone } from '../components/Badge';

export const withdrawalStatusTone: Record<string, BadgeTone> = {
  PENDING: 'gray',
  PENDING_PARENT_APPROVAL: 'yellow',
  APPROVED: 'blue',
  REJECTED: 'red',
  COMPLETED: 'green',
};

export const receiptStatusTone: Record<string, BadgeTone> = {
  NOT_UPLOADED: 'gray',
  PROCESSING: 'blue',
  PENDING: 'yellow',
  AUTO_VERIFIED: 'green',
  MANUALLY_VERIFIED: 'green',
  FLAGGED: 'orange',
  REJECTED: 'red',
};
