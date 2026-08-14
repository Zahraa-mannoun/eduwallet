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
  hasResubmitted?: boolean;
};

export type AgentRow = User & { withdrawalsCount: number };

export type SystemStats = {
  users: {
    total: number;
    byType: Record<string, number>;
    studentCount: number;
    parentCount: number;
    institutionCount: number;
    agentCount: number;
    adminCount: number;
  };
  transactions: { total: number; byStatus: Record<string, number>; totalVolume: number };
  fraudAlerts: { active: number };
  kyc: { pending: number };
  wallets: { total: number; balanceByCurrency: Record<string, number> };
  withdrawals: { totalCompleted: number; today: number };
  reportRequests: { pending: number };
  emailChangeRequests: { pending: number };
  personalSavings: { totalBalance: number };
  scholarships: { totalThisMonth: number };
  agents: { active: number; suspended: number };
  agentMessages: { pending: number };
};

export type AnalyticsResult = {
  spending: {
    byCategory: Array<{ category: string; total: number }>;
    dailyVolume: Array<{ date: string; total: number }>;
  };
  funding: {
    byCategory: Array<{ category: string; total: number }>;
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
  replyMessage: string | null;
  repliedAt: string | null;
};

export type RolloverHistoryRow = {
  month: string;
  studentCount: number;
  totalAmount: number;
  triggeredAt: string;
  students: Array<{
    id: string;
    name: string;
    email: string;
    amount: number;
    categories: Array<{ category: string; amount: number }>;
  }>;
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

// PENDING_PARENT_APPROVAL and COMPLETED have no TransactionStatus equivalent — they only ever
// match a synthesized cash-withdrawal row the admin transactions list merges in (see
// admin.service.ts's getAllTransactions), never a real Transaction record.
export const TRANSACTION_STATUSES: (TransactionStatus | 'PENDING_PARENT_APPROVAL' | 'COMPLETED')[] = [
  'PENDING',
  'AUTO_APPROVED',
  'APPROVED',
  'REJECTED',
  'EMERGENCY',
  'PENDING_PARENT_APPROVAL',
  'COMPLETED',
];

export const FRAUD_TYPES: FraudAlertType[] = ['CIRCULAR', 'VELOCITY', 'DUPLICATE', 'UNUSUAL_AMOUNT'];
export const FRAUD_SEVERITIES: FraudSeverity[] = ['LOW', 'MEDIUM', 'HIGH'];

export type ReportPeriod = 'LAST_WEEK' | 'LAST_MONTH' | 'LAST_YEAR' | 'LAST_2_YEARS';
// GENERATED = PDF exists but is admin-preview-only; SENT = admin confirmed the preview and the
// parent can now see/download it.
export type ReportStatus = 'PENDING' | 'GENERATED' | 'SENT';

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
  sentAt: string | null;
  parent: { id: string; fullName: string; email: string };
  student: { id: string; fullName: string; email: string };
};

export const REPORT_PERIOD_LABELS: Record<ReportPeriod, string> = {
  LAST_WEEK: 'Last Week',
  LAST_MONTH: 'Last Month',
  LAST_YEAR: 'Last Year',
  LAST_2_YEARS: 'Last 2 Years',
};

export type EmailChangeStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export type EmailChangeRequestRow = {
  id: string;
  userId: string;
  currentEmail: string;
  requestedEmail: string;
  reason: string;
  proofImagePath: string | null;
  status: EmailChangeStatus;
  createdAt: string;
  resolvedAt: string | null;
  user: { id: string; fullName: string; email: string; userType: string };
};

export type WithdrawalStatus = 'PENDING' | 'PENDING_PARENT_APPROVAL' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

export type ReceiptVerificationStatus =
  | 'PROCESSING'
  | 'PENDING'
  | 'AUTO_VERIFIED'
  | 'FLAGGED'
  | 'MANUALLY_VERIFIED'
  | 'REJECTED';

// PENDING is excluded — withdrawals go PENDING -> COMPLETED instantly while the student is
// physically at the agent, so it's never a state an admin needs to filter for.
export const WITHDRAWAL_STATUSES: WithdrawalStatus[] = [
  'PENDING_PARENT_APPROVAL',
  'APPROVED',
  'REJECTED',
  'COMPLETED',
];

export const RECEIPT_VERIFICATION_STATUSES: ReceiptVerificationStatus[] = [
  'PROCESSING',
  'PENDING',
  'AUTO_VERIFIED',
  'FLAGGED',
  'MANUALLY_VERIFIED',
  'REJECTED',
];

export type WithdrawalAdminRow = {
  id: string;
  walletId: string;
  amount: string;
  category: TransactionCategory;
  status: WithdrawalStatus;
  receiptPath: string | null;
  receiptVerificationStatus: ReceiptVerificationStatus;
  receiptVerificationNote: string | null;
  merchantName: string | null;
  detectedCategory: TransactionCategory | null;
  agentId: string | null;
  createdAt: string;
  completedAt: string | null;
  wallet: {
    id: string;
    userId: string;
    balance: string;
    currency: string;
    createdAt: string;
    user: { id: string; fullName: string; email: string };
  };
  agent: { id: string; fullName: string; email: string } | null;
};
