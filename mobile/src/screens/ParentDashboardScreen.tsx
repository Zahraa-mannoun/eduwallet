import { useMemo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Button, Card, Chip, Text } from 'react-native-paper';
import CategorySpendBarRow from '../components/CategorySpendBarRow';
import IconBadge from '../components/IconBadge';
import { BUDGET_CATEGORIES } from '../constants/budgetCategories';
import { MOCK_TRANSACTIONS, TRANSACTION_STATUS_META } from '../constants/mockTransactions';
import { colors } from '../theme/colors';
import { getCategorySpendTotals } from '../utils/getCategorySpendTotals';
import type { ParentTabScreenProps } from '../navigation/types';

const STUDENT_BALANCE = 1250.0;
const PENDING_PREVIEW_COUNT = 2;

export default function ParentDashboardScreen({ navigation }: ParentTabScreenProps<'Home'>) {
  const spendingByCategory = useMemo(() => {
    const totals = getCategorySpendTotals(MOCK_TRANSACTIONS);
    const maxSpent = Math.max(1, ...Array.from(totals.values()));
    return BUDGET_CATEGORIES.map((category) => {
      const spent = totals.get(category.key) ?? 0;
      return { ...category, spent, progress: spent / maxSpent };
    });
  }, []);

  const pendingApprovals = useMemo(
    () => MOCK_TRANSACTIONS.filter((tx) => tx.status === 'PENDING').slice(0, PENDING_PREVIEW_COUNT),
    []
  );

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Parent Dashboard
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.studentCard}
        >
          <View style={styles.studentRow}>
            <Avatar.Text size={48} label="ZS" style={styles.studentAvatar} color={colors.primary} />
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>Zahraa Student</Text>
              <Text style={styles.studentUniversity}>American University of Beirut</Text>
            </View>
          </View>
          <Text style={styles.balanceLabel}>Student Balance</Text>
          <Text style={styles.balanceValue}>${STUDENT_BALANCE.toFixed(2)}</Text>
        </LinearGradient>

        <Text style={styles.sectionLabel}>Spending by Category</Text>
        <Card style={styles.spendingCard} mode="elevated">
          <Card.Content>
            {spendingByCategory.map((category) => (
              <CategorySpendBarRow
                key={category.key}
                icon={category.icon}
                color={category.color}
                label={category.label}
                amount={category.spent}
                progress={category.progress}
              />
            ))}
          </Card.Content>
        </Card>

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
        {pendingApprovals.length > 0 ? (
          pendingApprovals.map((transaction) => {
            const category = BUDGET_CATEGORIES.find((c) => c.key === transaction.category);
            const statusMeta = TRANSACTION_STATUS_META[transaction.status];
            return (
              <TouchableOpacity
                key={transaction.id}
                style={styles.approvalRow}
                onPress={() =>
                  navigation.navigate('ApprovalRequest', { transactionId: transaction.id })
                }
              >
                <IconBadge
                  icon={category?.icon ?? 'wallet-outline'}
                  color={category?.color ?? colors.primary}
                  size={44}
                />
                <View style={styles.approvalMiddle}>
                  <Text style={styles.approvalTitle}>{transaction.counterparty}</Text>
                  <Text style={styles.approvalSubtitle}>
                    {category?.label ?? 'Other'} • ${transaction.amount.toFixed(2)}
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
  spendingCard: {
    borderRadius: 16,
    marginBottom: 24,
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
