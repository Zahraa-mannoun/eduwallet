import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Button,
  Chip,
  Dialog,
  IconButton,
  Portal,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import type { PersonalSavingsHistory } from '../types/api';
import IconBadge from '../components/IconBadge';
import { colors } from '../theme/colors';
import * as savingsService from '../services/savingsService';
import { ApiError } from '../services/api';
import type { RootStackScreenProps } from '../navigation/types';

const STATUS_META: Record<PersonalSavingsHistory['status'], { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: '#F59E0B' },
  APPROVED: { label: 'Approved', color: colors.accent },
  REJECTED: { label: 'Rejected', color: colors.danger },
};

function formatMonthLabel(month: string): string {
  const [year, monthNum] = month.split('-').map(Number);
  const date = new Date(year, (monthNum ?? 1) - 1, 1);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PersonalSavingsScreen({
  navigation,
}: Readonly<RootStackScreenProps<'PersonalSavings'>>) {
  const [balance, setBalance] = useState('0.00');
  const [history, setHistory] = useState<PersonalSavingsHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dialogVisible, setDialogVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await savingsService.getMySavings();
      setBalance(result.balance);
      setHistory(result.history);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load your Personal Savings.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const openDialog = () => {
    setAmount('');
    setReason('');
    setDialogError(null);
    setDialogVisible(true);
  };

  const closeDialog = () => {
    if (isSubmitting) return;
    setDialogVisible(false);
  };

  const parsedAmount = Number(amount);
  const canSubmit =
    parsedAmount > 0 && parsedAmount <= Number(balance) && reason.trim().length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setDialogError(null);
    try {
      await savingsService.requestWithdrawal(parsedAmount, reason.trim());
      setDialogVisible(false);
      setSnackbarMessage('Request sent to parent for approval');
      await load();
    } catch (err) {
      setDialogError(err instanceof ApiError ? err.message : 'Could not submit your request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderHistoryItem = (entry: PersonalSavingsHistory) => {
    const isRollover = entry.type === 'ROLLOVER';
    const statusMeta = STATUS_META[entry.status];

    return (
      <View key={entry.id} style={styles.historyRow}>
        <IconBadge
          icon={isRollover ? 'piggy-bank-outline' : 'cash-minus'}
          color={isRollover ? colors.accent : colors.primary}
          size={44}
        />
        <View style={styles.historyMiddle}>
          <Text style={styles.historyTitle}>
            {isRollover ? `Rollover — ${formatMonthLabel(entry.month ?? '')}` : 'Withdrawal Request'}
          </Text>
          {!isRollover && entry.reason ? (
            <Text style={styles.historyReason} numberOfLines={2}>
              {entry.reason}
            </Text>
          ) : null}
          <Text style={styles.historyDate}>{formatDate(entry.createdAt)}</Text>
        </View>
        <View style={styles.historyRight}>
          <Text style={[styles.historyAmount, isRollover && { color: colors.accent }]}>
            {isRollover ? '+' : '-'}${Number(entry.amount).toFixed(2)}
          </Text>
          {!isRollover ? (
            <Chip
              compact
              style={[styles.statusChip, { backgroundColor: `${statusMeta.color}1F` }]}
              textStyle={{ color: statusMeta.color, fontSize: 11, fontWeight: '700' }}
            >
              {statusMeta.label}
            </Chip>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
        <Text variant="titleLarge" style={styles.headerTitle}>
          Personal Savings
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} />}
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.balanceCard}>
          <IconBadge icon="piggy-bank-outline" color={colors.accent} size={64} iconSize={32} />
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceAmount}>${Number(balance).toFixed(2)}</Text>
          <Text style={styles.balanceExplanation}>
            Unspent funds from your monthly budget are automatically saved here.
          </Text>
          <Button
            mode="contained"
            buttonColor={colors.primary}
            style={styles.requestButton}
            contentStyle={styles.requestButtonContent}
            disabled={Number(balance) <= 0}
            onPress={openDialog}
          >
            Request Withdrawal
          </Button>
        </View>

        <Text style={styles.sectionLabel}>History</Text>
        {isLoading && history.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : history.length > 0 ? (
          <View style={styles.historyList}>{history.map(renderHistoryItem)}</View>
        ) : (
          <Text style={styles.emptyText}>
            No savings activity yet. Unspent funds are added here at the end of each month.
          </Text>
        )}
      </ScrollView>

      <Portal>
        <Dialog visible={dialogVisible} onDismiss={closeDialog}>
          <Dialog.Title>Request Withdrawal</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogBalance}>Available: ${Number(balance).toFixed(2)}</Text>
            {dialogError ? <Text style={styles.errorText}>{dialogError}</Text> : null}
            <TextInput
              mode="outlined"
              label="Amount"
              value={amount}
              onChangeText={(text: string) => setAmount(text.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              style={styles.dialogInput}
            />
            {parsedAmount > Number(balance) ? (
              <Text style={styles.warningText}>Amount cannot exceed your current balance.</Text>
            ) : null}
            <TextInput
              mode="outlined"
              label="Reason"
              placeholder="What's this withdrawal for?"
              value={reason}
              onChangeText={setReason}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              style={styles.dialogInput}
              multiline
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeDialog} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onPress={handleSubmit} disabled={!canSubmit}>
              {isSubmitting ? <ActivityIndicator size={16} color={colors.primary} /> : 'Submit'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={Boolean(snackbarMessage)}
        onDismiss={() => setSnackbarMessage(null)}
        duration={3500}
      >
        {snackbarMessage}
      </Snackbar>
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
    marginBottom: 12,
  },
  warningText: {
    color: colors.danger,
    fontSize: 12,
    marginBottom: 8,
  },
  balanceCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 12,
  },
  balanceAmount: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.heading,
    marginTop: 4,
  },
  balanceExplanation: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 18,
  },
  requestButton: {
    borderRadius: 10,
    width: '100%',
  },
  requestButtonContent: {
    paddingVertical: 6,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.label,
    marginBottom: 10,
  },
  loading: {
    marginTop: 24,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  historyList: {
    marginBottom: 8,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  historyMiddle: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  historyTitle: {
    fontWeight: '700',
    color: colors.heading,
    fontSize: 13,
  },
  historyReason: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  historyDate: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  historyAmount: {
    fontWeight: '700',
    color: colors.heading,
    fontSize: 14,
  },
  statusChip: {
    height: 24,
    marginTop: 6,
  },
  dialogBalance: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: 12,
  },
  dialogInput: {
    backgroundColor: colors.inputBackground,
    marginBottom: 12,
  },
});
