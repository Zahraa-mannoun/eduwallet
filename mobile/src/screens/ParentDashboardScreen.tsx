import { useCallback, useMemo, useState } from 'react';
import { Dimensions, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Avatar, Badge, Card, Dialog, IconButton, Portal, Text } from 'react-native-paper';
import IconBadge from '../components/IconBadge';
import { BUDGET_CATEGORIES } from '../constants/budgetCategories';
import type { BudgetCategoryKey } from '../constants/budgetCategories';
import { useNotifications } from '../context/NotificationsContext';
import { useWallet } from '../context/WalletContext';
import { colors } from '../theme/colors';
import { getInitials } from '../utils/getInitials';
import * as parentalService from '../services/parentalService';
import type { LinkedStudent, StudentSpendingBreakdown } from '../services/parentalService';
import * as savingsService from '../services/savingsService';
import * as walletService from '../services/walletService';
import * as withdrawalService from '../services/withdrawalService';
import { ApiError } from '../services/api';
import { progressColorFor } from '../utils/progressColor';
import { useNotificationRefetch } from '../hooks/useNotificationRefetch';
import type { ParentTabScreenProps } from '../navigation/types';

const categoryLookup = new Map(BUDGET_CATEGORIES.map((category) => [category.key, category]));
const SCREEN_HEIGHT = Dimensions.get('window').height;

function isThisMonth(isoDate: string): boolean {
  const date = new Date(isoDate);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function StatCard({
  icon,
  color,
  value,
  label,
  onPress,
}: Readonly<{
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  value: string;
  label: string;
  onPress?: () => void;
}>) {
  return (
    <TouchableOpacity
      style={styles.statCard}
      activeOpacity={onPress ? 0.85 : 1}
      disabled={!onPress}
      onPress={onPress}
    >
      <View style={[styles.statIconCircle, { backgroundColor: `${color}1F` }]}>
        <MaterialCommunityIcons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function ParentDashboardScreen({
  navigation,
}: Readonly<ParentTabScreenProps<'Home'>>) {
  const { wallet: parentWallet, refresh: refreshParentWallet } = useWallet();
  const { unreadCount } = useNotifications();
  const [students, setStudents] = useState<LinkedStudent[]>([]);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [totalSentThisMonth, setTotalSentThisMonth] = useState(0);
  const [totalLockedFunds, setTotalLockedFunds] = useState(0);
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
      const [studentsResult, approvalsResult, savingsResult, cashResult, transactionsResult] =
        await Promise.all([
          parentalService.getLinkedStudents(),
          parentalService.getPendingApprovals(),
          savingsService.getWithdrawalRequests(),
          withdrawalService.getPendingApprovals(),
          walletService.getTransactions({ limit: 100 }),
        ]);
      setStudents(studentsResult);
      setPendingApprovalsCount(approvalsResult.length + savingsResult.length + cashResult.length);

      const sentThisMonth = transactionsResult.transactions
        .filter(
          (t) =>
            t.fromWalletId === parentWallet?.id &&
            (t.status === 'AUTO_APPROVED' || t.status === 'APPROVED') &&
            isThisMonth(t.createdAt)
        )
        .reduce((sum, t) => sum + Number(t.amount), 0);
      setTotalSentThisMonth(sentThisMonth);

      const lockedTotal = studentsResult.reduce(
        (sum, { wallets }) =>
          sum + wallets.reduce((s2, w) => s2 + w.lockedFunds.reduce((s3, f) => s3 + Number(f.amount), 0), 0),
        0
      );
      setTotalLockedFunds(lockedTotal);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load your dashboard.');
    } finally {
      setIsLoading(false);
    }
  }, [parentWallet?.id]);

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

  useNotificationRefetch(refreshDashboard);

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

        <Text style={[styles.sectionLabel, styles.statsSectionSpacing]}>This Month's Overview</Text>
        <View style={styles.statsGrid}>
          <StatCard
            icon="send-outline"
            color={colors.primary}
            value={`$${totalSentThisMonth.toFixed(2)}`}
            label="Total Sent"
          />
          <StatCard
            icon="clock-alert-outline"
            color="#F59E0B"
            value={String(pendingApprovalsCount)}
            label="Pending Approvals"
            onPress={() => navigation.navigate('Approvals')}
          />
          <StatCard
            icon="account-group-outline"
            color={colors.accent}
            value={String(students.length)}
            label="Linked Students"
          />
          <StatCard
            icon="lock-outline"
            color="#8B5CF6"
            value={`$${totalLockedFunds.toFixed(2)}`}
            label="Active Locked Funds"
          />
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
                  {(() => {
                    // Read straight off the student's own live LockedFund rows (already fetched
                    // via getLinkedStudents(), no separate call needed) — NOT breakdown.categories'
                    // ledger-based spent, and NOT BudgetCategory.spent. totalLocked/amount both
                    // reset to 0 together at rollover (see runRollover() in savings.service.ts),
                    // so totalLocked - amount is an exact, drift-free "spent this cycle" figure
                    // the same way the student's own Dashboard/Budget screens compute it —
                    // guarded against totalLocked === 0 rather than trusting 0/0 falls out safely.
                    const lockedFundRows = (selectedStudent?.wallets[0]?.lockedFunds ?? [])
                      .filter((fund) => fund.category !== 'GENERAL' && fund.category !== 'PERSONAL_SAVINGS')
                      .map((fund) => {
                        const totalLocked = Number(fund.totalLocked);
                        const remaining = Number(fund.amount);
                        const spent = Math.max(totalLocked - remaining, 0);
                        const progress =
                          totalLocked > 0 ? Math.min(Math.max(spent / totalLocked, 0), 1) : 0;
                        return { category: fund.category, totalLocked, remaining, spent, progress };
                      })
                      .filter((row) => row.totalLocked > 0);

                    return lockedFundRows.length > 0 ? (
                      lockedFundRows.map((row) => {
                        const category = categoryLookup.get(
                          row.category.toLowerCase() as BudgetCategoryKey
                        );
                        return (
                          <View key={row.category} style={styles.lockedCard}>
                            <View style={styles.breakdownCategoryHeader}>
                              <IconBadge
                                icon={category?.icon ?? 'wallet-outline'}
                                color={category?.color ?? colors.primary}
                                size={36}
                                iconSize={18}
                              />
                              <Text style={styles.breakdownCategoryLabel}>
                                {category?.label ?? row.category}
                              </Text>
                              <Text style={styles.breakdownCategoryAmount}>
                                ${row.remaining.toFixed(2)}
                              </Text>
                            </View>
                            <View style={styles.progressTrack}>
                              <View
                                style={[
                                  styles.progressFill,
                                  {
                                    width: `${Math.round(row.progress * 100)}%`,
                                    backgroundColor: progressColorFor(row.progress * 100),
                                  },
                                ]}
                              />
                            </View>
                            <Text style={styles.breakdownCategorySpent}>
                              ${row.spent.toFixed(2)} spent of ${row.totalLocked.toFixed(2)}
                            </Text>
                          </View>
                        );
                      })
                    ) : (
                      <Text style={styles.emptySubtitle}>No locked funds yet.</Text>
                    );
                  })()}
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
  statsSectionSpacing: {
    marginTop: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  statIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.heading,
  },
  statLabel: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
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
