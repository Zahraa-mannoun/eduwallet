import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Avatar, Badge, Button, Chip, IconButton, Text } from 'react-native-paper';
import type { Transaction, TransactionCategory } from '../types/api';
import IconBadge from '../components/IconBadge';
import { BUDGET_CATEGORIES, VISIBLE_BUDGET_CATEGORIES } from '../constants/budgetCategories';
import type { BudgetCategoryDefinition, BudgetCategoryKey } from '../constants/budgetCategories';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { useWallet } from '../context/WalletContext';
import * as kycService from '../services/kycService';
import * as parentalService from '../services/parentalService';
import type { MyPermissions } from '../services/parentalService';
import { colors } from '../theme/colors';
import { getEffectiveKYCStatus } from '../utils/kycStatus';
import { getInitials } from '../utils/getInitials';
import { progressColorFor } from '../utils/progressColor';
import {
  classifyTransaction,
  isCompletedWithdrawal,
  RECEIVED_AMOUNT_COLOR,
  SENT_AMOUNT_COLOR,
  TX_TYPE_META,
  transactionDisplayTitle,
  transactionStatusMeta,
} from '../utils/transactionDisplay';
import { useNotificationRefetch } from '../hooks/useNotificationRefetch';
import type { StudentTabScreenProps } from '../navigation/types';

// This screen deliberately avoids react-native-paper's Card component for section containers
// (see BudgetScreen.tsx for the full story) — its elevation/shadow-driven internals were
// confirmed via live screenshots to break on the web renderer here, so every "card" below is a
// plain View styled with its own shadow instead.

const SCREEN_BACKGROUND = '#F8FAFC';

const categoryLookup = new Map(BUDGET_CATEGORIES.map((category) => [category.key, category]));

function formatShortDate(isoDate: string): string {
  return new Date(isoDate).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type QuickAction = {
  key: string;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
};

export default function DashboardScreen({ navigation }: Readonly<StudentTabScreenProps<'Home'>>) {
  const { user, refreshUser } = useAuth();
  const { unreadCount } = useNotifications();
  const { wallet, lockedFunds, transactions, isLoading, error, refresh } = useWallet();
  const [showBalance, setShowBalance] = useState(true);
  const [myPermissions, setMyPermissions] = useState<MyPermissions | null>(null);
  const [hasKycDocuments, setHasKycDocuments] = useState(false);
  const displayName = user?.fullName || 'Student';

  const loadPermissions = useCallback(async () => {
    try {
      const result = await parentalService.getMyPermissions();
      setMyPermissions(result);
    } catch {
      // Spending Permissions is a supplementary view — leave the previous data in place on failure.
    }
  }, []);

  const loadKycDocuments = useCallback(async () => {
    try {
      const result = await kycService.getMyDocuments();
      setHasKycDocuments(result.length > 0);
    } catch {
      // Verification banner falls back to treating the student as unverified on failure.
    }
  }, []);

  const refreshDashboard = useCallback(() => {
    void refresh();
    void refreshUser();
    void loadPermissions();
    void loadKycDocuments();
  }, [refresh, refreshUser, loadPermissions, loadKycDocuments]);

  // Unthrottled: the home tab's balance/permissions/KYC banner must reflect a card payment,
  // approval, or admin KYC decision (approve/reject) made moments ago the instant the
  // student returns here. refreshUser() is required for the rejection banner specifically —
  // it reads user.kycStatus straight from AuthContext, which nothing else here updates.
  useFocusEffect(
    useCallback(() => {
      refreshDashboard();
    }, [refreshDashboard])
  );

  useNotificationRefetch(refreshDashboard);

  const lockedCategoryRows = lockedFunds
    .filter(
      (fund) =>
        fund.category !== 'GENERAL' &&
        fund.category !== 'PERSONAL_SAVINGS' &&
        Number(fund.amount) > 0
    )
    .map((fund) => ({
      category: categoryLookup.get(fund.category.toLowerCase() as BudgetCategoryKey),
      amount: Number(fund.amount),
      totalLocked: Number(fund.totalLocked),
    }))
    .filter(
      (row): row is { category: BudgetCategoryDefinition; amount: number; totalLocked: number } =>
        row.category !== undefined
    );

  const effectiveKycStatus = user ? getEffectiveKYCStatus(user.kycStatus, hasKycDocuments) : 'UNVERIFIED';

  const totalLocked = lockedCategoryRows.reduce((sum, row) => sum + row.amount, 0);
  const freeToUse = wallet ? Math.max(0, Number(wallet.balance) - totalLocked) : 0;

  const quickActions: QuickAction[] = [
    { key: 'send', label: 'Send', icon: 'arrow-up-circle-outline', onPress: () => navigation.navigate('SendMoney') },
    // Hidden per product decision — kept (not deleted) in case Receive needs to come back.
    // { key: 'receive', label: 'Receive', icon: 'arrow-down-circle-outline', onPress: () => navigation.navigate('ReceiveMoney') },
    // Hidden per product decision — kept (not deleted) in case QR Pay needs to come back.
    // { key: 'qr', label: 'QR Pay', icon: 'qrcode-scan', onPress: () => navigation.navigate('QRPay') },
    { key: 'cards', label: 'Cards', icon: 'credit-card-outline', onPress: () => navigation.navigate('Cards') },
    { key: 'withdraw', label: 'Withdraw', icon: 'cash-multiple', onPress: () => navigation.navigate('Withdrawal') },
  ];

  const balanceLabel = wallet ? `${Number(wallet.balance).toFixed(2)} ${wallet.currency}` : '0.00';
  const approvalThreshold = myPermissions ? Number(myPermissions.approvalThreshold) : 0;

  return (
    <View style={styles.flex}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.userName}>{displayName}</Text>
            </View>
            <View style={styles.headerActions}>
              <View style={styles.bellWrapper}>
                <IconButton
                  icon="bell-outline"
                  iconColor={colors.onPrimary}
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
              <Avatar.Text
                size={44}
                label={getInitials(displayName)}
                style={styles.avatar}
                color={colors.primary}
              />
            </View>
          </View>

          <View style={styles.balanceBlock}>
            <View style={styles.balanceLabelRow}>
              <Text style={styles.balanceLabel}>Available Balance</Text>
              <IconButton
                icon={showBalance ? 'eye-outline' : 'eye-off-outline'}
                iconColor={colors.onPrimary}
                size={18}
                onPress={() => setShowBalance((v) => !v)}
                style={styles.eyeButton}
              />
            </View>
            {isLoading && !wallet ? (
              <ActivityIndicator color={colors.onPrimary} style={styles.balanceLoading} />
            ) : (
              <Text style={styles.balanceValue}>
                {showBalance ? `$${balanceLabel}` : '••••••'}
              </Text>
            )}
          </View>
        </SafeAreaView>

        <View style={styles.headerWave} pointerEvents="none">
          <Svg width="100%" height="22" viewBox="0 0 100 22" preserveAspectRatio="none">
            <Path d="M0,9 C25,20 75,0 100,11 L100,22 L0,22 Z" fill={SCREEN_BACKGROUND} />
          </Svg>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
      >
        {effectiveKycStatus === 'PENDING' && (
          <View style={[styles.kycBanner, styles.kycBannerPending]}>
            <IconBadge icon="clock-outline" color="#F59E0B" size={36} iconSize={20} />
            <Text style={[styles.kycBannerText, styles.kycBannerTextPending]}>
              Your account is pending verification. We will notify you once approved.
            </Text>
          </View>
        )}

        {effectiveKycStatus === 'UNVERIFIED' && (
          <View style={[styles.kycBanner, styles.kycBannerPending]}>
            <IconBadge icon="card-account-details-outline" color="#F59E0B" size={36} iconSize={20} />
            <Text style={[styles.kycBannerText, styles.kycBannerTextPending]}>
              Complete your verification to unlock the full wallet experience.
            </Text>
            <Button
              mode="text"
              compact
              textColor="#92400E"
              onPress={() => navigation.navigate('KYC')}
            >
              Start
            </Button>
          </View>
        )}

        {user?.kycStatus === 'REJECTED' && (
          <View style={[styles.kycBanner, styles.kycBannerRejected]}>
            <IconBadge icon="alert-circle-outline" color={colors.danger} size={36} iconSize={20} />
            <Text style={[styles.kycBannerText, styles.kycBannerTextRejected]}>
              Your verification was rejected. Tap here to resubmit your documents.
            </Text>
            <Button
              mode="text"
              compact
              textColor={colors.danger}
              onPress={() => navigation.navigate('KYC')}
            >
              Retry
            </Button>
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickActionsRow}
        >
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.key}
              style={styles.quickActionCard}
              activeOpacity={0.7}
              onPress={action.onPress}
            >
              <View style={styles.quickActionIconCircle}>
                <MaterialCommunityIcons name={action.icon} size={22} color={colors.primary} />
              </View>
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {wallet ? (
          <>
            <Text style={[styles.sectionTitle, styles.balanceBreakdownTitle]}>Balance Breakdown</Text>

            <View style={[styles.breakdownItemCard, styles.freeToUseCard]}>
              <View style={styles.breakdownItemHeader}>
                <IconBadge icon="wallet-outline" color={colors.accent} size={44} />
                <View style={styles.breakdownMiddle}>
                  <Text style={styles.breakdownLabel}>Free to use</Text>
                  <Text style={styles.breakdownSublabel}>No spending restrictions</Text>
                </View>
                <Text style={styles.breakdownAmount}>${freeToUse.toFixed(2)}</Text>
              </View>
            </View>

            {lockedCategoryRows.map(({ category, amount, totalLocked: categoryTotal }) => {
              // totalLocked resets to 0 alongside amount at every rollover (see runRollover()
              // in savings.service.ts), so this subtraction is an exact "spent this cycle"
              // figure with no drift — every lock increments both fields equally, only a spend
              // decrements `amount`, and rollover resets both together.
              const spent = Math.max(categoryTotal - amount, 0);
              const percent = categoryTotal > 0 ? Math.min(Math.round((spent / categoryTotal) * 100), 100) : 0;
              return (
                <View key={category.key} style={styles.breakdownItemCard}>
                  <View style={styles.breakdownItemHeader}>
                    <IconBadge icon={category.icon} color={category.color} size={44} />
                    <View style={styles.breakdownMiddle}>
                      <Text style={styles.breakdownLabel}>{category.label}</Text>
                      <Text style={styles.breakdownSublabel}>Locked funds</Text>
                    </View>
                    <Text style={styles.breakdownAmount}>${amount.toFixed(2)}</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${percent}%`, backgroundColor: progressColorFor(percent) },
                      ]}
                    />
                  </View>
                  <Text style={styles.breakdownSpentText}>
                    ${spent.toFixed(2)} spent of ${categoryTotal.toFixed(2)}
                  </Text>
                </View>
              );
            })}
          </>
        ) : null}

        {myPermissions ? (
          <>
            <Text style={styles.sectionTitle}>Spending Permissions</Text>
            <View style={styles.sectionCard}>
              <View style={styles.permissionsGrid}>
                {VISIBLE_BUDGET_CATEGORIES.filter((category) => category.key !== 'general').map(
                  (category) => {
                    const txCategory = category.key.toUpperCase() as TransactionCategory;
                    const isAllowed = myPermissions.allowedCategories.includes(txCategory);
                    return (
                      <View
                        key={category.key}
                        style={[
                          styles.permissionPill,
                          isAllowed
                            ? { backgroundColor: `${category.color}1F`, borderColor: category.color }
                            : styles.permissionPillBlocked,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={isAllowed ? 'check' : 'close'}
                          size={13}
                          color={isAllowed ? category.color : colors.muted}
                        />
                        <Text
                          style={[
                            styles.permissionPillText,
                            { color: isAllowed ? category.color : colors.muted },
                            !isAllowed && styles.permissionPillTextBlocked,
                          ]}
                        >
                          {category.label}
                        </Text>
                      </View>
                    );
                  }
                )}
              </View>

              {approvalThreshold > 0 ? (
                <View style={[styles.approvalBadge, styles.approvalBadgeBlue]}>
                  <MaterialCommunityIcons name="flash-outline" size={14} color={colors.primary} />
                  <Text style={styles.approvalBadgeText}>
                    ${approvalThreshold.toFixed(0)} approval limit
                  </Text>
                </View>
              ) : (
                <View style={[styles.approvalBadge, styles.approvalBadgeGreen]}>
                  <MaterialCommunityIcons name="check-circle" size={14} color={colors.accent} />
                  <Text style={styles.approvalBadgeText}>No approval limit</Text>
                </View>
              )}
            </View>
          </>
        ) : null}

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <Button
            mode="text"
            compact
            textColor={colors.primary}
            onPress={() => navigation.navigate('TransactionHistory')}
          >
            See All
          </Button>
        </View>
        <View style={styles.sectionCard}>
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : transactions.length > 0 ? (
            transactions.map((transaction: Transaction) => {
              const category = categoryLookup.get(transaction.category.toLowerCase() as BudgetCategoryKey);
              const isReceived = wallet !== null && transaction.toWalletId === wallet.id;
              const type = classifyTransaction(transaction, isReceived);
              const typeMeta = TX_TYPE_META[type];
              const badge = transactionStatusMeta(transaction, type);
              // A withdrawal awaiting parent/agent action has no real Transaction row yet —
              // there's nothing for TransactionDetail to look up, so route to the Withdrawal
              // screen instead, where it's already listed with full detail.
              const isPendingWithdrawal = type === 'WITHDRAWAL' && !isCompletedWithdrawal(transaction);
              return (
                <TouchableOpacity
                  key={transaction.id}
                  style={styles.transactionRow}
                  onPress={() =>
                    isPendingWithdrawal
                      ? navigation.navigate('Withdrawal')
                      : navigation.navigate('TransactionDetail', { transactionId: transaction.id })
                  }
                >
                  <View style={[styles.transactionIconCircle, { backgroundColor: `${typeMeta.color}1F` }]}>
                    <MaterialCommunityIcons name={typeMeta.icon} size={18} color={typeMeta.color} />
                  </View>
                  <View style={styles.transactionMiddle}>
                    <Text style={styles.transactionTitle} numberOfLines={1}>
                      {transactionDisplayTitle(transaction, type)}
                    </Text>
                    <Text style={styles.transactionSubtitle}>
                      {category?.label ?? 'Other'} • {formatShortDate(transaction.createdAt)}
                    </Text>
                  </View>
                  <View style={styles.transactionRight}>
                    <Text
                      style={[
                        styles.transactionAmount,
                        { color: isReceived ? RECEIVED_AMOUNT_COLOR : SENT_AMOUNT_COLOR },
                      ]}
                    >
                      {isReceived ? '+' : '-'}${Number(transaction.amount).toFixed(2)}
                    </Text>
                    <Chip
                      compact
                      style={[styles.statusChip, { backgroundColor: badge.bg }]}
                      textStyle={{
                        color: badge.fg,
                        fontSize: 10,
                        fontWeight: '700',
                        textAlign: 'center',
                      }}
                    >
                      {badge.label}
                    </Chip>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <MaterialCommunityIcons name="receipt-text-outline" size={36} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No transactions yet</Text>
              <Text style={styles.emptySubtitle}>
                Your recent activity will show up here once you start using your wallet.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: SCREEN_BACKGROUND,
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  headerWave: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  greeting: {
    color: '#DBEAFE',
    fontSize: 14,
  },
  userName: {
    color: colors.onPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  avatar: {
    backgroundColor: colors.onPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bellWrapper: {
    marginRight: 4,
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
  balanceBlock: {
    marginTop: 28,
  },
  balanceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
  eyeButton: {
    margin: 0,
    marginLeft: 2,
  },
  balanceValue: {
    color: colors.onPrimary,
    fontSize: 32,
    fontWeight: '800',
    marginTop: 4,
  },
  balanceLoading: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 32,
  },
  kycBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  kycBannerPending: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  kycBannerRejected: {
    backgroundColor: '#FEE2E2',
    borderColor: colors.danger,
  },
  kycBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 12,
  },
  kycBannerTextPending: {
    color: '#92400E',
  },
  kycBannerTextRejected: {
    color: colors.danger,
  },
  quickActionsRow: {
    paddingBottom: 4,
    marginBottom: 24,
  },
  quickActionCard: {
    width: 76,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  quickActionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${colors.primary}1F`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 12,
    color: colors.heading,
    fontWeight: '700',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.heading,
    marginBottom: 10,
  },
  balanceBreakdownTitle: {
    marginTop: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  breakdownItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  freeToUseCard: {
    backgroundColor: `${colors.accent}14`,
  },
  breakdownItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breakdownMiddle: {
    flex: 1,
    marginLeft: 12,
  },
  breakdownLabel: {
    fontWeight: '700',
    color: colors.heading,
    fontSize: 14,
  },
  breakdownSublabel: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  breakdownAmount: {
    fontWeight: '700',
    fontSize: 14,
    color: colors.primary,
  },
  breakdownSpentText: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 8,
  },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    marginTop: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  permissionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  permissionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  permissionPillBlocked: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  permissionPillText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 5,
  },
  permissionPillTextBlocked: {
    textDecorationLine: 'line-through',
  },
  approvalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  approvalBadgeGreen: {
    backgroundColor: `${colors.accent}1F`,
  },
  approvalBadgeBlue: {
    backgroundColor: `${colors.primary}1F`,
  },
  approvalBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.heading,
    marginLeft: 6,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  transactionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionMiddle: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  transactionTitle: {
    fontWeight: '700',
    color: colors.heading,
    fontSize: 14,
  },
  transactionSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  transactionRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontWeight: '700',
    fontSize: 14,
  },
  statusChip: {
    height: 22,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: `${colors.primary}1A`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontWeight: '700',
    color: colors.heading,
    marginBottom: 6,
  },
  emptySubtitle: {
    color: colors.muted,
    textAlign: 'center',
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    paddingVertical: 16,
  },
});
