import type { BadgeTone } from '../components/Badge';

export const roleTone: Record<string, BadgeTone> = {
  STUDENT: 'blue',
  PARENT: 'green',
  INSTITUTION: 'purple',
  ADMIN: 'red',
};

export const kycTone: Record<string, BadgeTone> = {
  VERIFIED: 'green',
  PENDING: 'yellow',
  REJECTED: 'red',
};

export const severityTone: Record<string, BadgeTone> = {
  HIGH: 'red',
  MEDIUM: 'orange',
  LOW: 'yellow',
};

export const categoryTone: Record<string, BadgeTone> = {
  TUITION: 'blue',
  BOOKS: 'purple',
  FOOD: 'green',
  TRANSPORT: 'orange',
  SOFTWARE: 'blue',
  RENT: 'red',
  LIFESTYLE: 'pink',
  PERSONAL_SAVINGS: 'yellow',
  GENERAL: 'gray',
};

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

export const reportStatusTone: Record<string, BadgeTone> = {
  PENDING: 'yellow',
  GENERATED: 'blue',
  SENT: 'green',
};
