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

export const transactionStatusTone: Record<string, BadgeTone> = {
  AUTO_APPROVED: 'green',
  PENDING: 'yellow',
  REJECTED: 'red',
  APPROVED: 'blue',
  EMERGENCY: 'orange',
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
  LIFESTYLE: 'gray',
  PERSONAL_SAVINGS: 'yellow',
  GENERAL: 'gray',
};
