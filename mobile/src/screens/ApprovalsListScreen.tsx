import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Button, Snackbar, Text, TextInput } from 'react-native-paper';
import type { PersonalSavingsHistory, Transaction, WithdrawalRequestWithStudent } from '../types/api';
import IconBadge from '../components/IconBadge';
import { BUDGET_CATEGORIES } from '../constants/budgetCategories';
import type { BudgetCategoryKey } from '../constants/budgetCategories';
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

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function SectionHeader({
  icon,
  title,
  count,
}: Readonly<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; count: number }>) {
  return (
    <View style={styles.sectionHeaderRow}>
      <View style={styles.sectionHeaderLeft}>
        <MaterialCommunityIcons name={icon} size={17} color={colors.primary} />
        <Text style={styles.sectionHeaderTitle}>{title}</Text>
      </View>
      <View style={styles.countBadge}>
        <Text style={styles.countBadgeText}>{count}</Text>
      </View>
    </View>
  );
}

function InfoBanner({ text }: Readonly<{ text: string }>) {
  return (
    <View style={styles.infoBanner}>
      <MaterialCommunityIcons name="information-outline" size={13} color={colors.muted} />
      <Text style={styles.infoBannerText}>{text}</Text>
    </View>
  );
}

function CategoryBadge({ label, color }: Readonly<{ label: string; color: string }>) {
  return (
    <View style={[styles.categoryPill, { backgroundColor: `${color}1F` }]}>
      <Text style={[styles.categoryPillText, { color }]}>{label}</Text>
    </View>
  );
}

function EmptyState({
  icon,
  color,
  title,
}: Readonly<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string; title: string }>) {
  return (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons name={icon} size={30} color={color} />
      <Text style={styles.emptyTitle}>{title}</Text>
    </View>
  );
}

// The one action surface shared by all three approval types (Transfers, Savings Withdrawal,
// Cash Withdrawal) — Approve fires immediately, Reject swaps the button row for an inline
// reason field in place rather than opening a separate dialog, so the whole decision stays on
// the card the parent is already looking at.
function InlineApprovalActions({
  isProcessing,
  isRejecting,
  rejectReason,
  onChangeReason,
  onApprove,
  onStartReject,
  onCancelReject,
  onSubmitReject,
}: Readonly<{
  isProcessing: boolean;
  isRejecting: boolean;
  rejectReason: string;
  onChangeReason: (text: string) => void;
  onApprove: () => void;
  onStartReject: () => void;
  onCancelReject: () => void;
  onSubmitReject: () => void;
}>) {
  if (isRejecting) {
    return (
      <View style={styles.rejectInlineWrap}>
        <TextInput
          mode="outlined"
          dense
          placeholder="Reason for rejecting"
          value={rejectReason}
          onChangeText={onChangeReason}
          style={styles.rejectInlineInput}
          outlineColor={colors.border}
          activeOutlineColor={colors.danger}
        />
        <View style={styles.rejectInlineButtons}>
          <Button mode="text" compact textColor={colors.muted} disabled={isProcessing} onPress={onCancelReject}>
            Cancel
          </Button>
          <Button
            mode="contained"
            compact
            buttonColor={colors.danger}
            style={styles.rejectInlineSubmit}
            disabled={!rejectReason.trim() || isProcessing}
            onPress={onSubmitReject}
          >
            {isProcessing ? <ActivityIndicator size={14} color="#FFFFFF" /> : 'Submit'}
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.cardActionsRow}>
      <Button
        mode="outlined"
        compact
        textColor={colors.danger}
        style={[styles.cardActionButton, styles.cardRejectButton]}
        disabled={isProcessing}
        onPress={onStartReject}
      >
        Reject
      </Button>
      <Button
        mode="contained"
        compact
        buttonColor={colors.accent}
        style={styles.cardActionButton}
        disabled={isProcessing}
        onPress={onApprove}
      >
        {isProcessing ? <ActivityIndicator size={14} color={colors.onPrimary} /> : 'Approve'}
      </Button>
    </View>
  );
}

export default function ApprovalsListScreen({ navigation: _navigation }: ParentTabScreenProps<'Approvals'>) {
  const [approvals, setApprovals] = useState<Transaction[]>([]);
  const [savingsRequests, setSavingsRequests] = useState<PersonalSavingsHistory[]>([]);
  const [cashWithdrawals, setCashWithdrawals] = useState<WithdrawalRequestWithStudent[]>([]);
  const [students, setStudents] = useState<LinkedStudent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const [transferProcessingId, setTransferProcessingId] = useState<string | null>(null);
  const [transferRejectId, setTransferRejectId] = useState<string | null>(null);
  const [transferRejectReason, setTransferRejectReason] = useState('');

  const [savingsProcessingId, setSavingsProcessingId] = useState<string | null>(null);
  const [savingsRejectId, setSavingsRejectId] = useState<string | null>(null);
  const [savingsRejectReason, setSavingsRejectReason] = useState('');

  const [cashProcessingId, setCashProcessingId] = useState<string | null>(null);
  const [cashRejectId, setCashRejectId] = useState<string | null>(null);
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

  // Unthrottled: an approve/reject action must drop the row from this list the instant it
  // resolves, not up to 30s later.
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

  // --- Transfers ---

  const handleApproveTransfer = async (transaction: Transaction) => {
    setTransferProcessingId(transaction.id);
    try {
      await parentalService.approveTransaction(transaction.id);
      setSnackbarMessage('Transfer approved.');
      await load();
    } catch (err) {
      setSnackbarMessage(err instanceof ApiError ? err.message : 'Could not approve this transfer.');
    } finally {
      setTransferProcessingId(null);
    }
  };

  const openTransferReject = (transactionId: string) => {
    setTransferRejectId(transactionId);
    setTransferRejectReason('');
  };

  const cancelTransferReject = () => {
    if (transferProcessingId) return;
    setTransferRejectId(null);
  };

  const handleRejectTransfer = async () => {
    if (!transferRejectId || !transferRejectReason.trim()) return;
    setTransferProcessingId(transferRejectId);
    try {
      await parentalService.rejectTransaction(transferRejectId, transferRejectReason.trim());
      setTransferRejectId(null);
      setSnackbarMessage('Transfer rejected.');
      await load();
    } catch (err) {
      setSnackbarMessage(err instanceof ApiError ? err.message : 'Could not reject this transfer.');
    } finally {
      setTransferProcessingId(null);
    }
  };

  // --- Savings withdrawal requests ---

  const handleApproveSavings = async (request: PersonalSavingsHistory) => {
    setSavingsProcessingId(request.id);
    try {
      await savingsService.approveWithdrawal(request.id);
      setSnackbarMessage('Withdrawal approved.');
      await load();
    } catch (err) {
      setSnackbarMessage(err instanceof ApiError ? err.message : 'Could not approve this request.');
    } finally {
      setSavingsProcessingId(null);
    }
  };

  const openSavingsReject = (requestId: string) => {
    setSavingsRejectId(requestId);
    setSavingsRejectReason('');
  };

  const cancelSavingsReject = () => {
    if (savingsProcessingId) return;
    setSavingsRejectId(null);
  };

  const handleRejectSavings = async () => {
    if (!savingsRejectId || !savingsRejectReason.trim()) return;
    setSavingsProcessingId(savingsRejectId);
    try {
      await savingsService.rejectWithdrawal(savingsRejectId, savingsRejectReason.trim());
      setSavingsRejectId(null);
      setSnackbarMessage('Withdrawal rejected.');
      await load();
    } catch (err) {
      setSnackbarMessage(err instanceof ApiError ? err.message : 'Could not reject this request.');
    } finally {
      setSavingsProcessingId(null);
    }
  };

  // --- Cash withdrawals ---

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

  const openCashReject = (requestId: string) => {
    setCashRejectId(requestId);
    setCashRejectReason('');
  };

  const cancelCashReject = () => {
    if (cashProcessingId) return;
    setCashRejectId(null);
  };

  const handleRejectCashWithdrawal = async () => {
    if (!cashRejectId || !cashRejectReason.trim()) return;
    setCashProcessingId(cashRejectId);
    try {
      await withdrawalService.rejectWithdrawal(cashRejectId, cashRejectReason.trim());
      setCashRejectId(null);
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
        <MaterialCommunityIcons name="clipboard-check-outline" size={22} color={colors.primary} />
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Approvals
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} />}
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.section}>
          <SectionHeader icon="swap-horizontal" title="Transfers" count={approvals.length} />
          <InfoBanner text="General transfers above your approval threshold. Education-locked spending is handled automatically." />

          {isLoading && approvals.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={styles.loading} />
          ) : approvals.length > 0 ? (
            approvals.map((transaction) => {
              const category = categoryLookup.get(
                transaction.category.toLowerCase() as BudgetCategoryKey
              );
              const studentName = transaction.fromWalletId
                ? (walletToStudentName.get(transaction.fromWalletId) ?? 'Student')
                : 'Student';
              const isProcessing = transferProcessingId === transaction.id;
              const isRejecting = transferRejectId === transaction.id;
              return (
                <View key={transaction.id} style={styles.approvalCard}>
                  <View style={styles.cardTopRow}>
                    <IconBadge
                      icon={category?.icon ?? 'wallet-outline'}
                      color={category?.color ?? colors.primary}
                      size={40}
                    />
                    <View style={styles.cardMiddle}>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {transactionTitle(transaction)}
                      </Text>
                      <Text style={styles.itemSubtitle}>
                        {studentName} • ${Number(transaction.amount).toFixed(2)}
                      </Text>
                      <View style={styles.itemMetaRow}>
                        {category ? <CategoryBadge label={category.label} color={category.color} /> : null}
                        <Text style={styles.itemDate}>{formatDate(transaction.createdAt)}</Text>
                      </View>
                    </View>
                  </View>
                  <InlineApprovalActions
                    isProcessing={isProcessing}
                    isRejecting={isRejecting}
                    rejectReason={isRejecting ? transferRejectReason : ''}
                    onChangeReason={setTransferRejectReason}
                    onApprove={() => handleApproveTransfer(transaction)}
                    onStartReject={() => openTransferReject(transaction.id)}
                    onCancelReject={cancelTransferReject}
                    onSubmitReject={handleRejectTransfer}
                  />
                </View>
              );
            })
          ) : (
            <EmptyState icon="check-circle-outline" color={colors.accent} title="No pending approvals" />
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader
            icon="piggy-bank-outline"
            title="Savings Withdrawal Requests"
            count={savingsRequests.length}
          />
          <InfoBanner text="Your student is asking to withdraw from their Personal Savings balance." />

          {isLoading && savingsRequests.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={styles.loading} />
          ) : savingsRequests.length > 0 ? (
            savingsRequests.map((request) => {
              const studentName = walletToStudentName.get(request.walletId) ?? 'Student';
              const isProcessing = savingsProcessingId === request.id;
              const isRejecting = savingsRejectId === request.id;
              return (
                <View key={request.id} style={styles.approvalCard}>
                  <View style={styles.cardTopRow}>
                    <IconBadge icon="piggy-bank-outline" color={colors.accent} size={40} />
                    <View style={styles.cardMiddle}>
                      <Text style={styles.itemTitle}>
                        {studentName} • ${Number(request.amount).toFixed(2)}
                      </Text>
                      <Text style={styles.itemSubtitle} numberOfLines={2}>
                        {request.reason}
                      </Text>
                      <View style={styles.itemMetaRow}>
                        <CategoryBadge label="Personal Savings" color={colors.accent} />
                        <Text style={styles.itemDate}>{formatDate(request.createdAt)}</Text>
                      </View>
                    </View>
                  </View>
                  <InlineApprovalActions
                    isProcessing={isProcessing}
                    isRejecting={isRejecting}
                    rejectReason={isRejecting ? savingsRejectReason : ''}
                    onChangeReason={setSavingsRejectReason}
                    onApprove={() => handleApproveSavings(request)}
                    onStartReject={() => openSavingsReject(request.id)}
                    onCancelReject={cancelSavingsReject}
                    onSubmitReject={handleRejectSavings}
                  />
                </View>
              );
            })
          ) : (
            <EmptyState icon="piggy-bank-outline" color={colors.accent} title="No withdrawal requests" />
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader
            icon="cash-multiple"
            title="Pending Cash Withdrawal Approvals"
            count={cashWithdrawals.length}
          />
          <InfoBanner text="Your student is at an agent trying to withdraw general cash above your approval threshold." />

          {isLoading && cashWithdrawals.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={styles.loading} />
          ) : cashWithdrawals.length > 0 ? (
            cashWithdrawals.map((request) => {
              const isProcessing = cashProcessingId === request.id;
              const isRejecting = cashRejectId === request.id;
              return (
                <View key={request.id} style={styles.approvalCard}>
                  <View style={styles.cardTopRow}>
                    <IconBadge icon="cash-multiple" color={colors.primary} size={40} />
                    <View style={styles.cardMiddle}>
                      <Text style={styles.itemTitle}>
                        {request.wallet.user.fullName} • ${Number(request.amount).toFixed(2)}
                      </Text>
                      <View style={styles.itemMetaRow}>
                        <CategoryBadge label="General" color={colors.primary} />
                        <Text style={styles.itemDate}>{formatDate(request.createdAt)}</Text>
                      </View>
                    </View>
                  </View>
                  <InlineApprovalActions
                    isProcessing={isProcessing}
                    isRejecting={isRejecting}
                    rejectReason={isRejecting ? cashRejectReason : ''}
                    onChangeReason={setCashRejectReason}
                    onApprove={() => handleApproveCashWithdrawal(request)}
                    onStartReject={() => openCashReject(request.id)}
                    onCancelReject={cancelCashReject}
                    onSubmitReject={handleRejectCashWithdrawal}
                  />
                </View>
              );
            })
          ) : (
            <EmptyState icon="cash-multiple" color={colors.primary} title="No cash withdrawal requests" />
          )}
        </View>
      </ScrollView>

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
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: {
    fontWeight: '700',
    color: colors.heading,
    marginLeft: 8,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  loading: {
    marginTop: 16,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  section: {
    marginBottom: 22,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.heading,
    marginLeft: 7,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 7,
    backgroundColor: `${colors.primary}1F`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 2,
    marginBottom: 10,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 11,
    color: colors.muted,
    lineHeight: 15,
    marginLeft: 6,
  },
  approvalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardMiddle: {
    flex: 1,
    marginLeft: 10,
  },
  itemTitle: {
    fontWeight: '700',
    color: colors.heading,
    fontSize: 13.5,
  },
  itemSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  itemDate: {
    fontSize: 11,
    color: colors.muted,
    marginLeft: 8,
  },
  categoryPill: {
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardActionsRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  cardActionButton: {
    flex: 1,
    marginRight: 8,
    borderRadius: 8,
  },
  cardRejectButton: {
    borderColor: colors.danger,
    marginRight: 8,
  },
  rejectInlineWrap: {
    marginTop: 10,
  },
  rejectInlineInput: {
    backgroundColor: '#FFFFFF',
    fontSize: 13,
    height: 40,
  },
  rejectInlineButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  rejectInlineSubmit: {
    marginLeft: 4,
    borderRadius: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  emptyTitle: {
    fontWeight: '700',
    color: colors.heading,
    fontSize: 12.5,
    marginTop: 6,
  },
});
