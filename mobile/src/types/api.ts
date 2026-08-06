// Mirrors /packages/shared/src/types/index.ts, the canonical definition of these shapes.
//
// Not imported directly from ../types/api: Expo/Metro's default monorepo config
// resolves the app entry point incorrectly once a sibling workspace package with raw
// TypeScript sources is added to watchFolders (confirmed by actually bundling — the
// dev server started, but the very first bundle request failed to resolve "./index"
// relative to the monorepo root instead of mobile/). Getting that working reliably needs
// more Metro configuration than is safe to land without a device/simulator to verify against,
// so this file is a deliberate local copy kept in sync by hand instead.
//
// Decimal fields (balance, amount, monthlyLimit, spent, approvalThreshold) are
// serialized as strings over JSON by Prisma/Fastify — never plain numbers.

export type UserType = 'STUDENT' | 'PARENT' | 'INSTITUTION' | 'ADMIN';

export type KYCStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export type Currency = 'USD' | 'EUR' | 'LBP';

export type TransactionCategory =
  | 'TUITION'
  | 'BOOKS'
  | 'FOOD'
  | 'TRANSPORT'
  | 'SOFTWARE'
  | 'RENT'
  | 'LIFESTYLE'
  | 'PERSONAL_SAVINGS'
  | 'GENERAL';

export type TransactionStatus = 'PENDING' | 'AUTO_APPROVED' | 'APPROVED' | 'REJECTED' | 'EMERGENCY';

export type DocumentVerificationStatus = 'STORED' | 'VERIFIED';

export type FraudAlertType = 'CIRCULAR' | 'VELOCITY' | 'DUPLICATE' | 'UNUSUAL_AMOUNT';

export type FraudSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export type SupportMessageStatus = 'UNREAD' | 'READ';

export type SavingsHistoryType =
  | 'ROLLOVER'
  | 'WITHDRAWAL_REQUEST'
  | 'WITHDRAWAL_APPROVED'
  | 'WITHDRAWAL_REJECTED';

export type SavingsHistoryStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type WithdrawalStatus =
  | 'PENDING'
  | 'PENDING_PARENT_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED';

export type ReceiptVerificationStatus = 'PENDING' | 'AUTO_VERIFIED' | 'FLAGGED' | 'MANUALLY_VERIFIED';

export type ReportPeriod = 'LAST_WEEK' | 'LAST_MONTH' | 'LAST_YEAR' | 'LAST_2_YEARS';

export type ReportStatus = 'PENDING' | 'GENERATED';

export type EmailChangeStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export type User = {
  id: string;
  email: string;
  fullName: string;
  userType: UserType;
  kycStatus: KYCStatus;
  // Set together on a REJECTED review decision, cleared together on APPROVED.
  kycRejectionReason: string | null;
  kycRejectedAt: string | null;
  suspended: boolean;
  // Set on suspend, cleared on unsuspend — describes the CURRENT suspension only.
  suspensionReason: string | null;
  cardAutoRenew: boolean;
  createdAt: string;
};

export type SupportMessage = {
  id: string;
  userId: string;
  message: string;
  status: SupportMessageStatus;
  createdAt: string;
};

export type LockedFund = {
  id: string;
  walletId: string;
  category: TransactionCategory;
  amount: string;
  // All-time total ever locked into this category, never decremented on spend — use this
  // (not `amount`) to show the original amount the parent sent.
  totalLocked: string;
  createdAt: string;
};

export type Wallet = {
  id: string;
  userId: string;
  balance: string;
  currency: Currency;
  createdAt: string;
  lockedFunds: LockedFund[];
};

export type Transaction = {
  id: string;
  fromWalletId: string | null;
  toWalletId: string | null;
  amount: string;
  currency: Currency;
  category: TransactionCategory;
  status: TransactionStatus;
  note: string | null;
  receiverName: string | null;
  // Only populated by GET /wallet/transactions and /wallet/transactions/:id — other endpoints
  // that return a bare Transaction (e.g. POST /wallet/transfer) leave this undefined.
  senderName?: string | null;
  createdAt: string;
};

// Demo prototype: CVV is always included and shown on the card face, not hidden after
// creation like a real card issuer would — there's no real money or PCI scope here.
export type VirtualCard = {
  id: string;
  walletId: string;
  cardNumber: string;
  cvv: string;
  expiry: string;
  merchantLock: string | null;
  categoryLock: TransactionCategory | null;
  used: boolean;
  frozen: boolean;
  createdAt: string;
};

// The create-card response additionally includes a pre-formatted MM/YY expiry.
export type NewVirtualCard = VirtualCard & {
  expiryFormatted: string;
};

export type BudgetCategory = {
  id: string;
  walletId: string;
  category: TransactionCategory;
  monthlyLimit: string;
  spent: string;
  month: string;
};

export type Notification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
};

export type AcademicDocument = {
  id: string;
  userId: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  documentType: string | null;
  documentName: string | null;
  sha256Hash: string | null;
  blockchainTxHash: string | null;
  verificationStatus: DocumentVerificationStatus;
  createdAt: string;
};

export type ParentalControl = {
  id: string;
  parentUserId: string;
  studentUserId: string;
  approvalThreshold: string;
  categories: TransactionCategory[];
};

export type PersonalSavingsHistory = {
  id: string;
  walletId: string;
  type: SavingsHistoryType;
  amount: string;
  month: string | null;
  reason: string | null;
  status: SavingsHistoryStatus;
  createdAt: string;
};

export type WithdrawalRequest = {
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
};

// Only populated on GET /withdrawals/pending-approval (parent-facing) — the parent needs to
// know which student a withdrawal belongs to, unlike GET /withdrawals/mine (student-facing).
export type WithdrawalRequestWithStudent = WithdrawalRequest & {
  wallet: {
    id: string;
    userId: string;
    user: { id: string; fullName: string; email: string };
  };
};

export type ReportRequest = {
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

export type EmailChangeRequest = {
  id: string;
  userId: string;
  currentEmail: string;
  requestedEmail: string;
  reason: string;
  proofImagePath: string | null;
  status: EmailChangeStatus;
  createdAt: string;
  resolvedAt: string | null;
};

export type UniversityStudentCourse = {
  id: string;
  courseName: string;
  credits: number;
  costPerCredit: string;
  totalCost: string;
  semester: string;
};

export type UniversityStudentSummary = {
  id: string;
  userId: string;
  studentNumber: string;
  fullName: string;
  email: string;
  totalCreditCost: string;
  courses: UniversityStudentCourse[];
  received: string;
  fundingGap: string;
};

export type FundingStatus = 'FULL' | 'PARTIAL';

export type DisbursementPreviewEntry = {
  universityStudentId: string;
  userId: string;
  fullName: string;
  email: string;
  totalCreditCost: string;
  amountPerStudent: string;
  fundingStatus: FundingStatus;
  fundingGap: string;
};

export type FraudAlert = {
  id: string;
  transactionId: string;
  alertType: FraudAlertType;
  severity: FraudSeverity;
  resolved: boolean;
  createdAt: string;
};

export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiFailure = {
  success: false;
  error: string;
  code: string;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
