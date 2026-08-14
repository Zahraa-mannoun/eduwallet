import { useCallback, useState } from 'react';
import { Modal, RefreshControl, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Chip, IconButton, Snackbar, Text } from 'react-native-paper';
import type { PersonalSavingsHistory } from '../types/api';
import { colors } from '../theme/colors';
import * as savingsService from '../services/savingsService';
import { ApiError } from '../services/api';
import { useNotificationRefetch } from '../hooks/useNotificationRefetch';
import type { RootStackScreenProps } from '../navigation/types';

const SCREEN_BACKGROUND = '#F8FAFC';
// A deep green gradient distinguishes Personal Savings from the app's usual blue theme —
// savings is conceptually a different "place" than the everyday wallet.
const SAVINGS_GRADIENT_START = '#059669';
const SAVINGS_GRADIENT_END = '#065F46';
const WITHDRAWAL_AMOUNT_COLOR = '#9A3412';
const SAVINGS_AMOUNT_COLOR = '#065F46';

// A savings withdrawal always needs the parent's sign-off — PENDING means waiting on them, and
// APPROVED means they said yes, so it reads blue (parent-approved) not green (system-cleared),
// matching the same "Approved" treatment used for transaction/withdrawal statuses elsewhere.
const STATUS_META: Record<PersonalSavingsHistory['status'], { label: string; color: string }> = {
  PENDING: { label: 'Awaiting Parent Approval', color: '#F59E0B' },
  APPROVED: { label: 'Approved', color: '#1E40AF' },
  REJECTED: { label: 'Rejected', color: colors.danger },
};

const HOW_IT_WORKS_STEPS: Array<{
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  text: string;
}> = [
  { icon: 'calculator-variant-outline', color: colors.primary, text: 'Set a monthly budget for each category' },
  { icon: 'chart-bar', color: colors.accent, text: 'Unspent money at month end is saved automatically' },
  { icon: 'piggy-bank-outline', color: '#8B5CF6', text: 'Withdraw anytime with parent approval' },
];

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
  const [amountFocused, setAmountFocused] = useState(false);
  const [reasonFocused, setReasonFocused] = useState(false);

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

  useNotificationRefetch(load);

  const openDialog = () => {
    setAmount('');
    setReason('');
    setDialogError(null);
    setAmountFocused(false);
    setReasonFocused(false);
    setDialogVisible(true);
  };

  const closeDialog = () => {
    if (isSubmitting) return;
    setDialogVisible(false);
  };

  const parsedAmount = Number(amount);
  const canSubmit =
    parsedAmount > 0 && parsedAmount <= Number(balance) && reason.trim().length > 0 && !isSubmitting;
  const isBalanceZero = Number(balance) <= 0;

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

  const renderHistoryItem = (entry: PersonalSavingsHistory, index: number) => {
    const isRollover = entry.type === 'ROLLOVER';
    const statusMeta = STATUS_META[entry.status];

    return (
      <View key={entry.id}>
        <View style={styles.historyRow}>
          <View
            style={[
              styles.historyIconCircle,
              { backgroundColor: isRollover ? `${colors.accent}1F` : '#FFEDD5' },
            ]}
          >
            <MaterialCommunityIcons
              name={isRollover ? 'arrow-down' : 'arrow-up'}
              size={18}
              color={isRollover ? colors.accent : '#F97316'}
            />
          </View>
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
            <Text
              style={[
                styles.historyAmount,
                { color: isRollover ? SAVINGS_AMOUNT_COLOR : WITHDRAWAL_AMOUNT_COLOR },
              ]}
            >
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
        {index < history.length - 1 && <View style={styles.historyDivider} />}
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

        <LinearGradient
          colors={[SAVINGS_GRADIENT_START, SAVINGS_GRADIENT_END]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <View style={styles.balanceIconCircle}>
            <MaterialCommunityIcons name="piggy-bank-outline" size={32} color="#FFFFFF" />
          </View>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceAmount}>${Number(balance).toFixed(2)}</Text>
          <Text style={styles.balanceExplanation}>
            Unspent locked funds are automatically transferred to your savings at the end of each month
          </Text>
          <TouchableOpacity
            style={[styles.requestButton, isBalanceZero && styles.requestButtonDisabled]}
            activeOpacity={0.85}
            disabled={isBalanceZero}
            onPress={openDialog}
          >
            <MaterialCommunityIcons
              name="piggy-bank-outline"
              size={18}
              color={isBalanceZero ? colors.muted : SAVINGS_GRADIENT_END}
            />
            <Text
              style={[styles.requestButtonText, isBalanceZero && styles.requestButtonTextDisabled]}
            >
              Request Withdrawal
            </Text>
          </TouchableOpacity>
        </LinearGradient>

        <View style={styles.howItWorksCard}>
          <Text style={styles.howItWorksTitle}>How it works</Text>
          {HOW_IT_WORKS_STEPS.map((step) => (
            <View key={step.text} style={styles.stepRow}>
              <View style={[styles.stepIconCircle, { backgroundColor: `${step.color}1F` }]}>
                <MaterialCommunityIcons name={step.icon} size={17} color={step.color} />
              </View>
              <Text style={styles.stepText}>{step.text}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Savings History</Text>
        {isLoading && history.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : history.length > 0 ? (
          <View style={styles.historyCard}>{history.map(renderHistoryItem)}</View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons name="piggy-bank-outline" size={40} color={colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>No savings activity yet</Text>
            <Text style={styles.emptySubtitle}>
              Unspent funds are added here at the end of each month
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={dialogVisible} transparent animationType="fade" onRequestClose={closeDialog}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <LinearGradient
              colors={[SAVINGS_GRADIENT_START, SAVINGS_GRADIENT_END]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalHeader}
            >
              <View style={styles.modalHeaderIconCircle}>
                <MaterialCommunityIcons name="piggy-bank" size={26} color={SAVINGS_GRADIENT_END} />
              </View>
              <Text style={styles.modalHeaderTitle}>Request Withdrawal</Text>
            </LinearGradient>

            <View style={styles.modalBody}>
              {dialogError ? <Text style={styles.errorText}>{dialogError}</Text> : null}

              <View style={styles.availableBalanceBox}>
                <Text style={styles.availableBalanceLabel}>Available Balance</Text>
                <Text style={styles.availableBalanceAmount}>${Number(balance).toFixed(2)}</Text>
              </View>

              <Text style={styles.modalFieldLabel}>Amount</Text>
              <View style={[styles.amountInputCard, amountFocused && styles.amountInputCardFocused]}>
                <Text style={styles.amountPrefix}>$</Text>
                <TextInput
                  style={styles.amountInputField}
                  value={amount}
                  onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ''))}
                  onFocus={() => setAmountFocused(true)}
                  onBlur={() => setAmountFocused(false)}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
              <Text style={styles.amountHelperText}>Maximum: ${Number(balance).toFixed(2)}</Text>
              {parsedAmount > Number(balance) ? (
                <Text style={styles.warningText}>Amount cannot exceed your current balance.</Text>
              ) : null}

              <Text style={[styles.modalFieldLabel, styles.reasonLabel]}>Reason</Text>
              <TextInput
                style={[styles.reasonInput, reasonFocused && styles.reasonInputFocused]}
                value={reason}
                onChangeText={setReason}
                onFocus={() => setReasonFocused(true)}
                onBlur={() => setReasonFocused(false)}
                placeholder="Why are you withdrawing from savings?"
                placeholderTextColor={colors.placeholder}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={styles.modalCancelButton}
                activeOpacity={0.85}
                onPress={closeDialog}
                disabled={isSubmitting}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitButtonWrap, !canSubmit && styles.modalSubmitButtonWrapDisabled]}
                activeOpacity={0.85}
                onPress={handleSubmit}
                disabled={!canSubmit}
              >
                <LinearGradient
                  colors={[SAVINGS_GRADIENT_START, SAVINGS_GRADIENT_END]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalSubmitButton}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size={16} color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalSubmitButtonText}>Submit</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  headerTitle: {
    fontWeight: '700',
    color: colors.heading,
    marginLeft: 4,
  },
  content: {
    paddingHorizontal: 16,
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
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  balanceIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceLabel: {
    fontSize: 13,
    color: '#A7F3D0',
    marginTop: 14,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
  },
  balanceExplanation: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 18,
  },
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: SAVINGS_GRADIENT_END,
    borderRadius: 12,
    paddingVertical: 13,
  },
  requestButtonDisabled: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  requestButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: SAVINGS_GRADIENT_END,
    marginLeft: 8,
  },
  requestButtonTextDisabled: {
    color: colors.muted,
  },
  howItWorksCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  howItWorksTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  stepIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: colors.label,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.heading,
    marginBottom: 10,
  },
  loading: {
    marginTop: 24,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  historyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 14,
  },
  historyDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  statusChip: {
    height: 24,
    marginTop: 6,
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: `${colors.accent}1A`,
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
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  modalHeaderIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalBody: {
    padding: 20,
  },
  availableBalanceBox: {
    alignItems: 'center',
    marginBottom: 20,
  },
  availableBalanceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: 4,
  },
  availableBalanceAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: SAVINGS_AMOUNT_COLOR,
  },
  modalFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    marginBottom: 8,
  },
  reasonLabel: {
    marginTop: 16,
  },
  amountInputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  amountInputCardFocused: {
    borderColor: SAVINGS_GRADIENT_START,
  },
  amountPrefix: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.heading,
    marginRight: 6,
  },
  amountInputField: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: colors.heading,
    padding: 0,
  },
  amountHelperText: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 6,
  },
  reasonInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.heading,
    minHeight: 84,
  },
  reasonInputFocused: {
    borderColor: SAVINGS_GRADIENT_START,
  },
  modalCancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 20,
  },
  modalCancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.label,
  },
  modalSubmitButtonWrap: {
    width: '100%',
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalSubmitButtonWrapDisabled: {
    opacity: 0.5,
  },
  modalSubmitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  modalSubmitButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
