import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Chip, IconButton, Text } from 'react-native-paper';
import IconBadge from '../components/IconBadge';
import { BUDGET_CATEGORIES } from '../constants/budgetCategories';
import type { BudgetCategoryDefinition } from '../constants/budgetCategories';
import { MOCK_TRANSACTIONS } from '../constants/mockTransactions';
import { colors } from '../theme/colors';
import type { RootStackScreenProps } from '../navigation/types';

type Decision = 'ACCEPTED' | 'REJECTED' | null;

const renderCategoryChipIcon = (category?: BudgetCategoryDefinition) => () => (
  <IconBadge
    icon={category?.icon ?? 'wallet-outline'}
    color={category?.color ?? colors.primary}
    size={20}
    iconSize={12}
  />
);

export default function ApprovalRequestScreen({
  navigation,
  route,
}: RootStackScreenProps<'ApprovalRequest'>) {
  const [decision, setDecision] = useState<Decision>(null);
  const transaction = MOCK_TRANSACTIONS.find((tx) => tx.id === route.params.transactionId);

  const header = (
    <View style={styles.header}>
      <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
      <Text variant="titleLarge" style={styles.headerTitle}>
        Approval Request
      </Text>
    </View>
  );

  if (!transaction) {
    return (
      <SafeAreaView style={styles.flex} edges={['top']}>
        {header}
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Request not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const category = BUDGET_CATEGORIES.find((c) => c.key === transaction.category);
  const dateLabel = new Date(transaction.date).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  if (decision) {
    const accepted = decision === 'ACCEPTED';
    return (
      <SafeAreaView style={styles.flex} edges={['top']}>
        {header}
        <ScrollView contentContainerStyle={styles.resultContent}>
          <IconBadge
            icon={accepted ? 'check-circle-outline' : 'close-circle-outline'}
            color={accepted ? colors.accent : colors.danger}
            size={88}
            iconSize={48}
          />
          <Text variant="headlineSmall" style={styles.resultTitle}>
            {accepted ? 'Payment Approved' : 'Payment Rejected'}
          </Text>
          <Text style={styles.resultSubtitle}>
            ${transaction.amount.toFixed(2)} to {transaction.counterparty}
          </Text>
          <Button
            mode="contained"
            buttonColor={colors.primary}
            style={styles.doneButton}
            contentStyle={styles.doneButtonContent}
            onPress={() => navigation.goBack()}
          >
            Done
          </Button>
        </ScrollView>
      </SafeAreaView>
    );
  }

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
          <Text style={styles.requestTitle}>Payment requires your approval</Text>
          <Text style={styles.amount}>${transaction.amount.toFixed(2)}</Text>
          <Text style={styles.counterparty}>to {transaction.counterparty}</Text>
          <Chip
            compact
            icon={renderCategoryChipIcon(category)}
            style={[styles.categoryChip, { backgroundColor: `${category?.color ?? colors.primary}1F` }]}
            textStyle={{ color: category?.color ?? colors.primary, fontWeight: '700' }}
          >
            {category?.label ?? 'Other'}
          </Chip>
        </View>

        <View style={styles.detailsCard}>
          {transaction.note ? (
            <View style={styles.detailsRow}>
              <Text style={styles.detailsLabel}>Note</Text>
              <Text style={styles.detailsValue}>{transaction.note}</Text>
            </View>
          ) : null}
          <View style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>Requested</Text>
            <Text style={styles.detailsValue}>{dateLabel}</Text>
          </View>
        </View>

        <Text style={styles.explanation}>
          This payment exceeds the auto-approval limit for {category?.label ?? 'this category'} and
          needs your review before it can go through.
        </Text>

        <View style={styles.actionsRow}>
          <Button
            mode="outlined"
            textColor={colors.danger}
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => setDecision('REJECTED')}
          >
            Reject
          </Button>
          <Button
            mode="contained"
            buttonColor={colors.accent}
            style={styles.actionButton}
            onPress={() => setDecision('ACCEPTED')}
          >
            Accept
          </Button>
        </View>
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
    paddingVertical: 20,
  },
  requestTitle: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 16,
  },
  amount: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.heading,
    marginTop: 4,
  },
  counterparty: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 2,
    marginBottom: 14,
  },
  categoryChip: {
    height: 30,
  },
  detailsCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailsLabel: {
    fontSize: 13,
    color: colors.muted,
  },
  detailsValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.heading,
  },
  explanation: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 20,
    marginBottom: 24,
  },
  actionsRow: {
    flexDirection: 'row',
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 10,
  },
  rejectButton: {
    borderColor: colors.danger,
  },
  resultContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  resultTitle: {
    fontWeight: '700',
    color: colors.heading,
    marginTop: 16,
  },
  resultSubtitle: {
    fontSize: 15,
    color: colors.muted,
    marginTop: 4,
    marginBottom: 24,
  },
  doneButton: {
    width: '100%',
    borderRadius: 10,
  },
  doneButtonContent: {
    paddingVertical: 6,
  },
});
