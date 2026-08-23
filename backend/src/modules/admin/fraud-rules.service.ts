import type { FraudRule } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { FRAUD_RULE_DEFAULTS, invalidateFraudRuleCache } from '../wallet/fraud.service';
import type { FraudRuleKey } from '../wallet/fraud.service';
import { logAdminAction } from './admin.service';

// Upserts every key in FRAUD_RULE_DEFAULTS (wallet/fraud.service.ts is the single source of
// truth for the key list, labels, units, and descriptions) — safe to call repeatedly, it never
// overwrites a value an admin has already changed.
export async function ensureFraudRuleDefaults(): Promise<void> {
  await Promise.all(
    (Object.keys(FRAUD_RULE_DEFAULTS) as FraudRuleKey[]).map((key) => {
      const config = FRAUD_RULE_DEFAULTS[key];
      return prisma.fraudRule.upsert({
        where: { key },
        update: {},
        create: { key, ...config },
      });
    })
  );
}

export async function getFraudRules(): Promise<FraudRule[]> {
  const existing = await prisma.fraudRule.findMany({ orderBy: { key: 'asc' } });
  if (existing.length > 0) {
    return existing;
  }
  // Table exists but is empty (e.g. this admin page is opened before the seed script or server
  // startup hook has ever run) — self-heal instead of showing an empty settings page.
  await ensureFraudRuleDefaults();
  return prisma.fraudRule.findMany({ orderBy: { key: 'asc' } });
}

export async function updateFraudRule(
  adminId: string,
  key: string,
  value: number
): Promise<FraudRule> {
  const rule = await prisma.fraudRule.findUnique({ where: { key } });
  if (!rule) {
    throw new AppError(404, 'FRAUD_RULE_NOT_FOUND', 'Fraud rule not found');
  }

  const updated = await prisma.fraudRule.update({ where: { key }, data: { value } });
  await invalidateFraudRuleCache();
  await logAdminAction(adminId, 'UPDATE_FRAUD_RULE', key, `${rule.value} -> ${value}`);
  return updated;
}
