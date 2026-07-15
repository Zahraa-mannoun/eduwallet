import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Button,
  Chip,
  Dialog,
  IconButton,
  Portal,
  Text,
  TextInput,
} from 'react-native-paper';
import IconBadge from '../components/IconBadge';
import { BUDGET_CATEGORIES } from '../constants/budgetCategories';
import type { BudgetCategoryDefinition, BudgetCategoryKey } from '../constants/budgetCategories';
import { colors } from '../theme/colors';
import * as parentalService from '../services/parentalService';
import { ApiError } from '../services/api';
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
}: Readonly<RootStackScreenProps<'ApprovalRequest'>>) {
  const { transaction, studentName } = route.params;
  const [decision, setDecision] = useState<Decision>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectDialogVisible, setRejectDialogVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const header = (
    <View style={styles.header}>
      <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
      <Text variant="titleLarge" style={styles.headerTitle}>
        Approval Request
      </Text>
    </View>
  );

  const category = BUDGET_CATEGORIES.find(
    (c) => c.key === (transaction.category.toLowerCase() as BudgetCategoryKey)
  );
  const dateLabel = new Date(transaction.createdAt).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleAccept = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await parentalService.approveTransaction(transaction.id);
      setDecision('ACCEPTED');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not approve this transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await parentalService.rejectTransaction(transaction.id, rejectReason.trim());
      setRejectDialogVisible(false);
      setDecision('REJECTED');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reject this transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
            ${Number(transaction.amount).toFixed(2)} for {studentName}
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
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.summary}>
          <IconBadge
            icon={category?.icon ?? 'wallet-outline'}
            color={category?.color ?? colors.primary}
            size={72}
            iconSize={36}
          />
          <Text style={styles.requestTitle}>Payment requires your approval</Text>
          <Text style={styles.amount}>${Number(transaction.amount).toFixed(2)}</Text>
          <Text style={styles.counterparty}>for {studentName}</Text>
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
            disabled={isSubmitting}
            onPress={() => setRejectDialogVisible(true)}
          >
            Reject
          </Button>
          <Button
            mode="contained"
            buttonColor={colors.accent}
            style={styles.actionButton}
            disabled={isSubmitting}
            onPress={handleAccept}
          >
            {isSubmitting ? <ActivityIndicator size={16} color={colors.onPrimary} /> : 'Accept'}
          </Button>
        </View>
      </ScrollView>

      <Portal>
        <Dialog visible={rejectDialogVisible} onDismiss={() => setRejectDialogVisible(false)}>
          <Dialog.Title>Reject Payment</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Reason"
              value={rejectReason}
              onChangeText={(text: string) => setRejectReason(text)}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              multiline
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRejectDialogVisible(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onPress={handleReject} disabled={!rejectReason.trim() || isSubmitting}>
              {isSubmitting ? <ActivityIndicator size={16} color={colors.danger} /> : 'Reject'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginTop: 12,
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
