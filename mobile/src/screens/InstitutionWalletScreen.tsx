import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, IconButton, Text } from 'react-native-paper';
import { colors } from '../theme/colors';
import * as walletService from '../services/walletService';
import * as universityService from '../services/universityService';
import { ApiError } from '../services/api';
import type { RootStackScreenProps } from '../navigation/types';

const SCREEN_BACKGROUND = '#F8FAFC';

// Distinct from the app's usual navy send-button gradient (colors.gradientStart/End) — a
// dedicated blue-to-indigo gradient makes the balance card read as this screen's own centerpiece
// rather than just another button, same reasoning PersonalSavingsScreen's green gradient uses.
const BALANCE_GRADIENT: [string, string] = ['#2E5FAC', '#4F46E5'];

export default function InstitutionWalletScreen({
  navigation,
}: Readonly<RootStackScreenProps<'InstitutionWallet'>>) {
  const [balance, setBalance] = useState<string | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [wallet, students] = await Promise.all([
        walletService.getWallet(),
        universityService.getAllStudents(),
      ]);
      setBalance(wallet.balance);
      setCurrency(wallet.currency);
      setStudentCount(students.length);
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
        <Text style={styles.headerTitle}>My Wallet</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} />}
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <LinearGradient
          colors={BALANCE_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <View style={styles.balanceIconCircle}>
            <MaterialCommunityIcons name="wallet-outline" size={26} color="#FFFFFF" />
          </View>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          {isLoading && balance === null ? (
            <ActivityIndicator color="#FFFFFF" style={styles.loading} />
          ) : (
            <View style={styles.balanceRow}>
              <Text style={styles.balanceValue}>${Number(balance ?? 0).toFixed(2)}</Text>
              <View style={styles.currencyBadge}>
                <Text style={styles.currencyBadgeText}>{currency}</Text>
              </View>
            </View>
          )}
          <Text style={styles.hintText}>
            Available to disburse to students across all 3 funding tabs
          </Text>
        </LinearGradient>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="view-grid-outline" size={20} color={colors.primary} />
            <Text style={styles.statValue}>3</Text>
            <Text style={styles.statLabel}>Funding Tabs</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="account-group-outline" size={20} color={colors.primary} />
            <Text style={styles.statValue}>{studentCount ?? '—'}</Text>
            <Text style={styles.statLabel}>Students Enrolled</Text>
          </View>
        </View>
      </ScrollView>
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
    fontSize: 18,
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
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  balanceIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  loading: {
    marginTop: 12,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  balanceValue: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  currencyBadge: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  currencyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  hintText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.heading,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
});
