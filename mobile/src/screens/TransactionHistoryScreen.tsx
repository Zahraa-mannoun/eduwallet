import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Card, Chip, IconButton, SegmentedButtons, Text } from 'react-native-paper';
import IconBadge from '../components/IconBadge';
import { BUDGET_CATEGORIES } from '../constants/budgetCategories';
import { MOCK_TRANSACTIONS, TRANSACTION_STATUS_META } from '../constants/mockTransactions';
import type { MockTransaction } from '../constants/mockTransactions';
import { colors } from '../theme/colors';
import type { RootStackScreenProps } from '../navigation/types';

type FilterValue = 'ALL' | 'SENT' | 'RECEIVED' | 'PENDING';

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'SENT', label: 'Sent' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'PENDING', label: 'Pending' },
];

const categoryLookup = new Map(BUDGET_CATEGORIES.map((category) => [category.key, category]));

const formatDate = (isoDate: string) =>
  new Date(isoDate).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function TransactionHistoryScreen({ navigation }: RootStackScreenProps<'TransactionHistory'>) {
  const [filter, setFilter] = useState<FilterValue>('ALL');

  const filteredTransactions = useMemo(() => {
    const sorted = [...MOCK_TRANSACTIONS].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    if (filter === 'ALL') return sorted;
    if (filter === 'PENDING') return sorted.filter((tx) => tx.status === 'PENDING');
    return sorted.filter((tx) => tx.type === filter);
  }, [filter]);

  const renderRow = (transaction: MockTransaction) => {
    const category = categoryLookup.get(transaction.category);
    const statusMeta = TRANSACTION_STATUS_META[transaction.status];
    const isReceived = transaction.type === 'RECEIVED';

    return (
      <TouchableOpacity
        key={transaction.id}
        style={styles.row}
        onPress={() =>
          navigation.navigate('TransactionDetail', { transactionId: transaction.id })
        }
      >
        <IconBadge
          icon={category?.icon ?? 'wallet-outline'}
          color={category?.color ?? colors.primary}
          size={44}
        />
        <View style={styles.rowMiddle}>
          <Text style={styles.rowTitle}>{transaction.counterparty}</Text>
          <Text style={styles.rowSubtitle}>
            {category?.label ?? 'Other'} • {formatDate(transaction.date)}
          </Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={[styles.rowAmount, { color: isReceived ? colors.accent : colors.heading }]}>
            {isReceived ? '+' : '-'}${transaction.amount.toFixed(2)}
          </Text>
          <Chip
            compact
            style={[styles.statusChip, { backgroundColor: `${statusMeta.color}1F` }]}
            textStyle={{ color: statusMeta.color, fontSize: 11, fontWeight: '700' }}
          >
            {statusMeta.label}
          </Chip>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
        <Text variant="titleLarge" style={styles.headerTitle}>
          Transaction History
        </Text>
      </View>

      <View style={styles.filterContainer}>
        <SegmentedButtons
          value={filter}
          onValueChange={(value) => setFilter(value as FilterValue)}
          buttons={FILTERS.map((item) => ({ value: item.value, label: item.label }))}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {filteredTransactions.length > 0 ? (
          filteredTransactions.map(renderRow)
        ) : (
          <Card style={styles.emptyCard} mode="elevated">
            <Card.Content style={styles.emptyState}>
              <Avatar.Icon
                icon="receipt-text-outline"
                size={56}
                style={styles.emptyIcon}
                color={colors.primary}
              />
              <Text style={styles.emptyTitle}>No transactions found</Text>
              <Text style={styles.emptySubtitle}>
                Nothing matches this filter yet. Try a different one.
              </Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  backButton: {
    margin: 0,
  },
  headerTitle: {
    fontWeight: '700',
    color: colors.heading,
    marginLeft: 4,
  },
  filterContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowMiddle: {
    flex: 1,
    marginLeft: 12,
  },
  rowTitle: {
    fontWeight: '700',
    color: colors.heading,
  },
  rowSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  rowAmount: {
    fontWeight: '700',
    fontSize: 15,
  },
  statusChip: {
    height: 24,
    marginTop: 4,
  },
  emptyCard: {
    borderRadius: 16,
    marginTop: 16,
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
    textAlign: 'center',
  },
});
