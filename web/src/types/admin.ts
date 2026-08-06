import type {
  AcademicDocument,
  Currency,
  FraudAlert,
  FraudAlertType,
  FraudSeverity,
  SupportMessage,
  Transaction,
  TransactionCategory,
  TransactionStatus,
  User,
  UserType,
  Wallet,
} from '@eduwallet/shared';

export type PartyInfo = {
  id: string;
  fullName: string;
  email: string;
  userType: UserType;
};

export type TransactionRow = Transaction & {
  fromWallet: (Wallet & { user: PartyInfo }) | null;
  toWallet: (Wallet & { user: PartyInfo }) | null;
  fraudAlerts: FraudAlert[];
};

export type FraudAlertRow = FraudAlert & {
  transaction: TransactionRow;
};

export type AdminUser = User & {
  wallets: Wallet[];
  linkedStudentsCount?: number;
  disbursementsCount?: number;
  hasDocuments?: boolean;
  hasSupportMessage: boolean;
};

export type SystemStats = {
  users: {
    total: number;
    byType: Record<string, number>;
    studentCount: number;
    parentCount: number;
    institutionCount: number;
  };
  transactions: { total: number; byStatus: Record<string, number>; totalVolume: number };
  fraudAlerts: { active: number };
  kyc: { pending: number };
  wallets: { total: number; balanceByCurrency: Record<string, number> };
};

export type PendingKYCRow = User & { documents: AcademicDocument[]; hasResubmitted: boolean };

export type ResubmissionRow = User & {
  oldDocuments: AcademicDocument[];
  newDocuments: AcademicDocument[];
};

export type SupportMessageRow = SupportMessage & {
  user: { id: string; fullName: string; email: string; userType: UserType; suspended: boolean };
};

export type RelationshipRow = {
  id: string;
  parentUserId: string;
  studentUserId: string;
  approvalThreshold: string;
  categories: TransactionCategory[];
  parent: { id: string; fullName: string; email: string };
  student: { id: string; fullName: string; email: string };
  pendingApprovalsCount: number;
};

export type Paginated<T> = {
  total: number;
  page: number;
  limit: number;
} & Record<string, T[]>;

export const CURRENCIES: Currency[] = ['USD', 'EUR', 'LBP'];

export const TRANSACTION_CATEGORIES: TransactionCategory[] = [
  'TUITION',
  'BOOKS',
  'FOOD',
  'TRANSPORT',
  'SOFTWARE',
  'RENT',
  'LIFESTYLE',
  'PERSONAL_SAVINGS',
  'GENERAL',
];

export const TRANSACTION_STATUSES: TransactionStatus[] = [
  'PENDING',
  'AUTO_APPROVED',
  'APPROVED',
  'REJECTED',
  'EMERGENCY',
];

export const FRAUD_TYPES: FraudAlertType[] = ['CIRCULAR', 'VELOCITY', 'DUPLICATE', 'UNUSUAL_AMOUNT'];
export const FRAUD_SEVERITIES: FraudSeverity[] = ['LOW', 'MEDIUM', 'HIGH'];
