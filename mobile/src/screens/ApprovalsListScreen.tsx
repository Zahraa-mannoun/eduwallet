import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Card, Chip, Text } from 'react-native-paper';
import IconBadge from '../components/IconBadge';
import { BUDGET_CATEGORIES } from '../constants/budgetCategories';
import { MOCK_TRANSACTIONS, TRANSACTION_STATUS_META } from '../constants/mockTransactions';
import { colors } from '../theme/colors';
import type { ParentTabScreenProps } from '../navigation/types';

const categoryLookup = new Map(BUDGET_CATEGORIES.map((category) => [category.key, category]));

export default function ApprovalsListScreen({ navigation }: ParentTabScreenProps<'Approvals'>) {
  const pendingApprovals = MOCK_TRANSACTIONS.filter((tx) => tx.status === 'PENDING');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Approvals
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {pendingApprovals.length > 0 ? (
          pendingApprovals.map((transaction) => {
            const category = categoryLookup.get(transaction.category);
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
                size={56}
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
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIcon: {
    backgroundColor: colors.surface,
    marginBottom: 14,
  },
  emptyTitle: {
    fontWeight: '700',
    color: colors.heading,
    marginBottom: 6,
  },
  emptySubtitle: {
    color: colors.muted,
  },
});
