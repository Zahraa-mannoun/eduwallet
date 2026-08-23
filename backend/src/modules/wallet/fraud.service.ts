import { FraudAlertType, FraudSeverity } from '@prisma/client';
import type { Transaction } from '@prisma/client';
import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { createNotification } from '../notifications/notifications.service';

// The full set of admin-configurable thresholds this module reads. `value` is in the same
// unit the original hardcoded constant used (milliseconds for every *_MS key) — the admin
// Settings UI is responsible for converting to/from a friendlier display unit (seconds,
// minutes, ...), never this module. These doubles as the seeded defaults: fraud-rules.service.ts
// (the admin CRUD layer) imports this same object rather than keeping its own copy.
export const FRAUD_RULE_DEFAULTS = {
  DUPLICATE_WINDOW_MS: {
    value: 30 * 1000,
    label: 'Duplicate Window',
    unit: 'seconds',
    description:
      "How soon a second payment of the exact same amount, to the exact same recipient, is treated as an accidental double-tap rather than a separate legitimate payment. Kept tight on purpose — it exists to catch a fumbled send button, not to flag two genuine payments made the same day.",
  },
  VELOCITY_WINDOW_MS: {
    value: 10 * 60 * 1000,
    label: 'Velocity Window',
    unit: 'minutes',
    description:
      'The rolling time window used to count how many transfers a wallet has sent or received. Paired with Velocity Threshold below — together they catch a wallet suddenly firing off many transactions in a short burst.',
  },
  VELOCITY_THRESHOLD: {
    value: 5,
    label: 'Velocity Threshold',
    unit: 'transactions',
    description:
      'How many transfers within the Velocity Window count as suspicious. A wallet that crosses this count is flagged for unusually rapid activity, which can indicate a compromised account or automated abuse.',
  },
  CIRCULAR_WINDOW_MS: {
    value: 60 * 60 * 1000,
    label: 'Circular Window',
    unit: 'minutes',
    description:
      'How far back to look for money being sent right back to where it came from. If wallet A pays wallet B and B pays A back within this window, the transaction is flagged as a circular transfer — a pattern often used to launder funds or artificially inflate activity.',
  },
  UNUSUAL_AMOUNT_MULTIPLIER: {
    value: 3,
    label: 'Unusual Amount Multiplier',
    unit: 'x average',
    description:
      "How many times larger than a sender's own average payment a new payment must be, sent to a recipient they have no history with, before it is flagged. This protects against one large payment to an unfamiliar party while leaving a sender's normal habits — even large ones — alone.",
  },
  UNUSUAL_AMOUNT_HISTORY_SIZE: {
    value: 50,
    label: 'History Size',
    unit: 'transactions',
    description:
      "How many of a sender's most recent payments are used to calculate their average spend for the Unusual Amount Multiplier check above. A larger window smooths out one-off spikes; a smaller one reacts faster to a genuine change in spending habits.",
  },
} as const;

export type FraudRuleKey = keyof typeof FRAUD_RULE_DEFAULTS;

type FraudRuleValues = Record<FraudRuleKey, number>;

const FRAUD_RULE_KEYS = Object.keys(FRAUD_RULE_DEFAULTS) as FraudRuleKey[];

export const FRAUD_RULES_CACHE_KEY = 'fraud-rules:values';
const FRAUD_RULES_CACHE_TTL_SECONDS = 60;

function defaultRuleValues(): FraudRuleValues {
  const values = {} as FraudRuleValues;
  for (const key of FRAUD_RULE_KEYS) {
    values[key] = FRAUD_RULE_DEFAULTS[key].value;
  }
  return values;
}

// Loads every rule's current value in one Redis round trip (rather than one per check), cached
// for 60s so a burst of transactions never hits Postgres per-transaction. On a cache miss, reads
// the FraudRule table and re-populates the cache; a key missing from the table entirely (e.g. a
// fresh DB before the seed has run) falls back to the hardcoded default above rather than
// crashing a live transaction's fraud check.
async function loadRuleValues(): Promise<FraudRuleValues> {
  const cached = await redis.get(FRAUD_RULES_CACHE_KEY);
  if (cached) {
    return JSON.parse(cached) as FraudRuleValues;
  }

  const rows = await prisma.fraudRule.findMany();
  const values = defaultRuleValues();
  for (const row of rows) {
    if (row.key in values) {
      values[row.key as FraudRuleKey] = row.value;
    }
  }
  await redis.set(FRAUD_RULES_CACHE_KEY, JSON.stringify(values), 'EX', FRAUD_RULES_CACHE_TTL_SECONDS);
  return values;
}

async function getRuleValue(key: FraudRuleKey): Promise<number> {
  const values = await loadRuleValues();
  return values[key];
}

// Called by fraud-rules.service.ts's updateFraudRule() right after a value changes — busts the
// cache immediately instead of leaving fraud checks running against a stale value for up to the
// full 60s TTL.
export async function invalidateFraudRuleCache(): Promise<void> {
  await redis.del(FRAUD_RULES_CACHE_KEY);
}

export async function checkCircularTransfer(
  fromWalletId: string,
  toWalletId: string,
  excludeTransactionId: string
): Promise<boolean> {
  const windowMs = await getRuleValue('CIRCULAR_WINDOW_MS');
  const since = new Date(Date.now() - windowMs);
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
  const [windowMs, threshold] = await Promise.all([
    getRuleValue('VELOCITY_WINDOW_MS'),
    getRuleValue('VELOCITY_THRESHOLD'),
  ]);
  const since = new Date(Date.now() - windowMs);
  const count = await prisma.transaction.count({
    where: {
      id: { not: excludeTransactionId },
      OR: [{ fromWalletId: walletId }, { toWalletId: walletId }],
      createdAt: { gte: since },
    },
  });
  return count >= threshold;
}

export async function checkDuplicate(
  fromWalletId: string,
  toWalletId: string,
  amount: number,
  excludeTransactionId: string
): Promise<boolean> {
  const windowMs = await getRuleValue('DUPLICATE_WINDOW_MS');
  const since = new Date(Date.now() - windowMs);
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
  const [historySize, multiplier] = await Promise.all([
    getRuleValue('UNUSUAL_AMOUNT_HISTORY_SIZE'),
    getRuleValue('UNUSUAL_AMOUNT_MULTIPLIER'),
  ]);

  const history = await prisma.transaction.findMany({
    where: {
      id: { not: excludeTransactionId },
      fromWalletId: walletId,
    },
    select: { amount: true, toWalletId: true },
    orderBy: { createdAt: 'desc' },
    take: historySize,
  });

  if (history.length === 0) {
    return false;
  }

  const average =
    history.reduce((sum, transaction) => sum + Number(transaction.amount), 0) / history.length;
  const isUnusualAmount = average > 0 && amount > average * multiplier;
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
