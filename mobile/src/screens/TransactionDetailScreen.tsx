import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Chip, IconButton, Text } from 'react-native-paper';
import IconBadge from '../components/IconBadge';
import { BUDGET_CATEGORIES } from '../constants/budgetCategories';
import { MOCK_TRANSACTIONS, TRANSACTION_STATUS_META } from '../constants/mockTransactions';
import { colors } from '../theme/colors';
import type { RootStackScreenProps } from '../navigation/types';

const categoryLookup = new Map(BUDGET_CATEGORIES.map((category) => [category.key, category]));

export default function TransactionDetailScreen({
  navigation,
  route,
}: RootStackScreenProps<'TransactionDetail'>) {
  const transaction = MOCK_TRANSACTIONS.find((tx) => tx.id === route.params.transactionId);

  const header = (
    <View style={styles.header}>
      <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
      <Text variant="titleLarge" style={styles.headerTitle}>
        Transaction Details
      </Text>
    </View>
  );

  if (!transaction) {
    return (
      <SafeAreaView style={styles.flex} edges={['top']}>
        {header}
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Transaction not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const category = categoryLookup.get(transaction.category);
  const statusMeta = TRANSACTION_STATUS_META[transaction.status];
  const isReceived = transaction.type === 'RECEIVED';
  const dateLabel = new Date(transaction.date).toLocaleString([], {
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
        message: `EduWallet receipt\n${transaction.id}\n${isReceived ? 'Received' : 'Sent'} $${transaction.amount.toFixed(2)} ${isReceived ? 'from' : 'to'} ${transaction.counterparty}\nCategory: ${category?.label ?? 'Other'}\nStatus: ${statusMeta.label}\nDate: ${dateLabel}`,
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
            {isReceived ? '+' : '-'}${transaction.amount.toFixed(2)}
          </Text>
          <Text style={styles.counterparty}>
            {isReceived ? 'From' : 'To'} {transaction.counterparty}
          </Text>
          <Chip
            compact
            style={[styles.statusChip, { backgroundColor: `${statusMeta.color}1F` }]}
            textStyle={{ color: statusMeta.color, fontWeight: '700' }}
          >
            {statusMeta.label}
          </Chip>
        </View>

        <View style={styles.receiptCard}>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Transaction ID</Text>
            <Text style={styles.receiptValue}>{transaction.id}</Text>
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
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    color: colors.muted,
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
