import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Button,
  Card,
  Dialog,
  Portal,
  ProgressBar,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import type { TransactionCategory } from '../types/api';
import IconBadge from '../components/IconBadge';
import { BUDGET_CATEGORIES } from '../constants/budgetCategories';
import type { BudgetCategoryDefinition } from '../constants/budgetCategories';
import { colors } from '../theme/colors';
import * as budgetService from '../services/budgetService';
import type { BudgetSummary } from '../services/budgetService';
import { ApiError } from '../services/api';
import type { StudentTabScreenProps } from '../navigation/types';

export default function BudgetScreen(_props: Readonly<StudentTabScreenProps<'Budget'>>) {
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
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
      const result = await budgetService.getBudgetSummary();
      setSummary(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load your budgets.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categoryData = (category: BudgetCategoryDefinition) =>
    summary?.categories.find((entry) => entry.category === category.key.toUpperCase()) ?? null;

  const openDialog = (category: BudgetCategoryDefinition) => {
    const existing = categoryData(category);
    setDialogAmount(existing ? String(existing.monthlyLimit) : '');
    setDialogCategory(category);
  };

  const handleSaveBudget = async () => {
    if (!dialogCategory) return;
    const limit = Number(dialogAmount);
    if (!(limit > 0)) return;

    setIsSaving(true);
    try {
      const month = new Date().toISOString().slice(0, 7);
      await budgetService.setBudget(
        dialogCategory.key.toUpperCase() as TransactionCategory,
        limit,
        month
      );
      setDialogCategory(null);
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
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {summary?.alerts.map((alert) => (
          <Card
            key={alert.category}
            style={[
              styles.alertCard,
              { backgroundColor: alert.severity === 'OVERSPENT' ? '#FEF2F2' : '#FFFBEB' },
            ]}
            mode="contained"
          >
            <Card.Content>
              <Text
                style={{
                  color: alert.severity === 'OVERSPENT' ? colors.danger : '#B45309',
                  fontWeight: '600',
                  fontSize: 12,
                }}
              >
                {alert.message}
              </Text>
            </Card.Content>
          </Card>
        ))}

        {BUDGET_CATEGORIES.map((category) => {
          const data = categoryData(category);
          const spent = data?.spent ?? 0;
          const limit = data?.monthlyLimit ?? 0;
          const progress = limit > 0 ? Math.min(spent / limit, 1) : 0;

          return (
            <Card key={category.key} style={styles.categoryCard} mode="elevated">
              <Card.Content>
                <View style={styles.categoryHeaderRow}>
                  <View style={styles.categoryTitleRow}>
                    <IconBadge icon={category.icon} color={category.color} size={40} />
                    <Text variant="titleMedium" style={styles.categoryLabel}>
                      {category.label}
                    </Text>
                  </View>
                  <Text style={styles.categoryAmount}>
                    ${spent.toFixed(0)} / ${limit.toFixed(0)}
                  </Text>
                </View>

                <ProgressBar
                  progress={progress}
                  color={data?.overspent ? colors.danger : category.color}
                  style={styles.progressBar}
                />

                <View style={styles.categoryFooterRow}>
                  <Text style={styles.categoryUsed}>
                    {limit > 0 ? `${Math.round(progress * 100)}% used` : 'No budget set'}
                  </Text>
                  <Button mode="text" compact textColor={colors.primary} onPress={() => openDialog(category)}>
                    {limit > 0 ? 'Edit' : 'Set Budget'}
                  </Button>
                </View>
              </Card.Content>
            </Card>
          );
        })}
      </ScrollView>

      <Portal>
        <Dialog visible={dialogCategory !== null} onDismiss={() => setDialogCategory(null)}>
          <Dialog.Title>{dialogCategory?.label} Budget</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Monthly limit"
              value={dialogAmount}
              onChangeText={(text: string) => setDialogAmount(text.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogCategory(null)} disabled={isSaving}>
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
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  alertCard: {
    borderRadius: 12,
    marginBottom: 12,
  },
  categoryCard: {
    borderRadius: 16,
    marginBottom: 14,
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
  categoryAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surface,
  },
  categoryFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  categoryUsed: {
    fontSize: 12,
    color: colors.muted,
  },
});
