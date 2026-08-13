import { useCallback, useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Button, Chip, IconButton, Text } from 'react-native-paper';
import type { Transaction } from '../types/api';
import IconBadge from '../components/IconBadge';
import { BUDGET_CATEGORIES } from '../constants/budgetCategories';
import type { BudgetCategoryKey } from '../constants/budgetCategories';
import { useWallet } from '../context/WalletContext';
import { colors } from '../theme/colors';
import * as walletService from '../services/walletService';
import { ApiError } from '../services/api';
import { classifyTransaction, transactionStatusMeta } from '../utils/transactionDisplay';
import type { RootStackScreenProps } from '../navigation/types';

const categoryLookup = new Map(BUDGET_CATEGORIES.map((category) => [category.key, category]));

function transactionTitle(transaction: Transaction): string {
  if (transaction.note) return transaction.note;
  if (!transaction.fromWalletId) return 'Wallet Top-up';
  const category = categoryLookup.get(transaction.category.toLowerCase() as BudgetCategoryKey);
  return category?.label ?? 'Transfer';
}

export default function TransactionDetailScreen({
  navigation,
  route,
}: RootStackScreenProps<'TransactionDetail'>) {
  const { wallet } = useWallet();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await walletService.getTransactionById(route.params.transactionId);
      setTransaction(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load this transaction.');
    } finally {
      setIsLoading(false);
    }
  }, [route.params.transactionId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const header = (
    <View style={styles.header}>
      <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
      <Text variant="titleLarge" style={styles.headerTitle}>
        Transaction Details
      </Text>
    </View>
  );

  if (isLoading && !transaction) {
    return (
      <SafeAreaView style={styles.flex} edges={['top']}>
        {header}
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      </SafeAreaView>
    );
  }

  if (error || !transaction) {
    return (
      <SafeAreaView style={styles.flex} edges={['top']}>
        {header}
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>{error ?? 'Transaction not found.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const category = categoryLookup.get(transaction.category.toLowerCase() as BudgetCategoryKey);
  const isReceived = wallet !== null && transaction.toWalletId === wallet.id;
  const type = classifyTransaction(transaction, isReceived);
  const statusMeta = transactionStatusMeta(transaction, type);
  const amount = Number(transaction.amount);
  const dateLabel = new Date(transaction.createdAt).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleShare = async () => {
    try {
      await Share.share({
        message: `EduWallet receipt\n${transaction.id}\n${isReceived ? 'Received' : 'Sent'} $${amount.toFixed(2)}\nCategory: ${category?.label ?? 'Other'}\nStatus: ${statusMeta.label}\nDate: ${dateLabel}`,
      });
    } catch {
      // Sharing unsupported on this platform — no-op.
    }
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      {header}

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summary}>
          <IconBadge
            icon={category?.icon ?? 'wallet-outline'}
            color={category?.color ?? colors.primary}
            size={72}
            iconSize={36}
          />
          <Text style={[styles.amount, { color: isReceived ? colors.accent : colors.heading }]}>
            {isReceived ? '+' : '-'}${amount.toFixed(2)}
          </Text>
          <Text style={styles.counterparty}>{transactionTitle(transaction)}</Text>
          <Chip
            compact
            style={[styles.statusChip, { backgroundColor: statusMeta.bg }]}
            textStyle={{ color: statusMeta.fg, fontWeight: '700' }}
          >
            {statusMeta.label}
          </Chip>
        </View>

        <View style={styles.receiptCard}>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Transaction ID</Text>
            <Text style={styles.receiptValue}>{transaction.id.slice(0, 8).toUpperCase()}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Type</Text>
            <Text style={styles.receiptValue}>{isReceived ? 'Received' : 'Sent'}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Category</Text>
            <View style={styles.receiptCategory}>
              <IconBadge icon={category?.icon ?? 'wallet-outline'} color={category?.color ?? colors.primary} size={22} iconSize={13} />
              <Text style={[styles.receiptValue, styles.receiptCategoryLabel]}>
                {category?.label ?? 'Other'}
              </Text>
            </View>
          </View>
          {transaction.note ? (
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Note</Text>
              <Text style={styles.receiptValue}>{transaction.note}</Text>
            </View>
          ) : null}
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Date</Text>
            <Text style={styles.receiptValue}>{dateLabel}</Text>
          </View>
        </View>

        <Button
          mode="outlined"
          icon="share-variant-outline"
          textColor={colors.primary}
          style={styles.shareButton}
          onPress={handleShare}
        >
          Share Receipt
        </Button>
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
  loading: {
    marginTop: 40,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  notFoundText: {
    color: colors.muted,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  summary: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  amount: {
    fontSize: 34,
    fontWeight: '800',
    marginTop: 16,
  },
  counterparty: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 4,
    marginBottom: 12,
  },
  statusChip: {
    height: 28,
  },
  receiptCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  receiptLabel: {
    fontSize: 13,
    color: colors.muted,
  },
  receiptValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.heading,
  },
  receiptCategory: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  receiptCategoryLabel: {
    marginLeft: 8,
  },
  shareButton: {
    borderRadius: 10,
    borderColor: colors.primary,
  },
});
