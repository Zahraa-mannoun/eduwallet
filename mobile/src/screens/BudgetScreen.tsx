import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Button,
  Dialog,
  Portal,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import type { BudgetCategory, TransactionCategory } from '../types/api';
import IconBadge from '../components/IconBadge';
import { VISIBLE_BUDGET_CATEGORIES } from '../constants/budgetCategories';
import type { BudgetCategoryDefinition, BudgetCategoryKey } from '../constants/budgetCategories';
import { colors } from '../theme/colors';
import { useWallet } from '../context/WalletContext';
import * as budgetService from '../services/budgetService';
import * as parentalService from '../services/parentalService';
import type { MyPermissions } from '../services/parentalService';
import { ApiError } from '../services/api';
import type { StudentTabScreenProps } from '../navigation/types';

// NOTE: this screen deliberately avoids react-native-paper's Card and ProgressBar.
// Both use elevation/shadow-driven internals that were confirmed (via live screenshots)
// to break on the web renderer here: every category's progress bar / used-text / Edit
// button was collapsing out of its own card and stacking on top of each other below
// the last card, so tapping "Edit" on any card opened whichever category rendered last.
// Plain Views render correctly everywhere, so the whole card body is built from those.

const CATEGORY_DESCRIPTIONS: Record<BudgetCategoryKey, string> = {
  tuition: 'University fees and academic expenses',
  books: 'Textbooks, courses and educational materials',
  food: 'Meals and groceries',
  transport: 'Bus, taxi and travel expenses',
  software: 'Dev tools, apps and subscriptions',
  rent: 'Housing and accommodation',
  lifestyle: 'Everyday personal expenses',
  personal_savings: 'Unspent funds automatically saved each month',
  general: 'Miscellaneous spending',
};

const WARNING_THRESHOLD = 70;
const DANGER_THRESHOLD = 90;
const WARNING_COLOR = '#F59E0B';

function progressColor(percentUsed: number): string {
  if (percentUsed > DANGER_THRESHOLD) return colors.danger;
  if (percentUsed > WARNING_THRESHOLD) return WARNING_COLOR;
  return colors.accent;
}

export default function BudgetScreen(_props: Readonly<StudentTabScreenProps<'Budget'>>) {
  const { lockedFunds } = useWallet();
  const [budgets, setBudgets] = useState<BudgetCategory[]>([]);
  const [permissions, setPermissions] = useState<MyPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogCategory, setDialogCategory] = useState<BudgetCategoryDefinition | null>(null);
  const [dialogAmount, setDialogAmount] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const loadBudgets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await budgetService.getBudgets();
      setBudgets(result.budgets);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load your budgets.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadPermissions = useCallback(async () => {
    try {
      const result = await parentalService.getMyPermissions();
      setPermissions(result);
    } catch {
      // Authorization gating falls back to "everything allowed" on failure, same as an
      // unlinked student — better than locking a student out of their own budgets.
    }
  }, []);

  const load = useCallback(() => {
    void loadBudgets();
    void loadPermissions();
  }, [loadBudgets, loadPermissions]);

  // Unlike other screens, this deliberately skips the 30s-throttled focus hook: budget
  // progress must reflect a card payment made moments ago (e.g. at EduMart) the instant
  // the student comes back to this tab, not up to 30s later.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const hasParent = permissions !== null;
  const allowedCategories = permissions?.allowedCategories ?? [];

  const budgetFor = (category: BudgetCategoryDefinition): BudgetCategory | undefined =>
    budgets.find((entry) => entry.category === category.key.toUpperCase());

  type LockedFundInfo = { total: number; remaining: number };

  // `amount` is the current remaining balance (decremented on spend); `totalLocked` is the
  // all-time total the parent has ever sent into this category (never decremented) — the
  // Locked Funds section needs both, not just the remaining balance.
  const lockedFundFor = (category: BudgetCategoryDefinition): LockedFundInfo => {
    const fund = lockedFunds.find((entry) => entry.category === category.key.toUpperCase());
    return {
      total: fund ? Number(fund.totalLocked) : 0,
      remaining: fund ? Number(fund.amount) : 0,
    };
  };

  // GENERAL spending is never category-locked by a parent (see wallet.service.ts transfer()),
  // so it's always authorized regardless of what the parent picked in their category list.
  const isAuthorized = (category: BudgetCategoryDefinition): boolean => {
    if (category.key === 'general') return true;
    if (!hasParent) return true;
    return allowedCategories.includes(category.key.toUpperCase() as TransactionCategory);
  };

  const openDialog = (category: BudgetCategoryDefinition) => {
    const existing = budgetFor(category);
    const hasExistingLimit = existing ? Number(existing.monthlyLimit) > 0 : false;
    setDialogAmount(hasExistingLimit ? existing!.monthlyLimit : '');
    setDialogCategory(category);
  };

  const closeDialog = () => setDialogCategory(null);

  const dialogLockedAmount = dialogCategory ? lockedFundFor(dialogCategory).total : 0;

  const handleDialogAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    if (dialogLockedAmount > 0 && Number(cleaned) > dialogLockedAmount) {
      setDialogAmount(String(dialogLockedAmount));
      return;
    }
    setDialogAmount(cleaned);
  };

  const handleSaveBudget = async () => {
    if (!dialogCategory) return;
    const limit = Number(dialogAmount);
    if (!(limit > 0)) return;
    if (dialogLockedAmount > 0 && limit > dialogLockedAmount) return;

    setIsSaving(true);
    try {
      const month = new Date().toISOString().slice(0, 7);
      await budgetService.setBudget(
        dialogCategory.key.toUpperCase() as TransactionCategory,
        limit,
        month
      );
      closeDialog();
      setSnackbarMessage(`${dialogCategory.label} budget updated.`);
      await loadBudgets();
    } catch (err) {
      setSnackbarMessage(err instanceof ApiError ? err.message : 'Could not save that budget.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Budget
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} />}
      >
        <View style={styles.bannerCard}>
          <Text style={styles.bannerText}>
            Track your locked funds and set your own monthly spending goals for categories your
            parent has authorized.
          </Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {VISIBLE_BUDGET_CATEGORIES.map((category) => {
          const { total: lockedTotal, remaining: lockedRemaining } = lockedFundFor(category);
          const budget = budgetFor(category);
          const spent = budget ? Number(budget.spent) : 0;
          const monthlyLimit = budget ? Number(budget.monthlyLimit) : 0;
          const hasLockedFunds = lockedTotal > 0;
          const hasPersonalLimit = monthlyLimit > 0;
          const authorized = isAuthorized(category);
          const isFullyEmpty = !hasLockedFunds && !hasPersonalLimit;

          if (isFullyEmpty && !authorized) {
            return (
              <View key={category.key} style={[styles.categoryCard, styles.categoryCardDimmed]}>
                <View style={styles.categoryTitleRow}>
                  <IconBadge icon={category.icon} color={colors.muted} size={40} />
                  <Text variant="titleMedium" style={[styles.categoryLabel, styles.categoryLabelDimmed]}>
                    {category.label}
                  </Text>
                </View>
                <Text style={styles.notAuthorizedText}>Not authorized by parent</Text>
              </View>
            );
          }

          // Spent from the locked pool = total ever locked minus what's still remaining —
          // deliberately not budget.spent, which is this month only and wouldn't reconcile
          // with an all-time total/remaining pair.
          const lockedSpent = Math.max(lockedTotal - lockedRemaining, 0);
          const lockedPercent = hasLockedFunds ? Math.round((lockedSpent / lockedTotal) * 100) : 0;
          const lockedColor = progressColor(lockedPercent);

          const budgetPercent = hasPersonalLimit ? Math.round((spent / monthlyLimit) * 100) : 0;
          const budgetColor = progressColor(budgetPercent);

          return (
            <View key={category.key} style={styles.categoryCard}>
              <View style={styles.categoryTitleRow}>
                <IconBadge icon={category.icon} color={category.color} size={40} />
                <Text variant="titleMedium" style={styles.categoryLabel}>
                  {category.label}
                </Text>
              </View>
              <Text style={styles.categoryDescription}>{CATEGORY_DESCRIPTIONS[category.key]}</Text>

              {isFullyEmpty ? (
                <View style={styles.placeholderRow}>
                  <Text style={styles.placeholderText}>No locked funds · No budget set</Text>
                  <Button
                    mode="text"
                    compact
                    textColor={colors.primary}
                    onPress={() => openDialog(category)}
                  >
                    Edit
                  </Button>
                </View>
              ) : (
                <>
                  {hasLockedFunds ? (
                    <View style={styles.sectionBlock}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>🔒 Locked Funds</Text>
                        <Text style={[styles.sectionPercent, { color: lockedColor }]}>
                          {lockedPercent}%
                        </Text>
                      </View>
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${Math.min(lockedPercent, 100)}%`, backgroundColor: lockedColor },
                          ]}
                        />
                      </View>
                      <View style={styles.sectionStatsRow}>
                        <View style={styles.sectionStatColumn}>
                          <Text style={styles.sectionStatLabel}>LOCKED</Text>
                          <Text style={styles.sectionStatValue}>${lockedTotal.toFixed(0)}</Text>
                        </View>
                        <View style={styles.sectionStatColumn}>
                          <Text style={styles.sectionStatLabel}>SPENT</Text>
                          <Text style={styles.sectionStatValue}>${lockedSpent.toFixed(0)}</Text>
                        </View>
                        <View style={[styles.sectionStatColumn, styles.sectionStatColumnEnd]}>
                          <Text style={styles.sectionStatLabel}>REMAINING</Text>
                          <Text style={styles.sectionStatValue}>${lockedRemaining.toFixed(0)}</Text>
                        </View>
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.sectionBlock}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionTitle}>Personal Budget</Text>
                      {authorized ? (
                        <Button
                          mode="text"
                          compact
                          textColor={colors.primary}
                          style={styles.inlineEditButton}
                          onPress={() => openDialog(category)}
                        >
                          Edit
                        </Button>
                      ) : null}
                    </View>

                    {!authorized ? (
                      <Text style={styles.notAuthorizedText}>Not authorized by parent</Text>
                    ) : hasPersonalLimit ? (
                      <>
                        <Text style={styles.sectionAmount}>
                          ${spent.toFixed(0)} of ${monthlyLimit.toFixed(0)} used this month
                        </Text>
                        <View style={styles.progressTrack}>
                          <View
                            style={[
                              styles.progressFill,
                              { width: `${Math.min(budgetPercent, 100)}%`, backgroundColor: budgetColor },
                            ]}
                          />
                        </View>
                      </>
                    ) : (
                      <Text style={styles.placeholderText}>No budget set</Text>
                    )}
                  </View>
                </>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Portal>
        <Dialog visible={dialogCategory !== null} onDismiss={closeDialog}>
          <Dialog.Title>{dialogCategory?.label} Budget</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Monthly limit"
              value={dialogAmount}
              onChangeText={handleDialogAmountChange}
              keyboardType="decimal-pad"
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
            />
            {dialogLockedAmount > 0 ? (
              <Text style={styles.dialogHelperText}>
                Capped at ${dialogLockedAmount.toFixed(0)} — your locked funds for this category.
              </Text>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeDialog} disabled={isSaving}>
              Cancel
            </Button>
            <Button onPress={handleSaveBudget} disabled={!(Number(dialogAmount) > 0) || isSaving}>
              {isSaving ? <ActivityIndicator size={16} color={colors.primary} /> : 'Save'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={snackbarMessage !== null}
        onDismiss={() => setSnackbarMessage(null)}
        duration={2500}
      >
        {snackbarMessage}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: {
    fontWeight: '700',
    color: colors.heading,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  bannerCard: {
    borderRadius: 14,
    marginBottom: 16,
    backgroundColor: colors.surface,
    padding: 16,
  },
  bannerText: {
    fontSize: 13,
    color: colors.label,
    lineHeight: 19,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  categoryCard: {
    borderRadius: 16,
    marginBottom: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  categoryCardDimmed: {
    opacity: 0.55,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryLabel: {
    fontWeight: '700',
    color: colors.heading,
    marginLeft: 12,
  },
  categoryLabelDimmed: {
    color: colors.muted,
  },
  categoryDescription: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 6,
    marginBottom: 4,
  },
  placeholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  placeholderText: {
    fontSize: 12,
    color: colors.muted,
  },
  notAuthorizedText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    fontStyle: 'italic',
    marginTop: 8,
  },
  sectionBlock: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.heading,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  sectionPercent: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionAmount: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 8,
  },
  sectionStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  sectionStatColumn: {
    alignItems: 'flex-start',
  },
  sectionStatColumnEnd: {
    alignItems: 'flex-end',
  },
  sectionStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: 2,
  },
  sectionStatValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.heading,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  inlineEditButton: {
    marginRight: -8,
  },
  dialogHelperText: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 8,
  },
});
