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
  withdrawals: { totalCompleted: number };
  reportRequests: { pending: number };
  emailChangeRequests: { pending: number };
  personalSavings: { totalBalance: number };
  scholarships: { totalThisMonth: number };
};

export type AnalyticsResult = {
  spending: {
    byCategory: Array<{ category: string; total: number }>;
    dailyVolume: Array<{ date: string; total: number }>;
  };
  withdrawals: {
    byCategory: Array<{ category: string; total: number }>;
    totalThisMonth: number;
    verificationSuccessRate: number;
  };
  scholarships: {
    byCategory: Array<{ category: string; total: number }>;
    totalInstitutions: number;
    totalAllTime: number;
    fullCount: number;
    partialCount: number;
  };
  savings: {
    monthlyTrend: Array<{ month: string; total: number }>;
    totalBalance: number;
    averagePerStudent: number;
    pendingWithdrawals: number;
  };
  fraud: {
    byType: Array<{ type: string; count: number }>;
    total: number;
    resolved: number;
    resolutionRate: number;
    mostCommon: string | null;
  };
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

export type ReportPeriod = 'LAST_WEEK' | 'LAST_MONTH' | 'LAST_YEAR' | 'LAST_2_YEARS';
export type ReportStatus = 'PENDING' | 'GENERATED';

export type ReportRequestRow = {
  id: string;
  parentUserId: string;
  studentUserId: string;
  period: ReportPeriod;
  includeCardPurchases: boolean;
  includeTransfers: boolean;
  includeWithdrawals: boolean;
  includeFlagged: boolean;
  includePending: boolean;
  includeSavings: boolean;
  status: ReportStatus;
  pdfPath: string | null;
  createdAt: string;
  generatedAt: string | null;
  parent: { id: string; fullName: string; email: string };
  student: { id: string; fullName: string; email: string };
};

export const REPORT_PERIOD_LABELS: Record<ReportPeriod, string> = {
  LAST_WEEK: 'Last Week',
  LAST_MONTH: 'Last Month',
  LAST_YEAR: 'Last Year',
  LAST_2_YEARS: 'Last 2 Years',
};
