import { useCallback, useMemo, useState } from 'react';
import { Dimensions, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  Dialog,
  IconButton,
  Portal,
  Text,
} from 'react-native-paper';
import type { Transaction } from '../types/api';
import IconBadge from '../components/IconBadge';
import { BUDGET_CATEGORIES } from '../constants/budgetCategories';
import type { BudgetCategoryKey } from '../constants/budgetCategories';
import { TRANSACTION_STATUS_META } from '../constants/mockTransactions';
import { useNotifications } from '../context/NotificationsContext';
import { useWallet } from '../context/WalletContext';
import { colors } from '../theme/colors';
import { getInitials } from '../utils/getInitials';
import * as parentalService from '../services/parentalService';
import type { LinkedStudent, StudentSpendingBreakdown } from '../services/parentalService';
import { ApiError } from '../services/api';
import { progressColorFor } from '../utils/progressColor';
import type { ParentTabScreenProps } from '../navigation/types';

const categoryLookup = new Map(BUDGET_CATEGORIES.map((category) => [category.key, category]));
const PENDING_PREVIEW_COUNT = 2;
const SCREEN_HEIGHT = Dimensions.get('window').height;

function transactionTitle(transaction: Transaction): string {
  if (transaction.note) return transaction.note;
  const category = categoryLookup.get(transaction.category.toLowerCase() as BudgetCategoryKey);
  return category?.label ?? 'Payment';
}

export default function ParentDashboardScreen({
  navigation,
}: Readonly<ParentTabScreenProps<'Home'>>) {
  const { wallet: parentWallet, refresh: refreshParentWallet } = useWallet();
  const { unreadCount } = useNotifications();
  const [students, setStudents] = useState<LinkedStudent[]>([]);
  const [approvals, setApprovals] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [breakdownVisible, setBreakdownVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<LinkedStudent | null>(null);
  const [breakdown, setBreakdown] = useState<StudentSpendingBreakdown | null>(null);
  const [isLoadingBreakdown, setIsLoadingBreakdown] = useState(false);
  const [breakdownError, setBreakdownError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [studentsResult, approvalsResult] = await Promise.all([
        parentalService.getLinkedStudents(),
        parentalService.getPendingApprovals(),
      ]);
      setStudents(studentsResult);
      setApprovals(approvalsResult);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load your dashboard.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshDashboard = useCallback(() => {
    void load();
    void refreshParentWallet();
  }, [load, refreshParentWallet]);

  // Unthrottled: the parent's home tab must reflect a just-approved transfer or a student's
  // card payment the instant the parent returns here, not up to 30s later.
  useFocusEffect(
    useCallback(() => {
      refreshDashboard();
    }, [refreshDashboard])
  );

  const walletToStudentName = useMemo(() => {
    const map = new Map<string, string>();
    students.forEach(({ student, wallets }) => {
      wallets.forEach((wallet) => map.set(wallet.id, student.fullName));
    });
    return map;
  }, [students]);

  const pendingPreview = approvals.slice(0, PENDING_PREVIEW_COUNT);

  const openBreakdown = useCallback(async (linkedStudent: LinkedStudent) => {
    setSelectedStudent(linkedStudent);
    setBreakdownVisible(true);
    setBreakdown(null);
    setBreakdownError(null);
    setIsLoadingBreakdown(true);
    try {
      const result = await parentalService.getStudentBreakdown(linkedStudent.student.id);
      setBreakdown(result);
    } catch (err) {
      setBreakdownError(err instanceof ApiError ? err.message : 'Failed to load spending details.');
    } finally {
      setIsLoadingBreakdown(false);
    }
  }, []);

  const closeBreakdown = () => setBreakdownVisible(false);

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Parent Dashboard
        </Text>
        <View style={styles.bellWrapper}>
          <IconButton
            icon="bell-outline"
            iconColor={colors.heading}
            size={24}
            onPress={() => navigation.navigate('Notifications')}
            style={styles.bellButton}
          />
          {unreadCount > 0 && (
            <Badge style={styles.bellBadge} size={16}>
              {unreadCount}
            </Badge>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} />}
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.walletCard}
        >
          <View style={styles.walletCardRow}>
            <View style={styles.walletCardLeft}>
              <Text style={styles.walletBalanceLabel}>Your Wallet Balance</Text>
              {!parentWallet ? (
                <ActivityIndicator color={colors.onPrimary} style={styles.balanceLoading} />
              ) : (
                <Text style={styles.walletBalanceValue}>
                  ${Number(parentWallet.balance).toFixed(2)} {parentWallet.currency}
                </Text>
              )}
              <Text style={styles.walletNote}>Contact admin to add funds to your wallet</Text>
            </View>
            <View style={styles.walletIconCircle}>
              <MaterialCommunityIcons name="wallet-outline" size={28} color="#FFFFFF" />
            </View>
          </View>
        </LinearGradient>

        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabel}>Linked Students</Text>
          {students.length > 0 ? (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{students.length}</Text>
            </View>
          ) : null}
        </View>
        {isLoading && students.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={styles.studentsLoading} />
        ) : students.length > 0 ? (
          students.map((linkedStudent) => {
            const { student, wallets } = linkedStudent;
            const balance = wallets.length > 0 ? Number(wallets[0].balance) : 0;
            return (
              <TouchableOpacity
                key={student.id}
                style={styles.studentCard}
                activeOpacity={0.85}
                onPress={() => openBreakdown(linkedStudent)}
              >
                <View style={styles.studentRow}>
                  <Avatar.Text
                    size={48}
                    label={getInitials(student.fullName)}
                    style={styles.studentAvatar}
                    color={colors.onPrimary}
                  />
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{student.fullName}</Text>
                    <Text style={styles.studentEmail}>{student.email}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={22} color={colors.muted} />
                </View>
                <Text style={styles.studentBalanceLabel}>Wallet Balance</Text>
                <Text style={styles.studentBalanceValue}>${balance.toFixed(2)}</Text>
                <Text style={styles.studentCardHint}>Tap for spending details</Text>
              </TouchableOpacity>
            );
          })
        ) : (
          <Card style={styles.emptyCard} mode="elevated">
            <Card.Content style={styles.emptyState}>
              <Avatar.Icon
                icon="account-group-outline"
                size={48}
                style={styles.emptyIcon}
                color={colors.primary}
              />
              <Text style={styles.emptyTitle}>No students linked</Text>
              <Text style={styles.emptySubtitle}>
                Students you link will show up here.
              </Text>
            </Card.Content>
          </Card>
        )}

        <View style={[styles.pendingHeaderRow, styles.pendingHeaderRowSpacing]}>
          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionLabel}>Pending Approvals</Text>
            {approvals.length > 0 ? (
              <View style={styles.pendingCountBadge}>
                <Text style={styles.pendingCountBadgeText}>{approvals.length}</Text>
              </View>
            ) : null}
          </View>
          <Button
            mode="text"
            compact
            textColor={colors.primary}
            onPress={() => navigation.navigate('Approvals')}
          >
            See All
          </Button>
        </View>
        <View style={styles.pendingCard}>
          {pendingPreview.length > 0 ? (
            pendingPreview.map((transaction) => {
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
            <View style={styles.emptyState}>
              <Avatar.Icon
                icon="check-circle-outline"
                size={48}
                style={styles.emptyIcon}
                color={colors.accent}
              />
              <Text style={styles.emptyTitle}>No pending approvals</Text>
              <Text style={styles.emptySubtitle}>You&apos;re all caught up.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Portal>
        <Dialog visible={breakdownVisible} onDismiss={closeBreakdown} style={styles.breakdownDialog}>
          <View style={styles.breakdownHeader}>
            <Avatar.Text
              size={48}
              label={getInitials(selectedStudent?.student.fullName ?? '?')}
              style={styles.breakdownAvatar}
              color={colors.onPrimary}
            />
            <View style={styles.breakdownHeaderText}>
              <Text style={styles.breakdownStudentName} numberOfLines={1}>
                {selectedStudent?.student.fullName ?? 'Student'}
              </Text>
              <Text style={styles.breakdownSubtitle}>Spending Overview</Text>
            </View>
          </View>

          <Dialog.ScrollArea style={styles.breakdownScrollArea}>
            <ScrollView contentContainerStyle={styles.breakdownContent}>
              {isLoadingBreakdown ? (
                <ActivityIndicator color={colors.primary} style={styles.breakdownLoading} />
              ) : breakdownError ? (
                <Text style={styles.errorText}>{breakdownError}</Text>
              ) : breakdown ? (
                <>
                  <Text style={styles.breakdownSectionLabel}>Allowed Categories</Text>
                  {breakdown.allowedCategories.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.allowedCategoriesRow}
                    >
                      {breakdown.allowedCategories.map((cat) => {
                        const category = categoryLookup.get(cat.toLowerCase() as BudgetCategoryKey);
                        const color = category?.color ?? colors.muted;
                        return (
                          <View
                            key={cat}
                            style={[styles.allowedCategoryPill, { backgroundColor: `${color}1F` }]}
                          >
                            <Text style={[styles.allowedCategoryPillText, { color }]}>
                              {category?.label ?? cat}
                            </Text>
                          </View>
                        );
                      })}
                    </ScrollView>
                  ) : (
                    <Text style={styles.emptySubtitle}>No categories authorized yet.</Text>
                  )}

                  <Text style={[styles.breakdownSectionLabel, styles.breakdownSectionSpacing]}>
                    Locked Funds
                  </Text>
                  {breakdown.categories.length > 0 ? (
                    breakdown.categories.map((entry) => {
                      const category = categoryLookup.get(
                        entry.category.toLowerCase() as BudgetCategoryKey
                      );
                      const total = entry.locked + entry.spent;
                      const progress = total > 0 ? Math.min(entry.spent / total, 1) : 0;
                      return (
                        <View key={entry.category} style={styles.lockedCard}>
                          <View style={styles.breakdownCategoryHeader}>
                            <IconBadge
                              icon={category?.icon ?? 'wallet-outline'}
                              color={category?.color ?? colors.primary}
                              size={36}
                              iconSize={18}
                            />
                            <Text style={styles.breakdownCategoryLabel}>
                              {category?.label ?? entry.category}
                            </Text>
                            <Text style={styles.breakdownCategoryAmount}>
                              ${entry.locked.toFixed(2)}
                            </Text>
                          </View>
                          <View style={styles.progressTrack}>
                            <View
                              style={[
                                styles.progressFill,
                                {
                                  width: `${Math.round(progress * 100)}%`,
                                  backgroundColor: progressColorFor(progress * 100),
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.breakdownCategorySpent}>
                            ${entry.spent.toFixed(2)} spent of ${total.toFixed(2)}
                          </Text>
                        </View>
                      );
                    })
                  ) : (
                    <Text style={styles.emptySubtitle}>No locked funds yet.</Text>
                  )}
                </>
              ) : null}
            </ScrollView>
          </Dialog.ScrollArea>

          <View style={styles.breakdownFooter}>
            <TouchableOpacity style={styles.breakdownCloseButton} onPress={closeBreakdown}>
              <MaterialCommunityIcons name="close" size={16} color={colors.primary} />
              <Text style={styles.breakdownCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerTitle: {
    fontWeight: '700',
    color: colors.heading,
  },
  bellWrapper: {
    marginRight: -8,
  },
  bellButton: {
    margin: 0,
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.danger,
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
  walletCard: {
    borderRadius: 20,
    padding: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  walletCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  walletCardLeft: {
    flex: 1,
  },
  walletIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  walletBalanceLabel: {
    color: '#DBEAFE',
    fontSize: 12,
  },
  walletBalanceValue: {
    color: colors.onPrimary,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 2,
  },
  walletNote: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    marginTop: 10,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: `${colors.primary}1F`,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    marginBottom: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  studentsLoading: {
    marginTop: 8,
    marginBottom: 16,
  },
  studentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  studentAvatar: {
    backgroundColor: colors.primary,
  },
  studentInfo: {
    marginLeft: 12,
    flex: 1,
  },
  studentName: {
    color: colors.heading,
    fontSize: 16,
    fontWeight: '700',
  },
  studentEmail: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  studentBalanceLabel: {
    color: colors.muted,
    fontSize: 11,
  },
  studentBalanceValue: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  studentCardHint: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 8,
  },
  breakdownDialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
  },
  breakdownAvatar: {
    backgroundColor: colors.primary,
  },
  breakdownHeaderText: {
    marginLeft: 12,
    flexShrink: 1,
  },
  breakdownStudentName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.heading,
  },
  breakdownSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  breakdownScrollArea: {
    paddingHorizontal: 0,
    maxHeight: SCREEN_HEIGHT * 0.55,
    backgroundColor: colors.surface,
  },
  breakdownContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  breakdownLoading: {
    marginVertical: 24,
  },
  breakdownSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  breakdownSectionSpacing: {
    marginTop: 20,
  },
  allowedCategoriesRow: {
    flexDirection: 'row',
  },
  allowedCategoryPill: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  allowedCategoryPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  lockedCard: {
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
  breakdownCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  breakdownCategoryLabel: {
    flex: 1,
    fontWeight: '700',
    color: colors.heading,
    marginLeft: 10,
  },
  breakdownCategoryAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  breakdownFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  breakdownCloseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
  },
  breakdownCloseButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: 8,
  },
  breakdownCategorySpent: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 6,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  balanceLoading: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.label,
    marginBottom: 10,
  },
  pendingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pendingHeaderRowSpacing: {
    marginTop: 10,
  },
  pendingCountBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: `${colors.danger}1F`,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    marginBottom: 10,
  },
  pendingCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.danger,
  },
  pendingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
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
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyIcon: {
    backgroundColor: colors.surface,
    marginBottom: 10,
  },
  emptyTitle: {
    fontWeight: '700',
    color: colors.heading,
    marginBottom: 4,
  },
  emptySubtitle: {
    color: colors.muted,
  },
});
