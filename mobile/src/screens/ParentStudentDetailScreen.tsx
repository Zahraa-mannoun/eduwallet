import { useCallback, useState } from 'react';
import { ActivityIndicator as RNActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Avatar, IconButton, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { StudentWithdrawalForParent, TransactionCategory } from '../types/api';
import IconBadge from '../components/IconBadge';
import { categoryColors, colors } from '../theme/colors';
import { getInitials } from '../utils/getInitials';
import { RECEIPT_STATUS_META } from '../utils/receiptStatus';
import type { ReceiptBadgeMeta } from '../utils/receiptStatus';
import * as withdrawalService from '../services/withdrawalService';
import { ApiError } from '../services/api';
import type { RootStackScreenProps } from '../navigation/types';

const CATEGORY_META: Record<
  TransactionCategory,
  { icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string }
> = {
  FOOD: { icon: 'food', color: categoryColors.food },
  BOOKS: { icon: 'book-open-variant', color: categoryColors.books },
  TRANSPORT: { icon: 'bus', color: categoryColors.transport },
  SOFTWARE: { icon: 'laptop', color: categoryColors.software },
  TUITION: { icon: 'school', color: categoryColors.tuition },
  LIFESTYLE: { icon: 'shopping-outline', color: categoryColors.lifestyle },
  RENT: { icon: 'home-outline', color: categoryColors.rent },
  PERSONAL_SAVINGS: { icon: 'piggy-bank-outline', color: categoryColors.personalSavings },
  GENERAL: { icon: 'wallet-outline', color: categoryColors.general },
};

// Only statuses that need the parent's attention or an explanation get a note banner — a
// verified receipt speaks for itself via the badge alone.
const RECEIPT_STATUS_NOTE: Partial<Record<StudentWithdrawalForParent['receiptStatus'], string>> = {
  FLAGGED: 'Receipt was flagged — a category mismatch was detected. Admin is reviewing.',
  NOT_UPLOADED: 'Receipt not uploaded yet — please remind your student to upload their receipt',
  PENDING: 'Receipt is pending admin review',
  REJECTED: 'Receipt was rejected by admin. Student should contact support.',
  PROCESSING: 'Receipt is being verified...',
};

function formatDateTime(isoDate: string): string {
  const date = new Date(isoDate);
  const datePart = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  const timePart = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${datePart} at ${timePart}`;
}

function ReceiptBadge({ meta, isProcessing }: Readonly<{ meta: ReceiptBadgeMeta; isProcessing: boolean }>) {
  return (
    <View style={[styles.receiptBadge, { backgroundColor: meta.bg }]}>
      {isProcessing ? (
        <RNActivityIndicator size={11} color={meta.fg} />
      ) : (
        <MaterialCommunityIcons name={meta.icon} size={13} color={meta.fg} />
      )}
      <Text style={[styles.receiptBadgeText, { color: meta.fg }]} numberOfLines={1}>
        {meta.label}
      </Text>
    </View>
  );
}

export default function ParentStudentDetailScreen({
  navigation,
  route,
}: Readonly<RootStackScreenProps<'ParentStudentDetail'>>) {
  const { studentId, studentName, studentEmail } = route.params;

  const [withdrawals, setWithdrawals] = useState<StudentWithdrawalForParent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await withdrawalService.getWithdrawalsForStudent(studentId);
      setWithdrawals(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load this student's withdrawals.");
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const renderWithdrawalItem = (withdrawal: StudentWithdrawalForParent) => {
    const categoryMeta = CATEGORY_META[withdrawal.category];
    // GENERAL withdrawals never require a receipt, so a perpetually-empty receiptStatus of
    // NOT_UPLOADED for them isn't a real problem to flag — only locked-category withdrawals
    // (which the receipt is what proves was spent correctly) show the badge/note at all.
    const receiptRequired = withdrawal.category !== 'GENERAL';
    const receiptMeta = RECEIPT_STATUS_META[withdrawal.receiptStatus];
    const note = receiptRequired ? RECEIPT_STATUS_NOTE[withdrawal.receiptStatus] : undefined;
    const isProcessing = withdrawal.receiptStatus === 'PROCESSING';

    return (
      <View
        key={withdrawal.id}
        style={[styles.card, { borderLeftColor: receiptRequired ? receiptMeta.fg : colors.border }]}
      >
        <View style={styles.cardTopRow}>
          <View style={styles.cardLeft}>
            <IconBadge icon={categoryMeta.icon} color={categoryMeta.color} size={44} />
            <View style={styles.cardTextGroup}>
              <View style={styles.cardCategoryAmountRow}>
                <Text style={styles.amountText}>${Number(withdrawal.amount).toFixed(2)}</Text>
                <Text style={styles.categoryText}>{withdrawal.category}</Text>
              </View>
              <Text style={styles.dateText}>
                {formatDateTime(withdrawal.completedAt ?? withdrawal.createdAt)}
                {withdrawal.agent ? ` · ${withdrawal.agent.fullName}` : ''}
              </Text>
            </View>
          </View>
          {receiptRequired ? <ReceiptBadge meta={receiptMeta} isProcessing={isProcessing} /> : null}
        </View>

        {note ? (
          <View style={[styles.noteBanner, { backgroundColor: `${receiptMeta.fg}1A` }]}>
            <Text style={[styles.noteText, { color: receiptMeta.fg }]}>{note}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} />}
      >
        <View style={styles.profileHeader}>
          <Avatar.Text
            size={64}
            label={getInitials(studentName)}
            style={styles.avatar}
            color={colors.onPrimary}
          />
          <Text variant="titleLarge" style={styles.studentName}>
            {studentName}
          </Text>
          <Text style={styles.studentEmail}>{studentEmail}</Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.sectionLabel}>Cash Withdrawals</Text>
        {isLoading && withdrawals.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : withdrawals.length > 0 ? (
          <View style={styles.list}>{withdrawals.map(renderWithdrawalItem)}</View>
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="cash-remove" size={40} color={colors.muted} />
            <Text style={styles.emptyText}>No cash withdrawals yet</Text>
          </View>
        )}
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
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  profileHeader: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  avatar: {
    backgroundColor: colors.primary,
    marginBottom: 12,
  },
  studentName: {
    fontWeight: '700',
    color: colors.heading,
  },
  studentEmail: {
    color: colors.muted,
    marginTop: 2,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.label,
    marginTop: 4,
    marginBottom: 10,
  },
  loading: {
    marginTop: 24,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 40,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
  },
  list: {
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderLeftWidth: 4,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  cardTextGroup: {
    marginLeft: 12,
    flexShrink: 1,
  },
  cardCategoryAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  amountText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.heading,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    marginLeft: 6,
  },
  dateText: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },
  receiptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    maxWidth: 150,
  },
  receiptBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 5,
    flexShrink: 1,
  },
  noteBanner: {
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 17,
  },
});
