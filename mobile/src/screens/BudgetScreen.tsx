import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
import { progressColorFor } from '../utils/progressColor';
import { useNotificationRefetch } from '../hooks/useNotificationRefetch';
import type { StudentTabScreenProps } from '../navigation/types';

// Dark-on-light pair matching this app's established badge palette (not colors.danger/accent,
// which read as a different, brighter family) — keeps "remaining" visually consistent with the
// rest of the app's status text rather than looking like an unrelated accent color.
function remainingColorFor(remaining: number, total: number): string {
  if (remaining <= 0) return '#991B1B';
  const percentLeft = total > 0 ? (remaining / total) * 100 : 0;
  if (percentLeft <= 20) return '#92400E';
  return '#065F46';
}

// NOTE: this screen deliberately avoids react-native-paper's Card and ProgressBar.
// Both use elevation/shadow-driven internals that were confirmed (via live screenshots)
// to break on the web renderer here: every category's progress bar / used-text / Edit
// button was collapsing out of its own card and stacking on top of each other below
// the last card, so tapping "Edit" on any card opened whichever category rendered last.
// Plain Views render correctly everywhere, so the whole card body is built from those.

const SCREEN_BACKGROUND = '#F8FAFC';

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

export default function BudgetScreen(_props: Readonly<StudentTabScreenProps<'Budget'>>) {
  const { lockedFunds, refresh: refreshWallet } = useWallet();
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
    // lockedFunds (total/remaining per category) lives in WalletContext, not fetched by
    // loadBudgets() above — without this, the Locked Funds progress bar shows whatever was
    // last fetched by an unrelated screen (e.g. Dashboard) instead of the latest spend, which
    // is exactly the "always 0%" staleness this screen exists to avoid (see comment below).
    void refreshWallet();
  }, [loadBudgets, loadPermissions, refreshWallet]);

  // Unlike other screens, this deliberately skips the 30s-throttled focus hook: budget
  // progress must reflect a card payment made moments ago (e.g. at EduMart) the instant
  // the student comes back to this tab, not up to 30s later.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useNotificationRefetch(load);

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
  const currentDialogLimit = dialogCategory ? Number(budgetFor(dialogCategory)?.monthlyLimit ?? 0) : 0;

  const handleDialogAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    if (dialogLockedAmount > 0 && Number(cleaned) > dialogLockedAmount) {
      setDialogAmount(String(dialogLockedAmount));
      return;
    }
    setDialogAmount(cleaned);
  };

  const canSaveDialog = dialogAmount.trim().length > 0 && !isSaving;

  const handleSaveBudget = async () => {
    if (!dialogCategory || !canSaveDialog) return;
    const limit = dialogAmount.trim() === '' ? 0 : Number(dialogAmount);
    if (dialogLockedAmount > 0 && limit > dialogLockedAmount) return;

    const existingBudget = budgetFor(dialogCategory);
    const hasExistingLimit = existingBudget ? Number(existingBudget.monthlyLimit) > 0 : false;

    // 0 with nothing currently set has nothing to remove and nothing to set — just close.
    if (limit === 0 && !hasExistingLimit) {
      closeDialog();
      return;
    }

    setIsSaving(true);
    try {
      const month = new Date().toISOString().slice(0, 7);
      if (limit === 0) {
        await budgetService.deleteBudget(dialogCategory.key.toUpperCase() as TransactionCategory, month);
      } else {
        await budgetService.setBudget(
          dialogCategory.key.toUpperCase() as TransactionCategory,
          limit,
          month
        );
      }
      closeDialog();
      setSnackbarMessage(
        limit === 0 ? `${dialogCategory.label} budget removed.` : `${dialogCategory.label} budget updated.`
      );
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
        <Text style={styles.headerTitle}>Budget</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} />}
      >
        <View style={styles.bannerCard}>
          <Text style={styles.bannerIcon}>ℹ️</Text>
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
              <View
                key={category.key}
                style={[styles.categoryCard, styles.categoryCardDimmed, styles.categoryCardBorderGray]}
              >
                <View style={styles.categoryTitleRow}>
                  <IconBadge icon={category.icon} color={colors.muted} size={44} />
                  <Text style={[styles.categoryLabel, styles.categoryLabelDimmed]}>
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
          const lockedColor = progressColorFor(lockedPercent);

          const budgetPercent = hasPersonalLimit ? Math.round((spent / monthlyLimit) * 100) : 0;
          const budgetColor = progressColorFor(budgetPercent);

          return (
            <View key={category.key} style={[styles.categoryCard, styles.categoryCardBorderGreen]}>
              <View style={styles.categoryTitleRow}>
                <IconBadge icon={category.icon} color={category.color} size={44} />
                <Text style={styles.categoryLabel}>{category.label}</Text>
              </View>
              <Text style={styles.categoryDescription}>{CATEGORY_DESCRIPTIONS[category.key]}</Text>
              <View style={styles.divider} />

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
                        <View style={styles.sectionHeaderLeft}>
                          <MaterialCommunityIcons name="lock-outline" size={15} color={colors.primary} />
                          <Text style={styles.sectionTitle}>Locked</Text>
                        </View>
                        <Text style={styles.sectionAmountBold}>${lockedTotal.toFixed(2)}</Text>
                      </View>
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${Math.min(lockedPercent, 100)}%`, backgroundColor: lockedColor },
                          ]}
                        />
                      </View>
                      <Text style={styles.sectionCaption}>
                        ${lockedSpent.toFixed(2)} spent ·{' '}
                        <Text style={{ color: remainingColorFor(lockedRemaining, lockedTotal) }}>
                          ${lockedRemaining.toFixed(2)} remaining
                        </Text>
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.sectionBlock}>
                    <View style={styles.sectionHeaderRow}>
                      <View style={styles.sectionHeaderLeft}>
                        <MaterialCommunityIcons
                          name="calendar-month-outline"
                          size={15}
                          color={colors.primary}
                        />
                        <Text style={styles.sectionTitle}>Monthly Budget</Text>
                      </View>
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
                        <View style={styles.progressTrack}>
                          <View
                            style={[
                              styles.progressFill,
                              { width: `${Math.min(budgetPercent, 100)}%`, backgroundColor: budgetColor },
                            ]}
                          />
                        </View>
                        <Text style={styles.sectionCaption}>
                          ${spent.toFixed(2)} used of ${monthlyLimit.toFixed(2)} monthly budget
                        </Text>
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
        <Dialog
          visible={dialogCategory !== null}
          onDismiss={closeDialog}
          style={styles.dialogContainer}
        >
          <View style={styles.dialogTitleRow}>
            {dialogCategory ? (
              <View
                style={[styles.dialogTitleIconCircle, { backgroundColor: `${dialogCategory.color}1F` }]}
              >
                <MaterialCommunityIcons
                  name={dialogCategory.icon}
                  size={18}
                  color={dialogCategory.color}
                />
              </View>
            ) : null}
            <Text style={styles.dialogTitleText}>{dialogCategory?.label} Budget</Text>
          </View>
          <Dialog.Content>
            <Text style={styles.dialogFieldLabel}>Monthly Limit ($)</Text>
            <TextInput
              mode="outlined"
              placeholder="0"
              value={dialogAmount}
              onChangeText={handleDialogAmountChange}
              keyboardType="decimal-pad"
              left={<TextInput.Icon icon="currency-usd" />}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              theme={{ roundness: 12 }}
              style={styles.dialogInput}
            />
            <Text style={styles.dialogHelperText}>Set to 0 to remove the budget limit</Text>
            {currentDialogLimit > 0 ? (
              <Text style={styles.dialogCurrentText}>Current: ${currentDialogLimit.toFixed(0)}/month</Text>
            ) : null}
            {dialogLockedAmount > 0 ? (
              <Text style={styles.dialogHelperText}>
                Capped at ${dialogLockedAmount.toFixed(0)} — your locked funds for this category.
              </Text>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button
              mode="outlined"
              textColor={colors.muted}
              style={styles.dialogCancelButton}
              disabled={isSaving}
              onPress={closeDialog}
            >
              Cancel
            </Button>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={!canSaveDialog}
              onPress={handleSaveBudget}
              style={styles.dialogPrimaryButtonWrapper}
            >
              <LinearGradient
                colors={
                  canSaveDialog ? [colors.gradientStart, colors.gradientEnd] : [colors.border, colors.border]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.dialogPrimaryButton}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text
                    style={[
                      styles.dialogPrimaryButtonText,
                      { color: canSaveDialog ? '#FFFFFF' : colors.muted },
                    ]}
                  >
                    Save
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
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
    backgroundColor: SCREEN_BACKGROUND,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.heading,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  bannerCard: {
    flexDirection: 'row',
    borderRadius: 14,
    marginBottom: 16,
    backgroundColor: `${colors.primary}14`,
    padding: 14,
  },
  bannerIcon: {
    fontSize: 15,
    marginRight: 8,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.primaryDark,
    lineHeight: 19,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  categoryCard: {
    borderRadius: 16,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  categoryCardBorderGreen: {
    borderLeftColor: colors.accent,
  },
  categoryCardBorderGray: {
    borderLeftColor: colors.border,
  },
  categoryCardDimmed: {
    opacity: 0.6,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryLabel: {
    fontSize: 16,
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
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: 12,
  },
  placeholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  placeholderText: {
    fontSize: 12,
    color: colors.muted,
  },
  notAuthorizedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B91C1C',
    fontStyle: 'italic',
    marginTop: 12,
  },
  sectionBlock: {
    marginTop: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.heading,
    marginLeft: 6,
  },
  sectionAmountBold: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  sectionCaption: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 6,
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
  dialogCurrentText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 6,
  },
  dialogContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  dialogTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
  },
  dialogTitleIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  dialogTitleText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    flexShrink: 1,
  },
  dialogFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  dialogInput: {
    backgroundColor: '#FFFFFF',
  },
  dialogActions: {
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
  },
  dialogCancelButton: {
    flex: 1,
    marginRight: 10,
    borderRadius: 12,
    borderColor: colors.border,
  },
  dialogPrimaryButtonWrapper: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  dialogPrimaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 12,
  },
  dialogPrimaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
