import { randomInt } from 'crypto';
import type { Transaction, VirtualCard } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { isUniqueConstraintError } from '../../utils/prismaErrors';
import { updateSpent } from '../budget/budget.service';
import { createNotification } from '../notifications/notifications.service';
import { getWallet } from '../wallet/wallet.service';
import { runAllChecks } from '../wallet/fraud.service';
import type { CreateCardInput, UseCardInput } from './cards.schema';

const MAX_CARD_NUMBER_GENERATION_ATTEMPTS = 5;
// Auto-renewed and manually-replaced cards aren't re-issued through the create-card form,
// so there's no expiryDays input to carry over — reuse the same default the form itself uses.
const RENEWAL_EXPIRY_DAYS = 365;

export function generateCardNumber(): string {
  let digits = '';
  for (let i = 0; i < 16; i++) {
    digits += randomInt(0, 10).toString();
  }
  return (digits.match(/.{1,4}/g) as string[]).join('-');
}

export function generateCVV(): string {
  return randomInt(0, 1000).toString().padStart(3, '0');
}

export function generateExpiry(days: number): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}

export function formatExpiryMMYY(expiry: Date): string {
  const month = String(expiry.getMonth() + 1).padStart(2, '0');
  const year = String(expiry.getFullYear() % 100).padStart(2, '0');
  return `${month}/${year}`;
}

// Demo prototype: CVV is always returned and shown on the card face, not hidden after
// creation like a real card issuer would — there's no real money or PCI scope here.
async function getOwnedCard(userId: string, cardId: string): Promise<VirtualCard> {
  const card = await prisma.virtualCard.findUnique({ where: { id: cardId } });
  if (!card) {
    throw new AppError(404, 'CARD_NOT_FOUND', 'Card not found');
  }

  const wallet = await prisma.wallet.findUnique({
    where: { id: card.walletId },
    select: { userId: true },
  });
  if (!wallet || wallet.userId !== userId) {
    throw new AppError(404, 'CARD_NOT_FOUND', 'Card not found');
  }

  return card;
}

type IssueCardOptions = {
  merchantLock?: string | null;
  categoryLock: VirtualCard['categoryLock'] | undefined;
  expiry: Date;
};

async function issueCard(walletId: string, options: IssueCardOptions): Promise<VirtualCard> {
  for (let attempt = 0; attempt < MAX_CARD_NUMBER_GENERATION_ATTEMPTS; attempt++) {
    try {
      return await prisma.virtualCard.create({
        data: {
          walletId,
          cardNumber: generateCardNumber(),
          cvv: generateCVV(),
          expiry: options.expiry,
          merchantLock: options.merchantLock,
          categoryLock: options.categoryLock,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error) && attempt < MAX_CARD_NUMBER_GENERATION_ATTEMPTS - 1) {
        continue;
      }
      throw error;
    }
  }

  throw new AppError(500, 'CARD_GENERATION_FAILED', 'Could not generate a unique card number');
}

export async function createCard(userId: string, input: CreateCardInput): Promise<VirtualCard> {
  const wallet = await getWallet(userId);
  return issueCard(wallet.id, {
    merchantLock: input.merchantLock,
    categoryLock: input.categoryLock,
    expiry: generateExpiry(input.expiryDays),
  });
}

export async function getCards(userId: string): Promise<VirtualCard[]> {
  const wallets = await prisma.wallet.findMany({ where: { userId }, select: { id: true } });
  const walletIds = wallets.map((wallet) => wallet.id);

  return prisma.virtualCard.findMany({
    where: { walletId: { in: walletIds } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getCardById(userId: string, cardId: string): Promise<VirtualCard> {
  return getOwnedCard(userId, cardId);
}

export async function freezeCard(userId: string, cardId: string): Promise<VirtualCard> {
  const card = await getOwnedCard(userId, cardId);

  // A used-and-frozen card only exists when auto-renew was off at the time it was spent
  // (auto-renew cards are deleted outright in useCard() instead of being left in this
  // state). Unfreezing it reactivates the same card in place — clear both flags so it's
  // chargeable again, rather than issuing a replacement.
  if (card.used && card.frozen) {
    return prisma.virtualCard.update({
      where: { id: card.id },
      data: { used: false, frozen: false },
    });
  }

  return prisma.virtualCard.update({
    where: { id: card.id },
    data: { frozen: !card.frozen },
  });
}

export async function setCardAutoRenewPreference(
  userId: string,
  cardAutoRenew: boolean
): Promise<{ cardAutoRenew: boolean }> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { cardAutoRenew },
    select: { cardAutoRenew: true },
  });
  return user;
}

export async function deleteCard(userId: string, cardId: string): Promise<void> {
  const card = await getOwnedCard(userId, cardId);
  await prisma.virtualCard.delete({ where: { id: card.id } });
}

export async function useCard(input: UseCardInput): Promise<{ transaction: Transaction }> {
  const card = await prisma.virtualCard.findUnique({ where: { cardNumber: input.cardNumber } });
  if (!card || card.cvv !== input.cvv) {
    throw new AppError(401, 'INVALID_CARD', 'Invalid card number or CVV');
  }

  if (card.frozen) {
    throw new AppError(403, 'CARD_FROZEN', 'This card is frozen');
  }
  if (card.used) {
    throw new AppError(403, 'CARD_ALREADY_USED', 'This card has already been used');
  }
  if (card.expiry.getTime() < Date.now()) {
    throw new AppError(403, 'CARD_EXPIRED', 'This card has expired');
  }
  if (card.merchantLock && card.merchantLock !== input.merchantName) {
    throw new AppError(403, 'MERCHANT_LOCKED', 'This card is locked to a different merchant');
  }
  if (card.categoryLock && card.categoryLock !== input.category) {
    throw new AppError(
      403,
      'CARD_CATEGORY_MISMATCH',
      `This card is locked to ${card.categoryLock.toLowerCase()} — it can't be used for ${input.category.toLowerCase()}`
    );
  }

  const wallet = await prisma.wallet.findUnique({
    where: { id: card.walletId },
    include: { user: { select: { cardAutoRenew: true } } },
  });
  if (!wallet) {
    throw new AppError(404, 'WALLET_NOT_FOUND', 'Card wallet not found');
  }
  if (wallet.currency !== input.currency) {
    throw new AppError(400, 'CURRENCY_MISMATCH', 'Card wallet currency does not match');
  }

  // Read fresh from the student's current settings rather than the card itself — auto-renew
  // is a global preference (Profile > Account Settings), not stored per card.
  const autoRenew = wallet.user.cardAutoRenew;

  const transaction = await prisma.$transaction(async (tx) => {
    if (autoRenew) {
      // Auto-renew replaces the card outright: delete it now (a fresh replacement is issued
      // right below, once the transaction commits) instead of leaving a used, unfrozen row
      // behind that CardsScreen would otherwise have to filter out of the list forever. The
      // where-clause still guards against a double-spend race on the same card.
      const claimed = await tx.virtualCard.deleteMany({
        where: { id: card.id, used: false, frozen: false },
      });
      if (claimed.count === 0) {
        throw new AppError(403, 'CARD_UNAVAILABLE', 'This card is frozen or has already been used');
      }
    } else {
      // No auto-renew: the spent card freezes in place so the student has to explicitly
      // unfreeze it (reactivating the same card) before it can be used again.
      const claimed = await tx.virtualCard.updateMany({
        where: { id: card.id, used: false, frozen: false },
        data: { used: true, frozen: true },
      });
      if (claimed.count === 0) {
        throw new AppError(403, 'CARD_UNAVAILABLE', 'This card is frozen or has already been used');
      }
    }

    if (card.categoryLock && card.categoryLock !== 'GENERAL') {
      const lockedFundDebit = await tx.lockedFund.updateMany({
        where: { walletId: wallet.id, category: card.categoryLock, amount: { gte: input.amount } },
        data: { amount: { decrement: input.amount } },
      });
      if (lockedFundDebit.count === 0) {
        throw new AppError(
          400,
          'INSUFFICIENT_LOCKED_FUNDS',
          `Insufficient locked funds for ${card.categoryLock.toLowerCase()}`
        );
      }
    }

    const debited = await tx.wallet.updateMany({
      where: { id: wallet.id, balance: { gte: input.amount } },
      data: { balance: { decrement: input.amount } },
    });
    if (debited.count === 0) {
      throw new AppError(400, 'INSUFFICIENT_BALANCE', 'Insufficient wallet balance');
    }

    return tx.transaction.create({
      data: {
        fromWalletId: wallet.id,
        toWalletId: null,
        amount: input.amount,
        currency: input.currency,
        category: input.category,
        status: 'AUTO_APPROVED',
        note: `Card payment at ${input.merchantName}`,
        receiverName: input.merchantName,
      },
    });
  });

  await updateSpent(wallet.id, transaction.category, Number(transaction.amount));

  await createNotification(
    wallet.userId,
    'Card Payment',
    `Your card was charged ${input.amount} ${input.currency} at ${input.merchantName}.`,
    'CARD_PAYMENT'
  );

  if (autoRenew) {
    await issueCard(card.walletId, {
      merchantLock: card.merchantLock,
      categoryLock: card.categoryLock,
      expiry: generateExpiry(RENEWAL_EXPIRY_DAYS),
    });
    await createNotification(
      wallet.userId,
      'Card Auto-Renewed',
      `A new ${card.categoryLock ? card.categoryLock.toLowerCase() : 'general'} card was issued to replace the one you just used.`,
      'CARD_AUTO_RENEWED'
    );
  }

  const parentalControl = await prisma.parentalControl.findFirst({
    where: { studentUserId: wallet.userId },
  });
  if (parentalControl) {
    const student = await prisma.user.findUnique({
      where: { id: wallet.userId },
      select: { fullName: true },
    });
    await createNotification(
      parentalControl.parentUserId,
      'Card Payment by Student',
      `Your student ${student?.fullName ?? ''} used their virtual card: ${input.amount} ${input.currency} on ${input.category.toLowerCase()}.`,
      'STUDENT_CARD_PAYMENT'
    );
  }

  await runAllChecks(transaction);

  return { transaction };
}
