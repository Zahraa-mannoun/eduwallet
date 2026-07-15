import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Avatar, Button, Card, Chip, Text } from 'react-native-paper';
import type { Transaction } from '../types/api';
import IconBadge from '../components/IconBadge';
import { BUDGET_CATEGORIES } from '../constants/budgetCategories';
import type { BudgetCategoryKey } from '../constants/budgetCategories';
import { TRANSACTION_STATUS_META } from '../constants/mockTransactions';
import { useWallet } from '../context/WalletContext';
import { useThrottledFocusEffect } from '../hooks/useThrottledFocusEffect';
import { colors } from '../theme/colors';
import { getInitials } from '../utils/getInitials';
import * as parentalService from '../services/parentalService';
import type { LinkedStudent } from '../services/parentalService';
import { ApiError } from '../services/api';
import type { ParentTabScreenProps } from '../navigation/types';

const categoryLookup = new Map(BUDGET_CATEGORIES.map((category) => [category.key, category]));
const PENDING_PREVIEW_COUNT = 2;

function transactionTitle(transaction: Transaction): string {
  if (transaction.note) return transaction.note;
  const category = categoryLookup.get(transaction.category.toLowerCase() as BudgetCategoryKey);
  return category?.label ?? 'Payment';
}

export default function ParentDashboardScreen({
  navigation,
}: Readonly<ParentTabScreenProps<'Home'>>) {
  const { wallet: parentWallet, refresh: refreshParentWallet } = useWallet();
  const [students, setStudents] = useState<LinkedStudent[]>([]);
  const [approvals, setApprovals] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [studentsResult, approvalsResult] = await Promise.all([
        parentalService.getLinkedStudents(),
        parentalService.getPendingApprovals(),
      ]);
      setStudents(studentsResult);
      setApprovals(approvalsResult);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load your dashboard.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshDashboard = useCallback(() => {
    void load();
    void refreshParentWallet();
  }, [load, refreshParentWallet]);

  useThrottledFocusEffect(refreshDashboard);

  const walletToStudentName = useMemo(() => {
    const map = new Map<string, string>();
    students.forEach(({ student, wallets }) => {
      wallets.forEach((wallet) => map.set(wallet.id, student.fullName));
    });
    return map;
  }, [students]);

  const totalBalance = useMemo(
    () =>
      students.reduce((sum, { wallets }) => sum + wallets.reduce((s, w) => s + Number(w.balance), 0), 0),
    [students]
  );

  const pendingPreview = approvals.slice(0, PENDING_PREVIEW_COUNT);

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Parent Dashboard
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} />}
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.walletCard}
        >
          <Text style={styles.balanceLabel}>Your Wallet Balance</Text>
          {!parentWallet ? (
            <ActivityIndicator color={colors.onPrimary} style={styles.balanceLoading} />
          ) : (
            <Text style={styles.balanceValue}>
              ${Number(parentWallet.balance).toFixed(2)} {parentWallet.currency}
            </Text>
          )}
          <Text style={styles.walletNote}>Contact admin to add funds to your wallet</Text>
        </LinearGradient>

        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.studentCard}
        >
          <View style={styles.studentRow}>
            <Avatar.Text
              size={48}
              label={getInitials(students[0]?.student.fullName ?? 'S')}
              style={styles.studentAvatar}
              color={colors.primary}
            />
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>
                {students.length > 1
                  ? `${students.length} linked students`
                  : students[0]?.student.fullName ?? 'No students linked'}
              </Text>
              <Text style={styles.studentUniversity}>
                {students.length > 0 ? students.map((s) => s.student.email).join(', ') : ''}
              </Text>
            </View>
          </View>
          <Text style={styles.balanceLabel}>Total Student Balance</Text>
          {isLoading && students.length === 0 ? (
            <ActivityIndicator color={colors.onPrimary} style={styles.balanceLoading} />
          ) : (
            <Text style={styles.balanceValue}>${totalBalance.toFixed(2)}</Text>
          )}
        </LinearGradient>

        <View style={styles.pendingHeaderRow}>
          <Text style={styles.sectionLabel}>Pending Approvals</Text>
          <Button
            mode="text"
            compact
            textColor={colors.primary}
            onPress={() => navigation.navigate('Approvals')}
          >
            See All
          </Button>
        </View>
        {pendingPreview.length > 0 ? (
          pendingPreview.map((transaction) => {
            const category = categoryLookup.get(
              transaction.category.toLowerCase() as BudgetCategoryKey
            );
            const statusMeta = TRANSACTION_STATUS_META[transaction.status];
            const studentName = transaction.fromWalletId
              ? (walletToStudentName.get(transaction.fromWalletId) ?? 'Student')
              : 'Student';
            return (
              <TouchableOpacity
                key={transaction.id}
                style={styles.approvalRow}
                onPress={() =>
                  navigation.navigate('ApprovalRequest', { transaction, studentName })
                }
              >
                <IconBadge
                  icon={category?.icon ?? 'wallet-outline'}
                  color={category?.color ?? colors.primary}
                  size={44}
                />
                <View style={styles.approvalMiddle}>
                  <Text style={styles.approvalTitle}>{transactionTitle(transaction)}</Text>
                  <Text style={styles.approvalSubtitle}>
                    {studentName} • ${Number(transaction.amount).toFixed(2)}
                  </Text>
                </View>
                <Chip
                  compact
                  style={[styles.approvalChip, { backgroundColor: `${statusMeta.color}1F` }]}
                  textStyle={{ color: statusMeta.color, fontSize: 11, fontWeight: '700' }}
                >
                  Review
                </Chip>
              </TouchableOpacity>
            );
          })
        ) : (
          <Card style={styles.emptyCard} mode="elevated">
            <Card.Content style={styles.emptyState}>
              <Avatar.Icon
                icon="check-circle-outline"
                size={48}
                style={styles.emptyIcon}
                color={colors.accent}
              />
              <Text style={styles.emptyTitle}>No pending approvals</Text>
              <Text style={styles.emptySubtitle}>You&apos;re all caught up.</Text>
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
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
  walletCard: {
    borderRadius: 20,
    padding: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  walletNote: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    marginTop: 10,
  },
  studentCard: {
    borderRadius: 20,
    padding: 20,
    marginTop: 8,
    marginBottom: 24,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  studentAvatar: {
    backgroundColor: colors.onPrimary,
  },
  studentInfo: {
    marginLeft: 12,
    flex: 1,
  },
  studentName: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  studentUniversity: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: 2,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
  },
  balanceValue: {
    color: colors.onPrimary,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 2,
  },
  balanceLoading: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.label,
    marginBottom: 10,
  },
  pendingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  approvalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  approvalMiddle: {
    flex: 1,
    marginLeft: 12,
  },
  approvalTitle: {
    fontWeight: '700',
    color: colors.heading,
  },
  approvalSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  approvalChip: {
    height: 26,
  },
  emptyCard: {
    borderRadius: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyIcon: {
    backgroundColor: colors.surface,
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
});
