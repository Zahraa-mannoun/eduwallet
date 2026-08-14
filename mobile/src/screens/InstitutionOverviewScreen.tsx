import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Text } from 'react-native-paper';
import type { UniversityStudentSummary } from '../types/api';
import { BUDGET_CATEGORIES } from '../constants/budgetCategories';
import { colors } from '../theme/colors';
import * as universityService from '../services/universityService';
import * as walletService from '../services/walletService';
import { ApiError } from '../services/api';
import type { InstitutionTabScreenProps } from '../navigation/types';

const SCREEN_BACKGROUND = '#F8FAFC';

const PARTIAL_COLOR = '#F59E0B';
const NO_COVERAGE_COLOR = '#EF4444';

type DashboardStats = {
  totalDisbursed: number;
  studentsFunded: number;
  thisMonth: number;
  walletBalance: number;
};

const STAT_CARDS: ReadonlyArray<{ key: keyof DashboardStats; label: string; color: string }> = [
  { key: 'totalDisbursed', label: 'Total Disbursed', color: colors.primary },
  { key: 'studentsFunded', label: 'Students Funded', color: colors.accent },
  { key: 'thisMonth', label: 'This Month', color: '#8B5CF6' },
  { key: 'walletBalance', label: 'Wallet Balance', color: '#0D9488' },
];

function formatStatValue(key: keyof DashboardStats, value: number): string {
  return key === 'studentsFunded' ? String(value) : `$${value.toFixed(2)}`;
}

type CoverageBucket = 'full' | 'partial' | 'none';

// Same classification InstitutionStudentsScreen.tsx uses for its per-student badge, just
// aggregated into counts instead of rendered per row.
function coverageBucketFor(student: UniversityStudentSummary): CoverageBucket {
  if (Number(student.fundingGap) <= 0) return 'full';
  if (Number(student.parentSent) === 0 && Number(student.received) === 0) return 'none';
  return 'partial';
}

type DisbursementItem = {
  id: string;
  text: string;
  createdAt: string;
};

function categoryLabel(category: string): string {
  return BUDGET_CATEGORIES.find((definition) => definition.key === category.toLowerCase())?.label ?? category;
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  const diffMonths = Math.round(diffDays / 30);
  return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
}

function CoverageRow({
  color,
  label,
  count,
  last,
}: Readonly<{ color: string; label: string; count: number; last?: boolean }>) {
  return (
    <View style={[styles.coverageRow, last && styles.coverageRowLast]}>
      <View style={styles.coverageLeft}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.coverageLabel}>{label}</Text>
      </View>
      <View style={[styles.countBadge, { backgroundColor: `${color}1A` }]}>
        <Text style={[styles.countBadgeText, { color }]}>{count}</Text>
      </View>
    </View>
  );
}

export default function InstitutionOverviewScreen({
  navigation,
}: Readonly<InstitutionTabScreenProps<'Overview'>>) {
  const [institutionName, setInstitutionName] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [coverage, setCoverage] = useState<Record<CoverageBucket, number> | null>(null);
  const [recent, setRecent] = useState<DisbursementItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [students, wallet, transactionsPage] = await Promise.all([
        universityService.getAllStudents(),
        walletService.getWallet(),
        // A single generous page is enough for this demo-scale dataset — there's no dedicated
        // institution disbursement-history endpoint to page through instead.
        walletService.getTransactions({ limit: 100 }),
      ]);

      if (students.length > 0) {
        setInstitutionName(students[0].universityName);
      }

      const totalDisbursed = students.reduce((sum, student) => sum + Number(student.received), 0);
      const studentsFunded = students.filter((student) => Number(student.received) > 0).length;

      const outgoing = transactionsPage.transactions
        .filter((tx) => tx.fromWalletId === wallet.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const now = new Date();
      const thisMonth = outgoing
        .filter((tx) => {
          const txDate = new Date(tx.createdAt);
          return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
        })
        .reduce((sum, tx) => sum + Number(tx.amount), 0);

      setStats({
        totalDisbursed,
        studentsFunded,
        thisMonth,
        walletBalance: Number(wallet.balance),
      });

      const buckets: Record<CoverageBucket, number> = { full: 0, partial: 0, none: 0 };
      for (const student of students) {
        buckets[coverageBucketFor(student)] += 1;
      }
      setCoverage(buckets);

      setRecent(
        outgoing.slice(0, 5).map((tx) => ({
          id: tx.id,
          text: `Funded ${tx.receiverName ?? 'a student'} $${Number(tx.amount).toFixed(2)} · ${categoryLabel(tx.category)}`,
          createdAt: tx.createdAt,
        }))
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load overview.');
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
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} />}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Overview</Text>
          {institutionName ? <Text style={styles.headerSubtitle}>{institutionName}</Text> : null}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.statsGrid}>
          {STAT_CARDS.map((card) => (
            <View key={card.key} style={[styles.statCard, { borderLeftColor: card.color }]}>
              <Text style={styles.statLabel}>{card.label}</Text>
              <Text style={styles.statValue}>
                {stats ? formatStatValue(card.key, stats[card.key]) : '—'}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Funding Coverage</Text>
        <View style={styles.card}>
          <CoverageRow color={colors.accent} label="Fully Funded" count={coverage?.full ?? 0} />
          <CoverageRow color={PARTIAL_COLOR} label="Partially Covered" count={coverage?.partial ?? 0} />
          <CoverageRow
            color={NO_COVERAGE_COLOR}
            label="No Coverage"
            count={coverage?.none ?? 0}
            last
          />
        </View>

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Recent Disbursements</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Students')}>
            <Text style={styles.viewAllLink}>View all →</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          {isLoading && recent.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={styles.loading} />
          ) : recent.length > 0 ? (
            recent.map((item, index) => (
              <View
                key={item.id}
                style={[styles.disbursementRow, index === recent.length - 1 && styles.disbursementRowLast]}
              >
                <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                <Text style={styles.disbursementText} numberOfLines={2}>
                  {item.text}
                </Text>
                <Text style={styles.disbursementTime}>{formatRelativeTime(item.createdAt)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No disbursements yet.</Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={styles.actionOutlined}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Portal', { initialTab: 'individual' })}
          >
            <MaterialCommunityIcons name="account-cash-outline" size={20} color={colors.primary} />
            <Text style={styles.actionOutlinedText}>Fund a Student</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionFilled}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Portal', { initialTab: 'students' })}
          >
            <MaterialCommunityIcons name="school-outline" size={20} color={colors.onPrimary} />
            <Text style={styles.actionFilledText}>Bulk Scholarship</Text>
          </TouchableOpacity>
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
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.heading,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 2,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderLeftWidth: 3,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.heading,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.heading,
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 10,
  },
  viewAllLink: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  coverageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  coverageRowLast: {
    borderBottomWidth: 0,
  },
  coverageLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  coverageLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.heading,
  },
  countBadge: {
    minWidth: 28,
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  loading: {
    paddingVertical: 20,
  },
  emptyText: {
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: 24,
    fontSize: 13,
  },
  disbursementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  disbursementRowLast: {
    borderBottomWidth: 0,
  },
  disbursementText: {
    flex: 1,
    fontSize: 12.5,
    color: colors.heading,
    lineHeight: 17,
  },
  disbursementTime: {
    fontSize: 11,
    color: colors.muted,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionOutlined: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
  },
  actionOutlinedText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  actionFilled: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  actionFilledText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});
