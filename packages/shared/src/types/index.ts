// Shared types describing the shapes returned by the EduWallet backend API.
// Decimal fields (balance, amount, monthlyLimit, spent, approvalThreshold) are
// serialized as strings over JSON by Prisma/Fastify — never plain numbers.

export type UserType = 'STUDENT' | 'PARENT' | 'INSTITUTION' | 'ADMIN' | 'AGENT';

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

export type SupportMessageType = 'SUSPENSION_APPEAL' | 'GENERAL' | 'AGENT_MESSAGE';

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
  subject: string | null;
  message: string;
  type: SupportMessageType;
  status: SupportMessageStatus;
  createdAt: string;
};

export type LockedFund = {
  id: string;
  walletId: string;
  category: TransactionCategory;
  amount: string;
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
  // The admin transactions list merges in-flight cash withdrawal requests (awaiting parent
  // approval or agent dispense, or rejected outright) alongside real transactions — those rows
  // are the only ones that can carry 'PENDING_PARENT_APPROVAL', a WithdrawalStatus value with
  // no TransactionStatus equivalent. Recognize a withdrawal-derived row via
  // receiverName === 'Cash Withdrawal', not this field alone.
  status: TransactionStatus | 'PENDING_PARENT_APPROVAL';
  note: string | null;
  receiverName: string | null;
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
