import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { BUDGET_CATEGORIES } from '../constants/budgetCategories';
import type { BudgetCategoryDefinition, BudgetCategoryKey } from '../constants/budgetCategories';
import { colors } from '../theme/colors';
import { useWallet } from '../context/WalletContext';
import { useThrottledFocusEffect } from '../hooks/useThrottledFocusEffect';
import * as budgetService from '../services/budgetService';
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
  personal: 'Everyday personal expenses',
  general: 'Miscellaneous spending',
};

const OVERSPENT_THRESHOLD = 100;
const APPROACHING_THRESHOLD = 90;

type CategoryStats = {
  spent: number;
  limit: number;
  percentUsed: number;
  overspent: boolean;
};

function statsFor(budget: BudgetCategory | undefined): CategoryStats {
  const spent = budget ? Number(budget.spent) : 0;
  const limit = budget ? Number(budget.monthlyLimit) : 0;
  const percentUsed = limit > 0 ? Math.round((spent / limit) * 100) : 0;
  return { spent, limit, overspent: spent > limit && limit > 0, percentUsed };
}

export default function BudgetScreen(_props: Readonly<StudentTabScreenProps<'Budget'>>) {
  const { lockedFunds } = useWallet();
  const [budgets, setBudgets] = useState<BudgetCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogCategory, setDialogCategory] = useState<BudgetCategoryDefinition | null>(null);
  const [dialogAmount, setDialogAmount] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
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

  useThrottledFocusEffect(load);

  const budgetFor = (category: BudgetCategoryDefinition): BudgetCategory | undefined =>
    budgets.find((entry) => entry.category === category.key.toUpperCase());

  const lockedFundFor = (category: BudgetCategoryDefinition): number => {
    const fund = lockedFunds.find((entry) => entry.category === category.key.toUpperCase());
    return fund ? Number(fund.amount) : 0;
  };

  const openDialog = (category: BudgetCategoryDefinition) => {
    const existing = budgetFor(category);
    setDialogAmount(existing ? existing.monthlyLimit : '');
    setDialogCategory(category);
  };

  const closeDialog = () => setDialogCategory(null);

  const dialogLockedAmount = dialogCategory ? lockedFundFor(dialogCategory) : 0;

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
      await load();
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
            Set your own monthly spending limits for each category. This is your personal
            financial management tool — track and control your own spending goals.
          </Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {BUDGET_CATEGORIES.map((category) => {
          const stats = statsFor(budgetFor(category));
          const progress = stats.limit > 0 ? Math.min(stats.spent / stats.limit, 1) : 0;
          const locked = lockedFundFor(category);

          let alertText: string | null = null;
          if (stats.limit > 0 && stats.percentUsed >= OVERSPENT_THRESHOLD) {
            alertText = `Overspent by $${(stats.spent - stats.limit).toFixed(2)}`;
          } else if (stats.limit > 0 && stats.percentUsed >= APPROACHING_THRESHOLD) {
            alertText = `${stats.percentUsed}% of this budget used`;
          }

          const exceedsLockedFunds = stats.limit > 0 && locked > 0 && stats.limit > locked;

          return (
            <View key={category.key} style={styles.categoryCard}>
              <View style={styles.categoryHeaderRow}>
                <View style={styles.categoryTitleRow}>
                  <IconBadge icon={category.icon} color={category.color} size={40} />
                  <Text variant="titleMedium" style={styles.categoryLabel}>
                    {category.label}
                  </Text>
                </View>
                <View style={styles.categoryAmountColumn}>
                  <Text style={styles.categoryAmount}>
                    ${stats.spent.toFixed(0)} / ${stats.limit.toFixed(0)}
                  </Text>
                  {locked > 0 ? (
                    <Text style={styles.lockedText}>🔒 ${locked.toFixed(0)} locked</Text>
                  ) : null}
                </View>
              </View>

              <Text style={styles.categoryDescription}>{CATEGORY_DESCRIPTIONS[category.key]}</Text>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.round(progress * 100)}%`,
                      backgroundColor: stats.overspent ? colors.danger : category.color,
                    },
                  ]}
                />
              </View>

              <Text style={styles.categoryUsed}>
                {stats.limit > 0 ? `${stats.percentUsed}% used` : 'No budget set'}
              </Text>

              {alertText ? (
                <Text
                  style={[
                    styles.alertText,
                    { color: stats.percentUsed >= OVERSPENT_THRESHOLD ? colors.danger : '#B45309' },
                  ]}
                >
                  {alertText}
                </Text>
              ) : null}

              {exceedsLockedFunds ? (
                <Text style={styles.lockedWarningText}>
                  Your budget limit exceeds your available locked funds for this category. Actual
                  spending is limited by your wallet balance.
                </Text>
              ) : null}

              <Button
                mode="contained"
                compact
                buttonColor={colors.primary}
                textColor={colors.onPrimary}
                style={styles.editButton}
                contentStyle={styles.editButtonContent}
                onPress={() => openDialog(category)}
              >
                Edit
              </Button>
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
  categoryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  categoryAmountColumn: {
    alignItems: 'flex-end',
  },
  categoryAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  lockedText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 2,
  },
  lockedWarningText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
    marginTop: 6,
  },
  categoryDescription: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 10,
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
  categoryUsed: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 6,
  },
  alertText: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  editButton: {
    borderRadius: 10,
    marginTop: 14,
    alignSelf: 'stretch',
  },
  editButtonContent: {
    paddingVertical: 4,
  },
  dialogHelperText: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 8,
  },
});
