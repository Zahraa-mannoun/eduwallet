import { FraudAlertType, FraudSeverity } from '@prisma/client';
import type { Transaction } from '@prisma/client';
import { prisma } from '../../config/database';
import { createNotification } from '../notifications/notifications.service';

const CIRCULAR_WINDOW_MS = 60 * 60 * 1000;
const VELOCITY_WINDOW_MS = 10 * 60 * 1000;
const VELOCITY_THRESHOLD = 5;
// Duplicate detection only exists to catch an accidental double-tap on the send button,
// not two separate legitimate payments of the same amount — keep the window tight.
const DUPLICATE_WINDOW_MS = 30 * 1000;
const UNUSUAL_AMOUNT_MULTIPLIER = 3;
const UNUSUAL_AMOUNT_HISTORY_SIZE = 50;

export async function checkCircularTransfer(
  fromWalletId: string,
  toWalletId: string,
  excludeTransactionId: string
): Promise<boolean> {
  const since = new Date(Date.now() - CIRCULAR_WINDOW_MS);
  const reverseTransfer = await prisma.transaction.findFirst({
    where: {
      id: { not: excludeTransactionId },
      fromWalletId: toWalletId,
      toWalletId: fromWalletId,
      createdAt: { gte: since },
    },
  });
  return reverseTransfer !== null;
}

export async function checkVelocity(
  walletId: string,
  excludeTransactionId: string
): Promise<boolean> {
  const since = new Date(Date.now() - VELOCITY_WINDOW_MS);
  const count = await prisma.transaction.count({
    where: {
      id: { not: excludeTransactionId },
      OR: [{ fromWalletId: walletId }, { toWalletId: walletId }],
      createdAt: { gte: since },
    },
  });
  return count >= VELOCITY_THRESHOLD;
}

export async function checkDuplicate(
  fromWalletId: string,
  toWalletId: string,
  amount: number,
  excludeTransactionId: string
): Promise<boolean> {
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS);
  const duplicate = await prisma.transaction.findFirst({
    where: {
      id: { not: excludeTransactionId },
      fromWalletId,
      toWalletId,
      amount,
      createdAt: { gte: since },
    },
  });
  return duplicate !== null;
}

// Only flags an amount as unusual when it's both a 3x+ outlier against the sender's own
// history AND going to a receiver that history doesn't already show as normal for them —
// a parent who always sends $50 to the same student sending $500 to that same student is
// a habit, not fraud; $500 to a receiver they've never paid before is the actual signal.
export async function checkUnusualAmount(
  walletId: string,
  toWalletId: string | null,
  amount: number,
  excludeTransactionId: string
): Promise<boolean> {
  const history = await prisma.transaction.findMany({
    where: {
      id: { not: excludeTransactionId },
      fromWalletId: walletId,
    },
    select: { amount: true, toWalletId: true },
    orderBy: { createdAt: 'desc' },
    take: UNUSUAL_AMOUNT_HISTORY_SIZE,
  });

  if (history.length === 0) {
    return false;
  }

  const average =
    history.reduce((sum, transaction) => sum + Number(transaction.amount), 0) / history.length;
  const isUnusualAmount = average > 0 && amount > average * UNUSUAL_AMOUNT_MULTIPLIER;
  if (!isUnusualAmount) {
    return false;
  }

  const isKnownReceiver = toWalletId !== null && history.some((entry) => entry.toWalletId === toWalletId);
  return !isKnownReceiver;
}

async function isParentToStudentTransfer(transaction: Transaction): Promise<boolean> {
  if (!transaction.fromWalletId || !transaction.toWalletId) {
    return false;
  }

  const [fromWallet, toWallet] = await Promise.all([
    prisma.wallet.findUnique({
      where: { id: transaction.fromWalletId },
      select: { user: { select: { userType: true } } },
    }),
    prisma.wallet.findUnique({
      where: { id: transaction.toWalletId },
      select: { user: { select: { userType: true } } },
    }),
  ]);

  return fromWallet?.user.userType === 'PARENT' && toWallet?.user.userType === 'STUDENT';
}

export async function runAllChecks(transaction: Transaction): Promise<void> {
  // Parents funding their own student is expected, routine activity — it shouldn't ever
  // be run through fraud detection, which exists to catch suspicious peer/self spending.
  if (await isParentToStudentTransfer(transaction)) {
    return;
  }

  const amount = Number(transaction.amount);
  const alerts: { alertType: FraudAlertType; severity: FraudSeverity }[] = [];

  if (transaction.fromWalletId && transaction.toWalletId) {
    if (
      await checkCircularTransfer(transaction.fromWalletId, transaction.toWalletId, transaction.id)
    ) {
      alerts.push({ alertType: FraudAlertType.CIRCULAR, severity: FraudSeverity.HIGH });
    }

    if (
      await checkDuplicate(transaction.fromWalletId, transaction.toWalletId, amount, transaction.id)
    ) {
      alerts.push({ alertType: FraudAlertType.DUPLICATE, severity: FraudSeverity.MEDIUM });
    }
  }

  const velocityWalletId = transaction.fromWalletId ?? transaction.toWalletId;
  if (velocityWalletId && (await checkVelocity(velocityWalletId, transaction.id))) {
    alerts.push({ alertType: FraudAlertType.VELOCITY, severity: FraudSeverity.MEDIUM });
  }

  if (
    transaction.fromWalletId &&
    (await checkUnusualAmount(transaction.fromWalletId, transaction.toWalletId, amount, transaction.id))
  ) {
    alerts.push({ alertType: FraudAlertType.UNUSUAL_AMOUNT, severity: FraudSeverity.LOW });
  }

  if (alerts.length > 0) {
    // runAllChecks can run more than once for the same transaction (e.g. once at PENDING
    // creation, again when a parent later approves it) — don't create a second identical
    // alert row, or a second admin notification, for a pattern already on record.
    const existingAlertTypes = await prisma.fraudAlert.findMany({
      where: {
        transactionId: transaction.id,
        alertType: { in: alerts.map((alert) => alert.alertType) },
      },
      select: { alertType: true },
    });
    const alreadyFlagged = new Set(existingAlertTypes.map((alert) => alert.alertType));
    const newAlerts = alerts.filter((alert) => !alreadyFlagged.has(alert.alertType));

    if (newAlerts.length > 0) {
      await prisma.fraudAlert.createMany({
        data: newAlerts.map((alert) => ({
          transactionId: transaction.id,
          alertType: alert.alertType,
          severity: alert.severity,
        })),
      });

      const admins = await prisma.user.findMany({
        where: { userType: 'ADMIN' },
        select: { id: true },
      });
      const alertTypesList = newAlerts.map((alert) => alert.alertType).join(', ');
      await Promise.all(
        admins.map((admin) =>
          createNotification(
            admin.id,
            'Fraud Alert Triggered',
            `Transaction ${transaction.id} was flagged for: ${alertTypesList}.`,
            'FRAUD_ALERT'
          )
        )
      );
    }
  }
}
