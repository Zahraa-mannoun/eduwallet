import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, IconButton, Text } from 'react-native-paper';
import IconBadge from '../components/IconBadge';
import { colors } from '../theme/colors';
import * as walletService from '../services/walletService';
import { ApiError } from '../services/api';
import type { RootStackScreenProps } from '../navigation/types';

export default function InstitutionWalletScreen({
  navigation,
}: Readonly<RootStackScreenProps<'InstitutionWallet'>>) {
  const [balance, setBalance] = useState<string | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const wallet = await walletService.getWallet();
      setBalance(wallet.balance);
      setCurrency(wallet.currency);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load your wallet balance.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
        <Text variant="titleLarge" style={styles.headerTitle}>
          My Wallet
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} />}
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.balanceCard}>
          <IconBadge icon="wallet-outline" color={colors.primary} size={56} iconSize={28} />
          <Text style={styles.balanceLabel}>Available Balance</Text>
          {isLoading && balance === null ? (
            <ActivityIndicator color={colors.primary} style={styles.loading} />
          ) : (
            <Text style={styles.balanceValue}>
              ${Number(balance ?? 0).toFixed(2)} <Text style={styles.currency}>{currency}</Text>
            </Text>
          )}
          <Text style={styles.hintText}>
            This is the balance available to disburse to students across all 3 funding tabs.
          </Text>
        </View>
      </ScrollView>
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
    paddingTop: 16,
    paddingBottom: 32,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  balanceCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 12,
  },
  loading: {
    marginTop: 12,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.heading,
    marginTop: 6,
  },
  currency: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.muted,
  },
  hintText: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
});
