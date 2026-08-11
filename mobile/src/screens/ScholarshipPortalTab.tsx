import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Avatar, Button, Chip, Snackbar, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { SelectedStudentSummary, TransactionCategory } from '../types/api';
import CategorySelectorGrid from '../components/CategorySelectorGrid';
import { BUDGET_CATEGORIES } from '../constants/budgetCategories';
import type { BudgetCategoryDefinition, BudgetCategoryKey } from '../constants/budgetCategories';
import { colors } from '../theme/colors';
import { getInitials } from '../utils/getInitials';
import * as universityService from '../services/universityService';
import { ApiError } from '../services/api';

// Tab 2 only ever locks scholarship money to actual academic spending — same restriction
// enforced server-side in university.schema.ts's academicCategoryEnum.
const ACADEMIC_CATEGORY_KEYS: ReadonlySet<BudgetCategoryKey> = new Set(['tuition', 'books', 'software']);
const ACADEMIC_CATEGORIES = BUDGET_CATEGORIES.filter((category) =>
  ACADEMIC_CATEGORY_KEYS.has(category.key)
);

const PARTIAL_COLOR = '#D97706';
const WILL_BE_FUNDED_COLOR = '#EC4899';

// student.amount is what's already selected for this student from Tab 1 — this screen has no
// separate "entered amount" field, so the badge previews what sending that stored amount would
// do to their (received + parentSent - aware) fundingGap.
// - fundingGap === 0: already fully covered before this disbursement — always green.
// - remaining = fundingGap - amount <= 0: this disbursement would close the gap — pink.
// - remaining > 0: still short after this disbursement — orange "Partial".
function fundingBadgeFor(
  fundingGap: number,
  amount: number
): { label: string; color: string; icon: string } {
  if (fundingGap === 0) {
    return { label: 'Fully funded', color: colors.accent, icon: 'check-circle-outline' };
  }
  const remaining = fundingGap - amount;
  if (remaining <= 0) {
    return { label: 'Fully funded', color: WILL_BE_FUNDED_COLOR, icon: 'check-circle-outline' };
  }
  return { label: 'Partial', color: PARTIAL_COLOR, icon: 'alert-outline' };
}

export default function ScholarshipPortalTab() {
  const [students, setStudents] = useState<SelectedStudentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<BudgetCategoryDefinition | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await universityService.getSelectedStudents();
      setStudents(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load the scholarship portal.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const canSend = students.length > 0 && Boolean(category) && !isSending;

  const handleSendDisbursement = async () => {
    if (!category || !canSend) return;
    setIsSending(true);
    setError(null);
    try {
      const result = await universityService.disburseSelected(
        category.key.toUpperCase() as TransactionCategory
      );
      setSnackbarMessage(
        result.disbursedCount > 0
          ? `Disbursement of $${result.totalDisbursed.toFixed(2)} sent to ${result.disbursedCount} student${result.disbursedCount === 1 ? '' : 's'}.`
          : 'Nothing could be sent — check the institution wallet balance and try again.'
      );
      setCategory(null);
      await load();
    } catch (err) {
      setSnackbarMessage(err instanceof ApiError ? err.message : 'Could not send that disbursement.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} />}
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.sectionLabel}>Selected Students ({students.length})</Text>

        {isLoading && students.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : students.length > 0 ? (
          students.map((student) => {
            const badge = fundingBadgeFor(Number(student.fundingGap), Number(student.amount));
            return (
              <View key={student.selectionId} style={styles.studentRow}>
                <Avatar.Text
                  size={36}
                  label={getInitials(student.fullName)}
                  style={styles.studentAvatar}
                  color={colors.onPrimary}
                />
                <View style={styles.studentMiddle}>
                  <Text style={styles.studentName}>{student.fullName}</Text>
                  <Text style={styles.studentSubtitle}>#{student.studentNumber}</Text>
                </View>
                <View style={styles.studentRight}>
                  <Text style={styles.studentAmount}>${Number(student.amount).toFixed(2)}</Text>
                  <Chip
                    compact
                    // Chip's `icon` prop, given a bare string, resolves its color from the
                    // chip's own theme — not from textStyle — which is why the icon didn't
                    // match the label color. A render function lets us force badge.color on
                    // both explicitly.
                    icon={() => (
                      <MaterialCommunityIcons
                        name={badge.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                        size={14}
                        color={badge.color}
                      />
                    )}
                    style={[styles.statusChip, { backgroundColor: `${badge.color}1F` }]}
                    textStyle={{ color: badge.color, fontSize: 10, fontWeight: '700' }}
                  >
                    {badge.label}
                  </Chip>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No students selected yet. Select students in the University Students tab first.
            </Text>
          </View>
        )}

        {students.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Category</Text>
            <CategorySelectorGrid value={category} onChange={setCategory} categories={ACADEMIC_CATEGORIES} />

            <Button
              mode="contained"
              buttonColor={colors.primary}
              icon="send-outline"
              disabled={!canSend}
              loading={isSending}
              style={styles.sendButton}
              contentStyle={styles.sendButtonContent}
              onPress={handleSendDisbursement}
            >
              Send Disbursement
            </Button>
          </>
        ) : null}
      </ScrollView>

      <Snackbar visible={Boolean(snackbarMessage)} onDismiss={() => setSnackbarMessage(null)} duration={3000}>
        {snackbarMessage ?? ''}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
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
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.label,
    marginBottom: 10,
    marginTop: 4,
  },
  loading: {
    marginTop: 24,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 8,
  },
  emptyText: {
    color: colors.muted,
    textAlign: 'center',
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  studentAvatar: {
    backgroundColor: colors.primary,
  },
  studentMiddle: {
    flex: 1,
    marginLeft: 12,
  },
  studentName: {
    fontWeight: '700',
    color: colors.heading,
    fontSize: 14,
  },
  studentSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  studentRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  studentAmount: {
    fontWeight: '700',
    color: colors.heading,
    fontSize: 14,
  },
  statusChip: {
    height: 22,
    marginTop: 4,
    flexShrink: 0,
    minWidth: 96,
  },
  sendButton: {
    borderRadius: 10,
    marginTop: 20,
  },
  sendButtonContent: {
    paddingVertical: 6,
  },
});
