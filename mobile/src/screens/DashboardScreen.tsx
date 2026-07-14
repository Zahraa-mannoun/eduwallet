import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Avatar, Badge, Button, Card, IconButton, Text } from 'react-native-paper';
import type { Transaction } from '../types/api';
import IconBadge from '../components/IconBadge';
import { BUDGET_CATEGORIES } from '../constants/budgetCategories';
import type { BudgetCategoryKey } from '../constants/budgetCategories';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { useWallet } from '../context/WalletContext';
import { colors } from '../theme/colors';
import { getInitials } from '../utils/getInitials';
import type { StudentTabScreenProps } from '../navigation/types';

const categoryLookup = new Map(BUDGET_CATEGORIES.map((category) => [category.key, category]));

function transactionTitle(transaction: Transaction): string {
  if (transaction.note) return transaction.note;
  if (!transaction.fromWalletId) return 'Wallet Top-up';
  const category = categoryLookup.get(transaction.category.toLowerCase() as BudgetCategoryKey);
  return category?.label ?? 'Transfer';
}

function transactionSubtitle(transaction: Transaction): string {
  if (transaction.status === 'PENDING') return 'Awaiting parent approval';
  if (transaction.status === 'REJECTED') return 'Rejected';
  return new Date(transaction.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

type QuickAction = {
  key: string;
  label: string;
  icon: string;
  onPress: () => void;
};

export default function DashboardScreen({ navigation }: StudentTabScreenProps<'Home'>) {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const { wallet, transactions, isLoading, error, refresh } = useWallet();
  const [showBalance, setShowBalance] = useState(true);
  const displayName = user?.fullName || 'Student';

  const quickActions: QuickAction[] = [
    { key: 'send', label: 'Send', icon: 'arrow-up-circle-outline', onPress: () => navigation.navigate('SendMoney') },
    { key: 'receive', label: 'Receive', icon: 'arrow-down-circle-outline', onPress: () => navigation.navigate('ReceiveMoney') },
    { key: 'qr', label: 'QR Pay', icon: 'qrcode-scan', onPress: () => navigation.navigate('QRPay') },
    { key: 'cards', label: 'Cards', icon: 'credit-card-outline', onPress: () => navigation.navigate('Cards') },
  ];

  const balanceLabel = wallet ? `${Number(wallet.balance).toFixed(2)} ${wallet.currency}` : '0.00';

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
      </LinearGradient>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
      >
        <View style={styles.quickActionsRow}>
          {quickActions.map((action) => (
            <View key={action.key} style={styles.quickAction}>
              <IconButton
                icon={action.icon}
                mode="contained"
                containerColor={colors.surface}
                iconColor={colors.primary}
                size={26}
                onPress={action.onPress}
              />
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </View>
          ))}
        </View>

        <Card style={styles.transactionsCard} mode="elevated">
          <Card.Content>
            <View style={styles.transactionsHeader}>
              <Text variant="titleMedium" style={styles.transactionsTitle}>
                Recent Transactions
              </Text>
              <Button
                mode="text"
                compact
                textColor={colors.primary}
                onPress={() => navigation.navigate('TransactionHistory')}
              >
                See All
              </Button>
            </View>

            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : transactions.length > 0 ? (
              transactions.map((transaction) => {
                const category = categoryLookup.get(transaction.category.toLowerCase() as BudgetCategoryKey);
                const isReceived = wallet !== null && transaction.toWalletId === wallet.id;
                return (
                  <TouchableOpacity
                    key={transaction.id}
                    style={styles.transactionRow}
                    onPress={() =>
                      navigation.navigate('TransactionDetail', { transactionId: transaction.id })
                    }
                  >
                    <IconBadge
                      icon={category?.icon ?? 'wallet-outline'}
                      color={category?.color ?? colors.primary}
                      size={40}
                    />
                    <View style={styles.transactionMiddle}>
                      <Text style={styles.transactionTitle}>{transactionTitle(transaction)}</Text>
                      <Text style={styles.transactionSubtitle}>{transactionSubtitle(transaction)}</Text>
                    </View>
                    <Text
                      style={[
                        styles.transactionAmount,
                        { color: isReceived ? colors.accent : colors.heading },
                      ]}
                    >
                      {isReceived ? '+' : '-'}${Number(transaction.amount).toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <Avatar.Icon
                  icon="receipt-text-outline"
                  size={56}
                  style={styles.emptyIcon}
                  color={colors.primary}
                />
                <Text style={styles.emptyTitle}>No transactions yet</Text>
                <Text style={styles.emptySubtitle}>
                  Your recent activity will show up here once you start using your wallet.
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  greeting: {
    color: 'rgba(255,255,255,0.8)',
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
    fontSize: 40,
    fontWeight: '800',
    marginTop: 4,
  },
  balanceLoading: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  quickAction: {
    alignItems: 'center',
    width: 72,
  },
  quickActionLabel: {
    fontSize: 12,
    color: colors.label,
    fontWeight: '600',
    marginTop: -4,
  },
  transactionsCard: {
    borderRadius: 16,
  },
  transactionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  transactionsTitle: {
    fontWeight: '700',
    color: colors.heading,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  transactionMiddle: {
    flex: 1,
    marginLeft: 12,
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
  transactionAmount: {
    fontWeight: '700',
    fontSize: 14,
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
    textAlign: 'center',
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    paddingVertical: 16,
  },
});
