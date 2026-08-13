import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  LayoutAnimation,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Chip, IconButton, Text } from 'react-native-paper';
import type { Transaction } from '../types/api';
import { BUDGET_CATEGORIES } from '../constants/budgetCategories';
import type { BudgetCategoryKey } from '../constants/budgetCategories';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../context/WalletContext';
import { useThrottledFocusEffect } from '../hooks/useThrottledFocusEffect';
import { colors } from '../theme/colors';
import * as walletService from '../services/walletService';
import { ApiError } from '../services/api';
import {
  classifyTransaction,
  isCompletedWithdrawal,
  RECEIVED_AMOUNT_COLOR,
  SENT_AMOUNT_COLOR,
  TX_TYPE_META,
  transactionDisplayTitle,
  transactionStatusMeta,
} from '../utils/transactionDisplay';
import type { RootStackScreenProps } from '../navigation/types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SCREEN_BACKGROUND = '#F8FAFC';

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

// Parent-facing history reframes statuses around approval, not the raw state machine — a
// parent cares whether money moved or is waiting on them, not "auto" vs "manual" approval.
// Cash withdrawals never appear in a parent's own transaction history (only a student ever
// withdraws cash from their own wallet), so this only needs to cover P2P/card statuses.
const PARENT_STATUS_LABELS: Partial<Record<Transaction['status'], string>> = {
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

function SkeletonRow() {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.card, styles.skeletonCard, { opacity }]}>
      <View style={styles.skeletonIcon} />
      <View style={styles.skeletonLines}>
        <View style={styles.skeletonLineWide} />
        <View style={styles.skeletonLineNarrow} />
      </View>
    </Animated.View>
  );
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

  const changeFilter = (value: FilterValue) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFilter(value);
  };

  const filteredTransactions = useMemo(() => {
    const sorted = [...transactions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (filter === 'ALL') return sorted;
    if (filter === 'PENDING') {
      return sorted.filter((tx) => tx.status === 'PENDING' || tx.status === 'PENDING_PARENT_APPROVAL');
    }
    if (filter === 'RECEIVED') {
      return sorted.filter((tx) => wallet !== null && tx.toWalletId === wallet.id);
    }
    return sorted.filter((tx) => !(wallet !== null && tx.toWalletId === wallet.id));
  }, [transactions, filter, wallet]);

  const renderRow = (transaction: Transaction) => {
    const category = categoryLookup.get(transaction.category.toLowerCase() as BudgetCategoryKey);
    const isReceived = wallet !== null && transaction.toWalletId === wallet.id;
    const type = classifyTransaction(transaction, isReceived);
    const typeMeta = TX_TYPE_META[type];
    const badge = transactionStatusMeta(transaction, type);
    const statusLabel = isParent ? (PARENT_STATUS_LABELS[transaction.status] ?? badge.label) : badge.label;
    // A withdrawal awaiting parent/agent action has no real Transaction row yet — there's
    // nothing for TransactionDetail to look up. Route to the Withdrawal screen instead, where
    // it's already listed with full detail.
    const isPendingWithdrawal = type === 'WITHDRAWAL' && !isCompletedWithdrawal(transaction);

    return (
      <TouchableOpacity
        key={transaction.id}
        style={styles.card}
        onPress={() =>
          isPendingWithdrawal
            ? navigation.navigate('Withdrawal')
            : navigation.navigate('TransactionDetail', { transactionId: transaction.id })
        }
      >
        <View style={[styles.typeIconCircle, { backgroundColor: `${typeMeta.color}1F` }]}>
          <MaterialCommunityIcons name={typeMeta.icon} size={20} color={typeMeta.color} />
        </View>
        <View style={styles.rowMiddle}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {transactionDisplayTitle(transaction, type)}
          </Text>
          <Text style={styles.rowSubtitle}>
            {category?.label ?? 'Other'} • {formatDate(transaction.createdAt)}
          </Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={[styles.rowAmount, { color: isReceived ? RECEIVED_AMOUNT_COLOR : SENT_AMOUNT_COLOR }]}>
            {isReceived ? '+' : '-'}${Number(transaction.amount).toFixed(2)}
          </Text>
          <Chip
            compact
            style={[styles.statusChip, { backgroundColor: badge.bg }]}
            textStyle={{ color: badge.fg, fontSize: 11, fontWeight: '700', textAlign: 'center' }}
          >
            {statusLabel}
          </Chip>
        </View>
      </TouchableOpacity>
    );
  };

  const renderList = () => {
    if (isLoading && transactions.length === 0) {
      return (
        <>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </>
      );
    }
    if (filteredTransactions.length > 0) {
      return filteredTransactions.map(renderRow);
    }
    if (transactions.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <MaterialCommunityIcons name="receipt-text-outline" size={40} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No transactions yet</Text>
          <Text style={styles.emptySubtitle}>Your transactions will appear here</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconCircle}>
          <MaterialCommunityIcons name="filter-remove-outline" size={40} color={colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>No transactions found</Text>
        <Text style={styles.emptySubtitle}>Nothing matches this filter yet. Try a different one.</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
        <View style={styles.headerTextGroup}>
          <Text variant="titleLarge" style={styles.headerTitle}>
            Transaction History
          </Text>
          <Text style={styles.headerSubtitle}>
            {transactions.length} transaction{transactions.length === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {filters.map((item) => {
          const selected = filter === item.value;
          return (
            <TouchableOpacity
              key={item.value}
              activeOpacity={0.8}
              onPress={() => changeFilter(item.value)}
              style={[styles.filterPill, selected && styles.filterPillSelected]}
            >
              <Text style={[styles.filterPillText, selected && styles.filterPillTextSelected]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
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
    backgroundColor: SCREEN_BACKGROUND,
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
  headerTextGroup: {
    marginLeft: 4,
  },
  headerTitle: {
    fontWeight: '700',
    color: colors.heading,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  filterPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 999,
    marginRight: 8,
  },
  filterPillSelected: {
    backgroundColor: colors.primary,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  filterPillTextSelected: {
    color: '#FFFFFF',
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  typeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMiddle: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  rowTitle: {
    fontWeight: '700',
    fontSize: 14,
    color: colors.heading,
  },
  rowSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  rowRight: {
    flexDirection: 'column',
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: `${colors.primary}1A`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
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
  skeletonCard: {
    paddingVertical: 14,
  },
  skeletonIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.border,
  },
  skeletonLines: {
    flex: 1,
    marginLeft: 12,
  },
  skeletonLineWide: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border,
    width: '60%',
    marginBottom: 8,
  },
  skeletonLineNarrow: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
    width: '40%',
  },
});
