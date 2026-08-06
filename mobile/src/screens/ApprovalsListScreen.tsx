import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Chip,
  Dialog,
  Portal,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import type { PersonalSavingsHistory, Transaction, WithdrawalRequestWithStudent } from '../types/api';
import IconBadge from '../components/IconBadge';
import { BUDGET_CATEGORIES } from '../constants/budgetCategories';
import type { BudgetCategoryKey } from '../constants/budgetCategories';
import { TRANSACTION_STATUS_META } from '../constants/mockTransactions';
import { colors } from '../theme/colors';
import * as parentalService from '../services/parentalService';
import type { LinkedStudent } from '../services/parentalService';
import * as savingsService from '../services/savingsService';
import * as withdrawalService from '../services/withdrawalService';
import { ApiError } from '../services/api';
import type { ParentTabScreenProps } from '../navigation/types';

const categoryLookup = new Map(BUDGET_CATEGORIES.map((category) => [category.key, category]));

function transactionTitle(transaction: Transaction): string {
  if (transaction.note) return transaction.note;
  const category = categoryLookup.get(transaction.category.toLowerCase() as BudgetCategoryKey);
  return category?.label ?? 'Payment';
}

export default function ApprovalsListScreen({ navigation }: ParentTabScreenProps<'Approvals'>) {
  const [approvals, setApprovals] = useState<Transaction[]>([]);
  const [savingsRequests, setSavingsRequests] = useState<PersonalSavingsHistory[]>([]);
  const [cashWithdrawals, setCashWithdrawals] = useState<WithdrawalRequestWithStudent[]>([]);
  const [students, setStudents] = useState<LinkedStudent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PersonalSavingsHistory | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const [cashProcessingId, setCashProcessingId] = useState<string | null>(null);
  const [cashRejectTarget, setCashRejectTarget] = useState<WithdrawalRequestWithStudent | null>(null);
  const [cashRejectReason, setCashRejectReason] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [approvalsResult, studentsResult, savingsRequestsResult, cashWithdrawalsResult] =
        await Promise.all([
          parentalService.getPendingApprovals(),
          parentalService.getLinkedStudents(),
          savingsService.getWithdrawalRequests(),
          withdrawalService.getPendingApprovals(),
        ]);
      setApprovals(approvalsResult);
      setStudents(studentsResult);
      setSavingsRequests(savingsRequestsResult);
      setCashWithdrawals(cashWithdrawalsResult);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load approvals.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Unthrottled: a transaction approved/rejected in ApprovalRequestScreen must disappear from
  // this list the instant the parent taps back, not up to 30s later.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const walletToStudentName = useMemo(() => {
    const map = new Map<string, string>();
    students.forEach(({ student, wallets }) => {
      wallets.forEach((wallet) => map.set(wallet.id, student.fullName));
    });
    return map;
  }, [students]);

  const handleApproveSavings = async (request: PersonalSavingsHistory) => {
    setProcessingId(request.id);
    try {
      await savingsService.approveWithdrawal(request.id);
      setSnackbarMessage('Withdrawal approved.');
      await load();
    } catch (err) {
      setSnackbarMessage(err instanceof ApiError ? err.message : 'Could not approve this request.');
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectDialog = (request: PersonalSavingsHistory) => {
    setRejectTarget(request);
    setRejectReason('');
  };

  const closeRejectDialog = () => {
    if (processingId) return;
    setRejectTarget(null);
  };

  const handleRejectSavings = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    setProcessingId(rejectTarget.id);
    try {
      await savingsService.rejectWithdrawal(rejectTarget.id, rejectReason.trim());
      setRejectTarget(null);
      setSnackbarMessage('Withdrawal rejected.');
      await load();
    } catch (err) {
      setSnackbarMessage(err instanceof ApiError ? err.message : 'Could not reject this request.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveCashWithdrawal = async (request: WithdrawalRequestWithStudent) => {
    setCashProcessingId(request.id);
    try {
      await withdrawalService.approveWithdrawal(request.id);
      setSnackbarMessage('Cash withdrawal approved.');
      await load();
    } catch (err) {
      setSnackbarMessage(err instanceof ApiError ? err.message : 'Could not approve this request.');
    } finally {
      setCashProcessingId(null);
    }
  };

  const openCashRejectDialog = (request: WithdrawalRequestWithStudent) => {
    setCashRejectTarget(request);
    setCashRejectReason('');
  };

  const closeCashRejectDialog = () => {
    if (cashProcessingId) return;
    setCashRejectTarget(null);
  };

  const handleRejectCashWithdrawal = async () => {
    if (!cashRejectTarget || !cashRejectReason.trim()) return;
    setCashProcessingId(cashRejectTarget.id);
    try {
      await withdrawalService.rejectWithdrawal(cashRejectTarget.id, cashRejectReason.trim());
      setCashRejectTarget(null);
      setSnackbarMessage('Cash withdrawal rejected.');
      await load();
    } catch (err) {
      setSnackbarMessage(err instanceof ApiError ? err.message : 'Could not reject this request.');
    } finally {
      setCashProcessingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Approvals
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} />}
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            These are general transfers your student made above your approval threshold.
            Education-locked spending is handled automatically.
          </Text>
        </View>

        {isLoading && approvals.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : approvals.length > 0 ? (
          approvals.map((transaction) => {
            const category = categoryLookup.get(
              transaction.category.toLowerCase() as BudgetCategoryKey
            );
            const statusMeta = TRANSACTION_STATUS_META[transaction.status];
            const studentName = transaction.fromWalletId
              ? (walletToStudentName.get(transaction.fromWalletId) ?? 'Student')
              : 'Student';
            return (
              <TouchableOpacity
                key={transaction.id}
                style={styles.approvalRow}
                onPress={() =>
                  navigation.navigate('ApprovalRequest', { transaction, studentName })
                }
              >
                <IconBadge
                  icon={category?.icon ?? 'wallet-outline'}
                  color={category?.color ?? colors.primary}
                  size={44}
                />
                <View style={styles.approvalMiddle}>
                  <Text style={styles.approvalTitle}>{transactionTitle(transaction)}</Text>
                  <Text style={styles.approvalSubtitle}>
                    {studentName} • ${Number(transaction.amount).toFixed(2)}
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

        <Text style={styles.sectionTitle}>Savings Withdrawal Requests</Text>
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            Your student is asking to withdraw from their Personal Savings balance.
          </Text>
        </View>

        {isLoading && savingsRequests.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : savingsRequests.length > 0 ? (
          savingsRequests.map((request) => {
            const studentName = walletToStudentName.get(request.walletId) ?? 'Student';
            const isProcessing = processingId === request.id;
            return (
              <View key={request.id} style={styles.savingsRow}>
                <IconBadge icon="piggy-bank-outline" color={colors.accent} size={44} />
                <View style={styles.approvalMiddle}>
                  <Text style={styles.approvalTitle}>
                    {studentName} • ${Number(request.amount).toFixed(2)}
                  </Text>
                  <Text style={styles.approvalSubtitle} numberOfLines={2}>
                    {request.reason}
                  </Text>
                  <View style={styles.savingsActionsRow}>
                    <Button
                      mode="outlined"
                      textColor={colors.danger}
                      compact
                      style={[styles.savingsActionButton, styles.rejectButton]}
                      disabled={isProcessing}
                      onPress={() => openRejectDialog(request)}
                    >
                      Reject
                    </Button>
                    <Button
                      mode="contained"
                      buttonColor={colors.accent}
                      compact
                      style={styles.savingsActionButton}
                      disabled={isProcessing}
                      onPress={() => handleApproveSavings(request)}
                    >
                      {isProcessing ? (
                        <ActivityIndicator size={14} color={colors.onPrimary} />
                      ) : (
                        'Approve'
                      )}
                    </Button>
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <Card style={styles.emptyCard} mode="elevated">
            <Card.Content style={styles.emptyState}>
              <Avatar.Icon
                icon="piggy-bank-outline"
                size={56}
                style={styles.emptyIcon}
                color={colors.accent}
              />
              <Text style={styles.emptyTitle}>No withdrawal requests</Text>
              <Text style={styles.emptySubtitle}>You&apos;re all caught up.</Text>
            </Card.Content>
          </Card>
        )}

        <Text style={styles.sectionTitle}>Pending Cash Withdrawal Approvals</Text>
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            Your student is at an agent trying to withdraw general cash above your approval
            threshold. The agent can&apos;t dispense it until you approve.
          </Text>
        </View>

        {isLoading && cashWithdrawals.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : cashWithdrawals.length > 0 ? (
          cashWithdrawals.map((request) => {
            const isProcessing = cashProcessingId === request.id;
            return (
              <View key={request.id} style={styles.savingsRow}>
                <IconBadge icon="cash-multiple" color={colors.primary} size={44} />
                <View style={styles.approvalMiddle}>
                  <Text style={styles.approvalTitle}>
                    {request.wallet.user.fullName} • ${Number(request.amount).toFixed(2)}
                  </Text>
                  <Text style={styles.approvalSubtitle}>Cash withdrawal — General</Text>
                  <View style={styles.savingsActionsRow}>
                    <Button
                      mode="outlined"
                      textColor={colors.danger}
                      compact
                      style={[styles.savingsActionButton, styles.rejectButton]}
                      disabled={isProcessing}
                      onPress={() => openCashRejectDialog(request)}
                    >
                      Reject
                    </Button>
                    <Button
                      mode="contained"
                      buttonColor={colors.accent}
                      compact
                      style={styles.savingsActionButton}
                      disabled={isProcessing}
                      onPress={() => handleApproveCashWithdrawal(request)}
                    >
                      {isProcessing ? (
                        <ActivityIndicator size={14} color={colors.onPrimary} />
                      ) : (
                        'Approve'
                      )}
                    </Button>
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <Card style={styles.emptyCard} mode="elevated">
            <Card.Content style={styles.emptyState}>
              <Avatar.Icon
                icon="cash-multiple"
                size={56}
                style={styles.emptyIcon}
                color={colors.primary}
              />
              <Text style={styles.emptyTitle}>No cash withdrawal requests</Text>
              <Text style={styles.emptySubtitle}>You&apos;re all caught up.</Text>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      <Portal>
        <Dialog visible={Boolean(rejectTarget)} onDismiss={closeRejectDialog}>
          <Dialog.Title>Reject Withdrawal</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Reason"
              value={rejectReason}
              onChangeText={setRejectReason}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              multiline
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeRejectDialog} disabled={Boolean(processingId)}>
              Cancel
            </Button>
            <Button
              onPress={handleRejectSavings}
              disabled={!rejectReason.trim() || Boolean(processingId)}
            >
              {processingId ? <ActivityIndicator size={16} color={colors.danger} /> : 'Reject'}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={Boolean(cashRejectTarget)} onDismiss={closeCashRejectDialog}>
          <Dialog.Title>Reject Cash Withdrawal</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Reason"
              value={cashRejectReason}
              onChangeText={setCashRejectReason}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              multiline
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeCashRejectDialog} disabled={Boolean(cashProcessingId)}>
              Cancel
            </Button>
            <Button
              onPress={handleRejectCashWithdrawal}
              disabled={!cashRejectReason.trim() || Boolean(cashProcessingId)}
            >
              {cashProcessingId ? <ActivityIndicator size={16} color={colors.danger} /> : 'Reject'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={Boolean(snackbarMessage)}
        onDismiss={() => setSnackbarMessage(null)}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>
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
  loading: {
    marginTop: 24,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  infoBanner: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  infoBannerText: {
    fontSize: 12,
    color: colors.label,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.heading,
    marginTop: 24,
    marginBottom: 12,
  },
  savingsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  savingsActionsRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  savingsActionButton: {
    flex: 1,
    marginRight: 8,
    borderRadius: 8,
  },
  rejectButton: {
    borderColor: colors.danger,
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
