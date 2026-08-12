import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Avatar, Chip, IconButton, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { StudentWithdrawalForParent } from '../types/api';
import { colors } from '../theme/colors';
import { getInitials } from '../utils/getInitials';
import * as withdrawalService from '../services/withdrawalService';
import { ApiError } from '../services/api';
import type { RootStackScreenProps } from '../navigation/types';

const STATUS_META: Record<StudentWithdrawalForParent['status'], { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: colors.muted },
  PENDING_PARENT_APPROVAL: { label: 'Awaiting Approval', color: '#F59E0B' },
  APPROVED: { label: 'Approved', color: colors.primary },
  REJECTED: { label: 'Rejected', color: colors.danger },
  COMPLETED: { label: 'Completed', color: colors.accent },
};

const RECEIPT_STATUS_META: Record<
  StudentWithdrawalForParent['receiptStatus'],
  { label: string; emoji: string; color: string }
> = {
  PROCESSING: { label: 'Processing', emoji: '⏳', color: colors.primary },
  AUTO_VERIFIED: { label: 'Auto-verified', emoji: '✅', color: colors.accent },
  MANUALLY_VERIFIED: { label: 'Verified', emoji: '✅', color: colors.accent },
  PENDING: { label: 'Pending review', emoji: '🕐', color: '#F59E0B' },
  FLAGGED: { label: 'Flagged', emoji: '⚠️', color: colors.danger },
  REJECTED: { label: 'Rejected', emoji: '❌', color: colors.danger },
  NOT_UPLOADED: { label: 'Not uploaded', emoji: '❌', color: colors.danger },
};

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
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
    const statusMeta = STATUS_META[withdrawal.status];
    const receiptMeta = RECEIPT_STATUS_META[withdrawal.receiptStatus];
    // GENERAL withdrawals never require a receipt, so a perpetually-empty receiptStatus of
    // NOT_UPLOADED for them isn't a real problem to flag — only locked-category withdrawals
    // (which the receipt is what proves was spent correctly) show the status row/warning.
    const receiptRequired = withdrawal.category !== 'GENERAL';
    const needsAttention =
      receiptRequired &&
      (withdrawal.receiptStatus === 'NOT_UPLOADED' || withdrawal.receiptStatus === 'FLAGGED');

    return (
      <View key={withdrawal.id} style={styles.row}>
        <View style={styles.rowTop}>
          <View style={styles.rowMiddle}>
            <Text style={styles.rowTitle}>
              ${Number(withdrawal.amount).toFixed(2)} · {withdrawal.category}
            </Text>
            <Text style={styles.rowDate}>
              {formatDate(withdrawal.completedAt ?? withdrawal.createdAt)}
              {withdrawal.agent ? ` · ${withdrawal.agent.fullName}` : ''}
            </Text>
          </View>
          <Chip
            compact
            style={[styles.statusChip, { backgroundColor: `${statusMeta.color}1F` }]}
            textStyle={{ color: statusMeta.color, fontSize: 11, fontWeight: '700' }}
          >
            {statusMeta.label}
          </Chip>
        </View>

        {receiptRequired ? (
          <View style={styles.receiptStatusRow}>
            <Text style={styles.receiptEmoji}>{receiptMeta.emoji}</Text>
            <Text style={[styles.receiptStatusText, { color: receiptMeta.color }]}>
              {receiptMeta.label}
            </Text>
          </View>
        ) : null}

        {needsAttention ? (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              Receipt not verified — please remind your student to upload their receipt
            </Text>
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
  row: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rowMiddle: {
    flex: 1,
    marginRight: 8,
  },
  rowTitle: {
    fontWeight: '700',
    color: colors.heading,
    fontSize: 13,
  },
  rowDate: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
  },
  statusChip: {
    height: 24,
  },
  receiptStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  receiptEmoji: {
    fontSize: 13,
    marginRight: 6,
  },
  receiptStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  warningBanner: {
    backgroundColor: `${colors.danger}1F`,
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  warningText: {
    fontSize: 12,
    color: colors.danger,
    lineHeight: 17,
  },
});
