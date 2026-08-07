export type UserType = 'STUDENT' | 'PARENT' | 'INSTITUTION' | 'ADMIN';

export type User = {
  id: string;
  email: string;
  fullName: string;
  userType: UserType;
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

export type WithdrawalStatus =
  | 'PENDING'
  | 'PENDING_PARENT_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED';

export type ReceiptVerificationStatus = 'PENDING' | 'AUTO_VERIFIED' | 'FLAGGED' | 'MANUALLY_VERIFIED';

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
  wallet: {
    id: string;
    userId: string;
    balance: string;
    currency: string;
    createdAt: string;
    user: {
      id: string;
      fullName: string;
      email: string;
    };
  };
};

export type StudentLookup = {
  user: { id: string; fullName: string; email: string };
  wallet: { id: string; balance: string; currency: string };
  freeBalance: string;
  lockedFunds: Array<{ category: TransactionCategory; amount: string }>;
  approvalThreshold: string | null;
  allowedCategories: TransactionCategory[] | null;
};

export type ProcessWithdrawalResult = {
  pending: boolean;
  request: {
    id: string;
    amount: string;
    category: TransactionCategory;
    status: WithdrawalStatus;
  };
  studentName: string;
  newBalance?: string;
};
