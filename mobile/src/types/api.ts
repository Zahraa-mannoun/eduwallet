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
  | 'GENERAL';

export type TransactionStatus = 'PENDING' | 'AUTO_APPROVED' | 'APPROVED' | 'REJECTED' | 'EMERGENCY';

export type DocumentVerificationStatus = 'STORED' | 'VERIFIED';

export type FraudAlertType = 'CIRCULAR' | 'VELOCITY' | 'DUPLICATE' | 'UNUSUAL_AMOUNT';

export type FraudSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export type User = {
  id: string;
  email: string;
  fullName: string;
  userType: UserType;
  kycStatus: KYCStatus;
  suspended: boolean;
  createdAt: string;
};

export type Wallet = {
  id: string;
  userId: string;
  balance: string;
  currency: Currency;
  createdAt: string;
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
  createdAt: string;
};

export type VirtualCard = {
  id: string;
  walletId: string;
  cardNumber: string;
  expiry: string;
  merchantLock: string | null;
  categoryLock: TransactionCategory | null;
  used: boolean;
  frozen: boolean;
  createdAt: string;
};

// Only the create-card response includes the CVV (and formatted expiry) — a one-time
// reveal. Every other card endpoint returns VirtualCard without it.
export type NewVirtualCard = VirtualCard & {
  cvv: string;
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
