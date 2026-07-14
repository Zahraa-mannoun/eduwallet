import type { Transaction, Wallet } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { updateSpent } from '../budget/budget.service';
import { runAllChecks } from './fraud.service';
import type { GetTransactionsInput, TopUpInput, TransferInput } from './wallet.schema';

export async function getWallet(userId: string): Promise<Wallet> {
  const wallet = await prisma.wallet.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
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
    const existingWallet = await tx.wallet.findFirst({
      where: { userId, currency: input.currency },
    });
    const wallet =
      existingWallet ??
      (await tx.wallet.create({ data: { userId, currency: input.currency, balance: 0 } }));

    const updatedWallet = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: input.amount } },
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

  const toWallet = await prisma.wallet.findUnique({ where: { id: input.toWalletId } });
  if (!toWallet) {
    throw new AppError(404, 'RECIPIENT_WALLET_NOT_FOUND', 'Recipient wallet not found');
  }

  if (toWallet.id === fromWallet.id) {
    throw new AppError(400, 'INVALID_TRANSFER', 'Cannot transfer to your own wallet');
  }

  if (toWallet.currency !== input.currency) {
    throw new AppError(400, 'CURRENCY_MISMATCH', 'Recipient wallet currency does not match');
  }

  const lockedCards = await prisma.virtualCard.findMany({
    where: { walletId: fromWallet.id, categoryLock: { not: null } },
    select: { categoryLock: true },
  });
  if (lockedCards.length > 0) {
    const allowedCategories = new Set(lockedCards.map((card) => card.categoryLock));
    if (!allowedCategories.has(input.category)) {
      throw new AppError(
        403,
        'CATEGORY_LOCKED',
        `Your wallet is locked to spending in: ${[...allowedCategories].join(', ')}`
      );
    }
  }

  const parentalControl = await prisma.parentalControl.findFirst({
    where: { studentUserId: fromUserId },
  });
  const requiresApproval =
    parentalControl !== null &&
    input.amount > Number(parentalControl.approvalThreshold) &&
    (parentalControl.categories.length === 0 ||
      parentalControl.categories.includes(input.category));

  let transaction: Transaction;

  if (requiresApproval) {
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
  } else {
    transaction = await prisma.$transaction(async (tx) => {
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
  }

  await runAllChecks(transaction);

  return { transaction, requiresApproval };
}

export async function getTransactions(
  userId: string,
  filters: GetTransactionsInput
): Promise<{ transactions: Transaction[]; total: number; page: number; limit: number }> {
  const wallets = await prisma.wallet.findMany({ where: { userId }, select: { id: true } });
  const walletIds = wallets.map((wallet) => wallet.id);

  const where = {
    OR: [{ fromWalletId: { in: walletIds } }, { toWalletId: { in: walletIds } }],
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return { transactions, total, page: filters.page, limit: filters.limit };
}

export async function getTransactionById(
  userId: string,
  transactionId: string
): Promise<Transaction> {
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

  return transaction;
}
