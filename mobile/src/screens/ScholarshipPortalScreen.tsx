import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TextInput as NativeTextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Avatar, Button, Card, Checkbox, Chip, Snackbar, Text } from 'react-native-paper';
import type { Transaction, TransactionCategory, User } from '../types/api';
import CategorySelectorGrid from '../components/CategorySelectorGrid';
import IconBadge from '../components/IconBadge';
import { BUDGET_CATEGORIES } from '../constants/budgetCategories';
import type { BudgetCategoryDefinition, BudgetCategoryKey } from '../constants/budgetCategories';
import { colors } from '../theme/colors';
import { getInitials } from '../utils/getInitials';
import * as scholarshipService from '../services/scholarshipService';
import * as walletService from '../services/walletService';
import { ApiError } from '../services/api';

const categoryLookup = new Map(BUDGET_CATEGORIES.map((category) => [category.key, category]));

const formatDate = (isoDate: string) =>
  new Date(isoDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

export default function ScholarshipPortalScreen() {
  const [students, setStudents] = useState<User[]>([]);
  const [disbursements, setDisbursements] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<BudgetCategoryDefinition | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const parsedAmount = Number(amount);
  const canSend = selectedIds.size > 0 && parsedAmount > 0 && Boolean(category) && !isSending;

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [studentsResult, transactionsResult] = await Promise.all([
        scholarshipService.getStudents(),
        walletService.getTransactions({ limit: 100 }),
      ]);
      setStudents(studentsResult);
      setDisbursements(transactionsResult.transactions.filter((tx) => tx.fromWalletId !== null));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load the scholarship portal.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSendDisbursement = async () => {
    if (!category || !canSend) return;
    setIsSending(true);
    try {
      await scholarshipService.bulkDisburse({
        studentIds: [...selectedIds],
        amountPerStudent: parsedAmount,
        currency: 'USD',
        category: category.key.toUpperCase() as TransactionCategory,
      });
      setSnackbarMessage(`Disbursement sent to ${selectedIds.size} student${selectedIds.size === 1 ? '' : 's'}.`);
      setSelectedIds(new Set());
      setAmount('');
      setCategory(null);
      await load();
    } catch (err) {
      setSnackbarMessage(err instanceof ApiError ? err.message : 'Could not send that disbursement.');
    } finally {
      setIsSending(false);
    }
  };

  const reports = useMemo(() => {
    const totalDisbursed = disbursements.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const studentsFunded = new Set(disbursements.map((tx) => tx.toWalletId)).size;
    const totalsByCategory = new Map<string, number>();
    disbursements.forEach((tx) => {
      const key = tx.category.toLowerCase();
      totalsByCategory.set(key, (totalsByCategory.get(key) ?? 0) + Number(tx.amount));
    });
    const topCategory = [...totalsByCategory.entries()].reduce<{
      category: BudgetCategoryDefinition | null;
      amount: number;
    }>(
      (best, [key, total]) => {
        if (total <= best.amount) return best;
        return { category: categoryLookup.get(key as BudgetCategoryKey) ?? null, amount: total };
      },
      { category: null, amount: 0 }
    ).category;

    return { totalDisbursed, studentsFunded, topCategory };
  }, [disbursements]);

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Scholarship Portal
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} />}
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.sectionLabel}>
          Registered Students {selectedIds.size > 0 ? `(${selectedIds.size} selected)` : ''}
        </Text>
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            {isLoading && students.length === 0 ? (
              <ActivityIndicator color={colors.primary} />
            ) : students.length > 0 ? (
              students.map((student) => {
                const checked = selectedIds.has(student.id);
                return (
                  <TouchableOpacity
                    key={student.id}
                    style={styles.studentRow}
                    onPress={() => toggleStudent(student.id)}
                  >
                    <Checkbox
                      status={checked ? 'checked' : 'unchecked'}
                      onPress={() => toggleStudent(student.id)}
                      color={colors.primary}
                    />
                    <Avatar.Text
                      size={36}
                      label={getInitials(student.fullName)}
                      style={styles.studentAvatar}
                      color={colors.onPrimary}
                    />
                    <View style={styles.studentMiddle}>
                      <Text style={styles.studentName}>{student.fullName}</Text>
                      <Text style={styles.studentUniversity}>{student.email}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={styles.emptySubtitle}>No students registered yet.</Text>
            )}
          </Card.Content>
        </Card>

        <Text style={styles.sectionLabel}>Bulk Disbursement</Text>
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <Text style={styles.fieldLabel}>Amount per Student</Text>
            <View style={styles.amountContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <NativeTextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={(text: string) => setAmount(text.replace(/[^0-9.]/g, ''))}
                placeholder="0.00"
                placeholderTextColor={colors.placeholder}
                keyboardType="decimal-pad"
              />
            </View>

            <Text style={styles.fieldLabel}>Category Lock</Text>
            <CategorySelectorGrid value={category} onChange={setCategory} />

            <Button
              mode="contained"
              buttonColor={colors.primary}
              icon="send-outline"
              disabled={!canSend}
              loading={isSending}
              style={styles.sendButton}
              contentStyle={styles.sendButtonContent}
              onPress={handleSendDisbursement}
            >
              Send Disbursement
            </Button>
          </Card.Content>
        </Card>

        <Text style={styles.sectionLabel}>Disbursement History</Text>
        {disbursements.length > 0 ? (
          disbursements.map((tx) => {
            const cat = categoryLookup.get(tx.category.toLowerCase() as BudgetCategoryKey);
            return (
              <View key={tx.id} style={styles.historyRow}>
                <IconBadge icon={cat?.icon ?? 'wallet-outline'} color={cat?.color ?? colors.primary} size={40} />
                <View style={styles.historyMiddle}>
                  <Text style={styles.historyTitle}>
                    {cat?.label ?? 'Payment'} • ${Number(tx.amount).toFixed(2)}
                  </Text>
                  <Text style={styles.historySubtitle}>{formatDate(tx.createdAt)}</Text>
                </View>
                <Text style={styles.historyAmount}>${Number(tx.amount).toFixed(2)}</Text>
              </View>
            );
          })
        ) : (
          <Card style={styles.card} mode="elevated">
            <Card.Content style={styles.emptyState}>
              <Avatar.Icon
                icon="send-outline"
                size={48}
                style={styles.emptyIcon}
                color={colors.primary}
              />
              <Text style={styles.emptyTitle}>No disbursements yet</Text>
              <Text style={styles.emptySubtitle}>Sent disbursements will show up here.</Text>
            </Card.Content>
          </Card>
        )}

        <Text style={styles.sectionLabel}>Reports</Text>
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <View style={styles.reportRow}>
              <Text style={styles.reportLabel}>Total Disbursed</Text>
              <Text style={styles.reportValue}>${reports.totalDisbursed.toFixed(2)}</Text>
            </View>
            <View style={styles.reportRow}>
              <Text style={styles.reportLabel}>Students Funded</Text>
              <Text style={styles.reportValue}>{reports.studentsFunded}</Text>
            </View>
            <View style={styles.reportRow}>
              <Text style={styles.reportLabel}>Top Category</Text>
              {reports.topCategory ? (
                <Chip
                  compact
                  style={[styles.reportChip, { backgroundColor: `${reports.topCategory.color}1F` }]}
                  textStyle={{ color: reports.topCategory.color, fontWeight: '700', fontSize: 11 }}
                >
                  {reports.topCategory.label}
                </Chip>
              ) : (
                <Text style={styles.reportValue}>—</Text>
              )}
            </View>
          </Card.Content>
        </Card>
      </ScrollView>

      <Snackbar
        visible={snackbarMessage !== null}
        onDismiss={() => setSnackbarMessage(null)}
        duration={2500}
      >
        {snackbarMessage ?? ''}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
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
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.label,
    marginBottom: 10,
  },
  card: {
    borderRadius: 16,
    marginBottom: 24,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  studentAvatar: {
    backgroundColor: colors.primary,
    marginLeft: 4,
  },
  studentMiddle: {
    flex: 1,
    marginLeft: 12,
  },
  studentName: {
    fontWeight: '700',
    color: colors.heading,
    fontSize: 14,
  },
  studentUniversity: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.label,
    marginBottom: 10,
    marginTop: 4,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.heading,
    marginRight: 4,
  },
  amountInput: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.heading,
    minWidth: 100,
    textAlign: 'center',
    padding: 0,
  },
  sendButton: {
    borderRadius: 10,
    marginTop: 8,
  },
  sendButtonContent: {
    paddingVertical: 6,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  historyMiddle: {
    flex: 1,
    marginLeft: 12,
  },
  historyTitle: {
    fontWeight: '700',
    color: colors.heading,
    fontSize: 13,
  },
  historySubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  historyAmount: {
    fontWeight: '700',
    color: colors.heading,
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyIcon: {
    backgroundColor: colors.background,
    marginBottom: 10,
  },
  emptyTitle: {
    fontWeight: '700',
    color: colors.heading,
    marginBottom: 4,
  },
  emptySubtitle: {
    color: colors.muted,
  },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  reportLabel: {
    fontSize: 13,
    color: colors.muted,
  },
  reportValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.heading,
  },
  reportChip: {
    height: 26,
  },
});
