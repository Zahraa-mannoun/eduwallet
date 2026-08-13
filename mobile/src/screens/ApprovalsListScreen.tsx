import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Button, Chip, Dialog, Portal, Snackbar, Text, TextInput } from 'react-native-paper';
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
import { classifyTransaction, transactionStatusMeta } from '../utils/transactionDisplay';
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
        <MaterialCommunityIcons name={icon} size={18} color={colors.primary} />
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
      <Text style={styles.infoBannerIcon}>ℹ️</Text>
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
      <MaterialCommunityIcons name={icon} size={40} color={color} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>You&apos;re all caught up.</Text>
    </View>
  );
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

        <View style={styles.sectionCard}>
          <SectionHeader icon="swap-horizontal" title="Approvals" count={approvals.length} />
          <InfoBanner text="These are general transfers your student made above your approval threshold. Education-locked spending is handled automatically." />

          {isLoading && approvals.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={styles.loading} />
          ) : approvals.length > 0 ? (
            approvals.map((transaction) => {
              const category = categoryLookup.get(
                transaction.category.toLowerCase() as BudgetCategoryKey
              );
              const type = classifyTransaction(transaction, false);
              const statusMeta = transactionStatusMeta(transaction, type);
              const studentName = transaction.fromWalletId
                ? (walletToStudentName.get(transaction.fromWalletId) ?? 'Student')
                : 'Student';
              return (
                <TouchableOpacity
                  key={transaction.id}
                  style={styles.itemRow}
                  onPress={() =>
                    navigation.navigate('ApprovalRequest', { transaction, studentName })
                  }
                >
                  <IconBadge
                    icon={category?.icon ?? 'wallet-outline'}
                    color={category?.color ?? colors.primary}
                    size={44}
                  />
                  <View style={styles.itemMiddle}>
                    <Text style={styles.itemTitle}>{transactionTitle(transaction)}</Text>
                    <Text style={styles.itemSubtitle}>
                      {studentName} • ${Number(transaction.amount).toFixed(2)}
                    </Text>
                    <View style={styles.itemMetaRow}>
                      {category ? <CategoryBadge label={category.label} color={category.color} /> : null}
                      <Text style={styles.itemDate}>{formatDate(transaction.createdAt)}</Text>
                    </View>
                  </View>
                  <Chip
                    compact
                    style={[styles.approvalChip, { backgroundColor: statusMeta.bg }]}
                    textStyle={{ color: statusMeta.fg, fontSize: 11, fontWeight: '700' }}
                  >
                    {statusMeta.label}
                  </Chip>
                </TouchableOpacity>
              );
            })
          ) : (
            <EmptyState icon="check-circle-outline" color={colors.accent} title="No pending approvals" />
          )}
        </View>

        <View style={styles.sectionCard}>
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
              const isProcessing = processingId === request.id;
              return (
                <View key={request.id} style={styles.itemRow}>
                  <IconBadge icon="piggy-bank-outline" color={colors.accent} size={44} />
                  <View style={styles.itemMiddle}>
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
                    <View style={styles.actionsRow}>
                      <Button
                        mode="outlined"
                        textColor={colors.danger}
                        compact
                        style={[styles.actionButton, styles.rejectButton]}
                        disabled={isProcessing}
                        onPress={() => openRejectDialog(request)}
                      >
                        Reject
                      </Button>
                      <Button
                        mode="contained"
                        buttonColor={colors.accent}
                        compact
                        style={styles.actionButton}
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
            <EmptyState icon="piggy-bank-outline" color={colors.accent} title="No withdrawal requests" />
          )}
        </View>

        <View style={styles.sectionCard}>
          <SectionHeader
            icon="cash-multiple"
            title="Pending Cash Withdrawal Approvals"
            count={cashWithdrawals.length}
          />
          <InfoBanner text="Your student is at an agent trying to withdraw general cash above your approval threshold. The agent can't dispense it until you approve." />

          {isLoading && cashWithdrawals.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={styles.loading} />
          ) : cashWithdrawals.length > 0 ? (
            cashWithdrawals.map((request) => {
              const isProcessing = cashProcessingId === request.id;
              return (
                <View key={request.id} style={styles.itemRow}>
                  <IconBadge icon="cash-multiple" color={colors.primary} size={44} />
                  <View style={styles.itemMiddle}>
                    <Text style={styles.itemTitle}>
                      {request.wallet.user.fullName} • ${Number(request.amount).toFixed(2)}
                    </Text>
                    <View style={styles.itemMetaRow}>
                      <CategoryBadge label="General" color={colors.primary} />
                      <Text style={styles.itemDate}>{formatDate(request.createdAt)}</Text>
                    </View>
                    <View style={styles.actionsRow}>
                      <Button
                        mode="outlined"
                        textColor={colors.danger}
                        compact
                        style={[styles.actionButton, styles.rejectButton]}
                        disabled={isProcessing}
                        onPress={() => openCashRejectDialog(request)}
                      >
                        Reject
                      </Button>
                      <Button
                        mode="contained"
                        buttonColor={colors.accent}
                        compact
                        style={styles.actionButton}
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
            <EmptyState icon="cash-multiple" color={colors.primary} title="No cash withdrawal requests" />
          )}
        </View>
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
    marginTop: 24,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.heading,
    marginLeft: 8,
  },
  countBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 7,
    backgroundColor: `${colors.primary}1F`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: `${colors.primary}14`,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  infoBannerIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.primaryDark,
    lineHeight: 17,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  itemMiddle: {
    flex: 1,
    marginLeft: 12,
  },
  itemTitle: {
    fontWeight: '700',
    color: colors.heading,
  },
  itemSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
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
  actionsRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    marginRight: 8,
    borderRadius: 8,
  },
  rejectButton: {
    borderColor: colors.danger,
  },
  approvalChip: {
    height: 26,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyTitle: {
    fontWeight: '700',
    color: colors.heading,
    marginTop: 10,
    marginBottom: 4,
  },
  emptySubtitle: {
    color: colors.muted,
    fontSize: 12,
  },
});
