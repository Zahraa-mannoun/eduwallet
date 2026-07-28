import type { Currency, LockedFund, Transaction, UserType, Wallet } from '@prisma/client';
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

      return tx.transaction.create({
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
    });

    await updateSpent(fromWallet.id, transaction.category, Number(transaction.amount));

    await createNotification(
      toWallet.userId,
      'Money Received',
      `You received ${input.amount} ${input.currency} from ${fromUser.fullName} for ${titleCaseCategory(input.category)}.`,
      'TRANSFER_RECEIVED'
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
): Promise<{ transactions: TransactionWithParties[]; total: number; page: number; limit: number }> {
  const wallets = await prisma.wallet.findMany({ where: { userId }, select: { id: true } });
  const walletIds = wallets.map((wallet) => wallet.id);

  const where = {
    OR: [{ fromWalletId: { in: walletIds } }, { toWalletId: { in: walletIds } }],
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };

  const [rawTransactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  const transactions = await attachPartyNames(rawTransactions);

  return { transactions, total, page: filters.page, limit: filters.limit };
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
