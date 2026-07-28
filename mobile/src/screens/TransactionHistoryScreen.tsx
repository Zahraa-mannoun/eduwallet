import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Avatar, Card, Chip, IconButton, SegmentedButtons, Text } from 'react-native-paper';
import type { Transaction, TransactionStatus } from '../types/api';
import IconBadge from '../components/IconBadge';
import { BUDGET_CATEGORIES } from '../constants/budgetCategories';
import type { BudgetCategoryKey } from '../constants/budgetCategories';
import { TRANSACTION_STATUS_META } from '../constants/mockTransactions';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../context/WalletContext';
import { useThrottledFocusEffect } from '../hooks/useThrottledFocusEffect';
import { colors } from '../theme/colors';
import * as walletService from '../services/walletService';
import { ApiError } from '../services/api';
import type { RootStackScreenProps } from '../navigation/types';

type FilterValue = 'ALL' | 'SENT' | 'RECEIVED' | 'PENDING';

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'SENT', label: 'Sent' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'PENDING', label: 'Pending' },
];

// Only a STUDENT's own transfers ever go through parent approval — a PARENT's history is
// their own spending (never pending), and an INSTITUTION's disbursements are always
// AUTO_APPROVED, so "Pending" is a dead filter for both and only clutters their history tab.
const PENDING_TAB_ROLES: ReadonlyArray<string> = ['STUDENT'];

// Parent-facing history reframes statuses around approval, not the raw state machine —
// a parent cares whether money moved or is waiting on them, not "auto" vs "manual" approval.
const PARENT_STATUS_LABELS: Partial<Record<TransactionStatus, string>> = {
  AUTO_APPROVED: 'Completed',
  APPROVED: 'Completed',
  PENDING: 'Pending Approval',
  REJECTED: 'Rejected',
};

const categoryLookup = new Map(BUDGET_CATEGORIES.map((category) => [category.key, category]));

const formatDate = (isoDate: string) =>
  new Date(isoDate).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

function transactionTitle(transaction: Transaction): string {
  if (transaction.note) return transaction.note;
  if (!transaction.fromWalletId) return 'Wallet Top-up';
  const category = categoryLookup.get(transaction.category.toLowerCase() as BudgetCategoryKey);
  return category?.label ?? 'Transfer';
}

export default function TransactionHistoryScreen({
  navigation,
}: Readonly<RootStackScreenProps<'TransactionHistory'>>) {
  const { wallet } = useWallet();
  const { user } = useAuth();
  const isParent = user?.userType === 'PARENT';
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValue>('ALL');

  const filters =
    user && !PENDING_TAB_ROLES.includes(user.userType)
      ? FILTERS.filter((item) => item.value !== 'PENDING')
      : FILTERS;

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await walletService.getTransactions({ limit: 100 });
      setTransactions(result.transactions);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load your transactions.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useThrottledFocusEffect(load);

  const filteredTransactions = useMemo(() => {
    const sorted = [...transactions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (filter === 'ALL') return sorted;
    if (filter === 'PENDING') return sorted.filter((tx) => tx.status === 'PENDING');
    if (filter === 'RECEIVED') {
      return sorted.filter((tx) => wallet !== null && tx.toWalletId === wallet.id);
    }
    return sorted.filter((tx) => !(wallet !== null && tx.toWalletId === wallet.id));
  }, [transactions, filter, wallet]);

  const renderRow = (transaction: Transaction) => {
    const category = categoryLookup.get(transaction.category.toLowerCase() as BudgetCategoryKey);
    const statusMeta = TRANSACTION_STATUS_META[transaction.status];
    const statusLabel = isParent
      ? (PARENT_STATUS_LABELS[transaction.status] ?? statusMeta.label)
      : statusMeta.label;
    const isReceived = wallet !== null && transaction.toWalletId === wallet.id;
    const partyLabel = isReceived
      ? transaction.senderName
        ? `From: ${transaction.senderName}`
        : null
      : transaction.receiverName
        ? `To: ${transaction.receiverName}`
        : null;

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
          <Text style={styles.rowTitle}>{transactionTitle(transaction)}</Text>
          <Text style={styles.rowSubtitle}>
            {category?.label ?? 'Other'} • {formatDate(transaction.createdAt)}
          </Text>
          {partyLabel ? <Text style={styles.rowParty}>{partyLabel}</Text> : null}
        </View>
        <View style={styles.rowRight}>
          <Text style={[styles.rowAmount, { color: isReceived ? colors.accent : colors.heading }]}>
            {isReceived ? '+' : '-'}${Number(transaction.amount).toFixed(2)}
          </Text>
          <Chip
            compact
            style={[styles.statusChip, { backgroundColor: `${statusMeta.color}1F` }]}
            textStyle={{ color: statusMeta.color, fontSize: 11, fontWeight: '700' }}
          >
            {statusLabel}
          </Chip>
        </View>
      </TouchableOpacity>
    );
  };

  const renderList = () => {
    if (isLoading && transactions.length === 0) {
      return <ActivityIndicator color={colors.primary} style={styles.loading} />;
    }
    if (filteredTransactions.length > 0) {
      return filteredTransactions.map(renderRow);
    }
    return (
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
          buttons={filters.map((item) => ({ value: item.value, label: item.label }))}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} />}
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {renderList()}
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
  loading: {
    marginTop: 24,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 12,
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
  rowParty: {
    fontSize: 12,
    color: colors.label,
    fontWeight: '600',
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
