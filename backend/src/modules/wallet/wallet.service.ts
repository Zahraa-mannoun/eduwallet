import type { Currency, LockedFund, Transaction, TransactionCategory, UserType, Wallet } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { updateSpent } from '../budget/budget.service';
import { createNotification } from '../notifications/notifications.service';
import { runAllChecks } from './fraud.service';
import type {
  GetTransactionsInput,
  LookupWalletInput,
  TopUpInput,
  TransferInput,
} from './wallet.schema';

export type TransactionWithParties = Transaction & {
  senderName: string | null;
  receiverName: string | null;
};

// A cash withdrawal only produces a real Transaction row once an agent actually dispenses it
// (disburse() in withdrawals.service.ts) — before that, while it's parked awaiting parent
// approval, there is nothing in the Transaction table to show. This is the wire shape for that
// in-flight window: same fields as TransactionWithParties, but `status` also allows the one
// WithdrawalStatus value with no TransactionStatus equivalent. Every synthesized row here is
// marked with receiverName 'Cash Withdrawal' — the same marker disburse() stamps on the real
// completed-withdrawal Transaction row, so the client can recognize "this is a cash withdrawal"
// uniformly regardless of which table it actually came from.
export type TransactionHistoryEntry = Omit<TransactionWithParties, 'status'> & {
  status: TransactionWithParties['status'] | 'PENDING_PARENT_APPROVAL';
};

function titleCaseCategory(category: string): string {
  return category.charAt(0) + category.slice(1).toLowerCase();
}

// Card payments already store the merchant's name directly on the transaction row (there's no
// toWallet for those, since the merchant isn't a EduWallet user) — everything else derives
// sender/receiver display names from the wallet owner, resolved here in one batched query.
async function attachPartyNames(transactions: Transaction[]): Promise<TransactionWithParties[]> {
  const walletIds = new Set<string>();
  for (const transaction of transactions) {
    if (transaction.fromWalletId) walletIds.add(transaction.fromWalletId);
    if (transaction.toWalletId) walletIds.add(transaction.toWalletId);
  }

  const wallets = await prisma.wallet.findMany({
    where: { id: { in: [...walletIds] } },
    select: { id: true, user: { select: { fullName: true } } },
  });
  const nameByWalletId = new Map(wallets.map((wallet) => [wallet.id, wallet.user.fullName]));

  return transactions.map((transaction) => ({
    ...transaction,
    senderName: transaction.fromWalletId ? (nameByWalletId.get(transaction.fromWalletId) ?? null) : null,
    receiverName:
      transaction.receiverName ??
      (transaction.toWalletId ? (nameByWalletId.get(transaction.toWalletId) ?? null) : null),
  }));
}

// Same "YYYY-MM" format as BudgetCategory.month (see budget.service.ts's getCurrentMonth) —
// converts it to the [start of month, start of next month) range a createdAt filter needs.
function monthToDateRange(month: string): { start: Date; end: Date } {
  const [year, monthNum] = month.split('-').map(Number);
  const start = new Date(year, (monthNum ?? 1) - 1, 1);
  const end = new Date(year, monthNum ?? 1, 1);
  return { start, end };
}

// Ledger-based per-category spend — sums real Transaction rows the wallet(s) sent. Deliberately
// NOT LockedFund.totalLocked - amount: that subtraction only reflects spend since the wallet's
// last rollover (totalLocked resets to 0 there, same as amount — see schema.prisma's LockedFund
// comment), so it can't answer "how much was spent in a specific month" once a rollover has
// happened mid-window, and it can't answer "how much has ever been spent" across many months at
// all. Accepts one wallet or several (a student can hold more than one currency wallet) so
// callers never need their own near-duplicate of this query.
//
// `month` (optional, "YYYY-MM") scopes the sum to that calendar month only. Both current callers
// pass it: parental.service.ts's getStudentSpendingBreakdown (the current month, so a parent
// sees the same "this cycle" figure the student's own Budget screen shows) and
// savings.service.ts's runRollover (the cycle that's ending, to snapshot into
// LockedFundHistory before LockedFund gets zeroed). Omitting `month` still works and sums
// all-time — kept optional for any future caller that needs a figure spanning many months —
// but nothing currently calls it that way.
export async function getSpentByCategory(
  walletId: string | string[],
  month?: string
): Promise<Map<TransactionCategory, number>> {
  const walletIds = Array.isArray(walletId) ? walletId : [walletId];
  const dateRange = month ? monthToDateRange(month) : null;
  const spentByCategory = await prisma.transaction.groupBy({
    by: ['category'],
    where: {
      fromWalletId: { in: walletIds },
      category: { not: 'GENERAL' },
      status: { in: ['AUTO_APPROVED', 'APPROVED'] },
      ...(dateRange ? { createdAt: { gte: dateRange.start, lt: dateRange.end } } : {}),
    },
    _sum: { amount: true },
  });
  return new Map(spentByCategory.map((entry) => [entry.category, Number(entry._sum.amount ?? 0)]));
}

// Not enriched with getSpentByCategory()'s all-time ledger spend: runRollover() now resets
// totalLocked to 0 alongside amount at every rollover (see schema.prisma's LockedFund comment),
// which makes `totalLocked - amount` an exact, drift-free "spent since the last rollover" figure
// on its own — every lock increments both fields equally, only a spend decrements `amount`, and
// rollover resets both together. Pairing that now-cycle-scoped totalLocked with an all-time spend
// figure instead would show nonsense like "spent > total" once enough cycles have passed.
export async function getWallet(userId: string): Promise<Wallet & { lockedFunds: LockedFund[] }> {
  const wallet = await prisma.wallet.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    include: { lockedFunds: true },
  });

  if (!wallet) {
    throw new AppError(404, 'WALLET_NOT_FOUND', 'No wallet found for this user');
  }

  return wallet;
}

export async function topUp(
  userId: string,
  input: TopUpInput
): Promise<{ wallet: Wallet; transaction: Transaction }> {
  const result = await prisma.$transaction(async (tx) => {
    const updatedWallet = await tx.wallet.upsert({
      where: { userId_currency: { userId, currency: input.currency } },
      create: { userId, currency: input.currency, balance: input.amount },
      update: { balance: { increment: input.amount } },
    });

    const transaction = await tx.transaction.create({
      data: {
        toWalletId: updatedWallet.id,
        amount: input.amount,
        currency: input.currency,
        category: 'GENERAL',
        status: 'AUTO_APPROVED',
        note: 'Wallet top-up',
      },
    });

    return { wallet: updatedWallet, transaction };
  });

  await runAllChecks(result.transaction);

  return result;
}

export async function transfer(
  fromUserId: string,
  input: TransferInput
): Promise<{ transaction: Transaction; requiresApproval: boolean }> {
  const fromWallet = await prisma.wallet.findFirst({
    where: { userId: fromUserId, currency: input.currency },
  });
  if (!fromWallet) {
    throw new AppError(404, 'WALLET_NOT_FOUND', `You do not have a ${input.currency} wallet`);
  }

  const toWallet = await prisma.wallet.findUnique({
    where: { id: input.toWalletId },
    include: { user: { select: { userType: true, fullName: true } } },
  });
  if (!toWallet) {
    throw new AppError(404, 'RECIPIENT_WALLET_NOT_FOUND', 'Recipient wallet not found');
  }

  const fromUser = await prisma.user.findUnique({
    where: { id: fromUserId },
    select: { userType: true, fullName: true },
  });
  if (!fromUser) {
    throw new AppError(404, 'USER_NOT_FOUND', 'Sender account not found');
  }

  if (toWallet.id === fromWallet.id) {
    throw new AppError(400, 'INVALID_TRANSFER', 'Cannot transfer to your own wallet');
  }

  if (toWallet.currency !== input.currency) {
    throw new AppError(400, 'CURRENCY_MISMATCH', 'Recipient wallet currency does not match');
  }

  const parentalControl = await prisma.parentalControl.findFirst({
    where: { studentUserId: fromUserId },
  });

  // Category semantics: GENERAL is unrestricted spending, gated only by the approval
  // threshold. Any other category is an education lock — the parent must have explicitly
  // authorized it (parentalControl.categories) or the transfer is rejected outright, but an
  // authorized locked category never needs approval regardless of amount.
  let requiresApproval = false;
  if (parentalControl) {
    const isGeneral = input.category === 'GENERAL';
    const isAuthorizedLockedCategory = !isGeneral && parentalControl.categories.includes(input.category);

    if (!isGeneral && !isAuthorizedLockedCategory) {
      throw new AppError(
        403,
        'CATEGORY_NOT_AUTHORIZED',
        `Your parent has not authorized spending in the ${input.category.toLowerCase()} category`
      );
    }

    const threshold = Number(parentalControl.approvalThreshold);
    requiresApproval = isGeneral && threshold > 0 && input.amount > threshold;
  }

  let transaction: Transaction;

  if (requiresApproval) {
    if (!parentalControl) {
      throw new AppError(
        500,
        'INTERNAL_ERROR',
        'Unexpected state: approval required without a parental control link'
      );
    }

    transaction = await prisma.transaction.create({
      data: {
        fromWalletId: fromWallet.id,
        toWalletId: toWallet.id,
        amount: input.amount,
        currency: input.currency,
        category: input.category,
        status: 'PENDING',
        note: input.note,
      },
    });

    await createNotification(
      parentalControl.parentUserId,
      'Approval Needed',
      `${fromUser.fullName} wants to send a ${titleCaseCategory(input.category)} transfer of ${input.amount} ${input.currency}. Your approval is needed.`,
      'APPROVAL_NEEDED'
    );
  } else {
    const isLockedCategory = input.category !== 'GENERAL';

    transaction = await prisma.$transaction(async (tx) => {
      if (isLockedCategory && fromUser.userType === 'STUDENT') {
        const lockedFundDebit = await tx.lockedFund.updateMany({
          where: { walletId: fromWallet.id, category: input.category, amount: { gte: input.amount } },
          data: { amount: { decrement: input.amount } },
        });
        if (lockedFundDebit.count === 0) {
          throw new AppError(
            400,
            'INSUFFICIENT_LOCKED_FUNDS',
            `Insufficient locked funds for ${input.category.toLowerCase()}`
          );
        }
      }

      const debited = await tx.wallet.updateMany({
        where: { id: fromWallet.id, balance: { gte: input.amount } },
        data: { balance: { decrement: input.amount } },
      });

      if (debited.count === 0) {
        throw new AppError(400, 'INSUFFICIENT_BALANCE', 'Insufficient wallet balance');
      }

      await tx.wallet.update({
        where: { id: toWallet.id },
        data: { balance: { increment: input.amount } },
      });

      if (isLockedCategory && toWallet.user.userType === 'STUDENT') {
        // totalLocked mirrors amount here (both grow on new funds) but is never touched by
        // the spend-side decrements above, so it stays the all-time total ever locked.
        await tx.lockedFund.upsert({
          where: { walletId_category: { walletId: toWallet.id, category: input.category } },
          create: { walletId: toWallet.id, category: input.category, amount: input.amount, totalLocked: input.amount },
          update: { amount: { increment: input.amount }, totalLocked: { increment: input.amount } },
        });
      }

      const createdTransaction = await tx.transaction.create({
        data: {
          fromWalletId: fromWallet.id,
          toWalletId: toWallet.id,
          amount: input.amount,
          currency: input.currency,
          category: input.category,
          status: 'AUTO_APPROVED',
          note: input.note,
        },
      });

      await updateSpent(fromWallet.id, createdTransaction.category, Number(createdTransaction.amount), tx);

      return createdTransaction;
    });

    await createNotification(
      toWallet.userId,
      'Money Received',
      `You received ${input.amount} ${input.currency} from ${fromUser.fullName} for ${titleCaseCategory(input.category)}.`,
      'TRANSFER_RECEIVED'
    );

    await createNotification(
      fromUserId,
      'Money Sent',
      `You sent ${input.amount} ${input.currency} to ${toWallet.user.fullName} for ${titleCaseCategory(input.category)}.`,
      'TRANSFER_SENT'
    );

    if (parentalControl) {
      await createNotification(
        parentalControl.parentUserId,
        'Student Spending',
        `Your student ${fromUser.fullName} spent ${input.amount} ${input.currency} on ${input.category.toLowerCase()}.`,
        'STUDENT_SPENDING'
      );
    }
  }

  await runAllChecks(transaction);

  return { transaction, requiresApproval };
}

export async function getTransactions(
  userId: string,
  filters: GetTransactionsInput
): Promise<{ transactions: TransactionHistoryEntry[]; total: number; page: number; limit: number }> {
  const wallets = await prisma.wallet.findMany({ where: { userId }, select: { id: true, currency: true } });
  const walletIds = wallets.map((wallet) => wallet.id);
  const currencyByWalletId = new Map(wallets.map((wallet) => [wallet.id, wallet.currency]));

  const where = {
    OR: [{ fromWalletId: { in: walletIds } }, { toWalletId: { in: walletIds } }],
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };

  // In-flight withdrawal requests (awaiting parent approval or agent dispense, or rejected
  // outright) never gained a real Transaction row — see TransactionHistoryEntry above. Callers
  // here always request a single page big enough to hold everything (mobile asks for limit:100,
  // page 1), so this only bothers fetching them on page 1 rather than building full cross-table
  // pagination for a handful of rows that realistically never exceeds single digits.
  const [rawTransactions, total, inFlightWithdrawals] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.transaction.count({ where }),
    filters.page === 1 && !filters.status
      ? prisma.withdrawalRequest.findMany({
          where: {
            walletId: { in: walletIds },
            status: { in: ['PENDING_PARENT_APPROVAL', 'APPROVED', 'REJECTED'] },
            ...(filters.category ? { category: filters.category } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
      : Promise.resolve([]),
  ]);

  const transactions = await attachPartyNames(rawTransactions);

  const withdrawalEntries: TransactionHistoryEntry[] = inFlightWithdrawals.map((request) => ({
    id: request.id,
    fromWalletId: request.walletId,
    toWalletId: null,
    amount: request.amount,
    currency: currencyByWalletId.get(request.walletId) ?? 'USD',
    category: request.category,
    // Narrowed by the `where` filter above to PENDING_PARENT_APPROVAL | APPROVED | REJECTED.
    status: request.status as TransactionHistoryEntry['status'],
    note: null,
    receiverName: 'Cash Withdrawal',
    senderName: null,
    createdAt: request.createdAt,
  }));

  const merged = [...transactions, ...withdrawalEntries].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  return { transactions: merged, total: total + withdrawalEntries.length, page: filters.page, limit: filters.limit };
}

export async function getTransactionById(
  userId: string,
  transactionId: string
): Promise<TransactionWithParties> {
  const wallets = await prisma.wallet.findMany({ where: { userId }, select: { id: true } });
  const walletIds = new Set(wallets.map((wallet) => wallet.id));

  const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
  const belongsToUser =
    transaction &&
    ((transaction.fromWalletId && walletIds.has(transaction.fromWalletId)) ||
      (transaction.toWalletId && walletIds.has(transaction.toWalletId)));

  if (!belongsToUser || !transaction) {
    throw new AppError(404, 'TRANSACTION_NOT_FOUND', 'Transaction not found');
  }

  const [enriched] = await attachPartyNames([transaction]);
  return enriched;
}

export async function lookupWalletByEmail(
  requestingUserId: string,
  input: LookupWalletInput
): Promise<{ walletId: string; fullName: string; currency: Currency; userType: UserType }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // P2P recipients must be verified students — an unverified student (or any non-student
  // account) simply isn't findable here, same as a nonexistent email.
  if (!user || user.userType !== 'STUDENT' || user.kycStatus !== 'VERIFIED') {
    throw new AppError(404, 'USER_NOT_FOUND', 'No account found with this email');
  }
  if (user.id === requestingUserId) {
    throw new AppError(400, 'INVALID_RECIPIENT', 'You cannot send money to yourself');
  }

  const wallet = input.currency
    ? await prisma.wallet.findFirst({ where: { userId: user.id, currency: input.currency } })
    : await prisma.wallet.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } });

  if (!wallet) {
    throw new AppError(404, 'WALLET_NOT_FOUND', 'This user has no wallet in that currency');
  }

  return { walletId: wallet.id, fullName: user.fullName, currency: wallet.currency, userType: user.userType };
}
