import { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput as NativeTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Checkbox, Snackbar, Text } from 'react-native-paper';
import type { UniversityStudentSummary } from '../types/api';
import { colors } from '../theme/colors';
import * as universityService from '../services/universityService';
import { ApiError } from '../services/api';

const PARTIAL_COLOR = '#F59E0B';
const WILL_BE_FUNDED_COLOR = '#EC4899';

// Per-student, not per-cost — fundingGap already nets out what this specific student's parent
// and institution have covered so far (university.service.ts). Every student rendered here has
// fundingGap > 0 (load() filters out anyone already fully funded — they're only shown, read
// only, in the "Students" bottom tab), so there's no "already fully funded" case to handle.
// - Checked: the typed amount is about to be sent to THIS student, so show what disbursing it
//   would do — pink "Fully funded" (this disbursement would close the gap) or orange "Partial"
//   with what's still short.
// - Unchecked: the typed amount isn't going to this student at all, so show their real,
//   unmodified gap instead of implying money that was never selected for them.
function fundingStatusFor(
  fundingGap: number,
  checked: boolean,
  amount: number
): { label: string; color: string; icon: string } {
  if (checked) {
    const remaining = fundingGap - amount;
    if (remaining <= 0) {
      return { label: 'Fully funded', color: WILL_BE_FUNDED_COLOR, icon: 'check-circle-outline' };
    }
    return {
      label: `Partial — $${remaining.toFixed(2)} still needed`,
      color: PARTIAL_COLOR,
      icon: 'alert-outline',
    };
  }
  return {
    label: `Partial — $${fundingGap.toFixed(2)} still needed`,
    color: PARTIAL_COLOR,
    icon: 'alert-outline',
  };
}

export default function UniversityStudentsTab({
  onProceedToPortal,
}: Readonly<{ onProceedToPortal: () => void }>) {
  const [students, setStudents] = useState<UniversityStudentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await universityService.getVerifiedStudents();
      // Fully-funded students (parent + institution already covering totalCreditCost) have
      // nothing left to disburse — this tab is a funding picker, not a roster, so they're only
      // shown read-only in the "Students" bottom tab instead.
      const fundable = result.filter((student) => Number(student.fundingGap) > 0);
      setStudents(fundable);
      // Anyone no longer in the (already-selected/funded students excluded) list can't stay
      // checked — most commonly because this exact selection just succeeded.
      setSelectedIds((prev) => {
        const stillPresent = new Set(fundable.map((student) => student.id));
        return new Set([...prev].filter((id) => stillPresent.has(id)));
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load university students.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const parsedAmount = Number(amount);
  const canProceed = selectedIds.size > 0 && parsedAmount > 0 && !isSubmitting;

  const handleNotifyAndProceed = async () => {
    if (!canProceed) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await universityService.selectStudents({
        studentIds: [...selectedIds],
        amountPerStudent: parsedAmount,
      });
      setSnackbarMessage(
        `${selectedIds.size} student${selectedIds.size === 1 ? '' : 's'} notified and moved to Scholarship Portal.`
      );
      setSelectedIds(new Set());
      setAmount('');
      await load();
      onProceedToPortal();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not notify and proceed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} />}
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {students.length > 0 ? (
          <Text style={styles.universityHeader}>{students[0].universityName} — Verified Students</Text>
        ) : null}

        <Text style={styles.sectionLabel}>
          Verified Students {selectedIds.size > 0 ? `(${selectedIds.size} selected)` : ''}
        </Text>

        {isLoading && students.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : students.length > 0 ? (
          students.map((student) => {
            const checked = selectedIds.has(student.id);
            const expanded = expandedId === student.id;
            const status = fundingStatusFor(Number(student.fundingGap), checked, parsedAmount);
            return (
              <View key={student.id} style={styles.studentCard}>
                <TouchableOpacity style={styles.studentRow} onPress={() => toggleStudent(student.id)}>
                  <Checkbox
                    status={checked ? 'checked' : 'unchecked'}
                    onPress={() => toggleStudent(student.id)}
                    color={colors.primary}
                  />
                  <View style={styles.studentMiddle}>
                    <Text style={styles.studentName}>{student.fullName}</Text>
                    <Text style={styles.studentSubtitle}>#{student.studentNumber}</Text>
                    <Text style={styles.studentStat}>
                      Total Cost:{' '}
                      <Text style={styles.studentStatValue}>
                        ${Number(student.totalCreditCost).toFixed(2)}
                      </Text>
                      {'  ·  '}Parent:{' '}
                      <Text style={styles.studentStatValue}>
                        ${Number(student.parentSent).toFixed(2)}
                      </Text>
                      {'  ·  '}Institution:{' '}
                      <Text style={styles.studentStatValue}>
                        ${Number(student.received).toFixed(2)}
                      </Text>
                      {'  ·  '}Gap:{' '}
                      <Text style={styles.studentStatValue}>
                        ${Number(student.fundingGap).toFixed(2)}
                      </Text>
                    </Text>
                    <View style={styles.statusRow}>
                      <MaterialCommunityIcons
                        name={status.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                        size={14}
                        color={status.color}
                        style={styles.statusIcon}
                      />
                      <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.expandButton}
                    onPress={() => setExpandedId(expanded ? null : student.id)}
                  >
                    <MaterialCommunityIcons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={22}
                      color={colors.muted}
                    />
                  </TouchableOpacity>
                </TouchableOpacity>

                {expanded ? (
                  <View style={styles.coursesList}>
                    {student.courses.map((course) => (
                      <View key={course.id} style={styles.courseRow}>
                        <Text style={styles.courseName}>{course.courseName}</Text>
                        <Text style={styles.courseCost}>
                          {course.credits} cr · ${Number(course.totalCost).toFixed(2)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No verified students available — everyone eligible is already selected or funded.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.fieldLabel}>Amount per Student ($)</Text>
        <View style={styles.amountContainer}>
          <Text style={styles.currencySymbol}>$</Text>
          <NativeTextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={(text: string) => setAmount(text.replace(/[^0-9.]/g, ''))}
            placeholder="0.00"
            placeholderTextColor={colors.placeholder}
            keyboardType="decimal-pad"
          />
        </View>
        <TouchableOpacity
          style={[styles.proceedButton, !canProceed && styles.proceedButtonDisabled]}
          disabled={!canProceed}
          onPress={() => void handleNotifyAndProceed()}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.onPrimary} size={18} />
          ) : (
            <>
              <Text style={styles.proceedButtonText}>Notify &amp; Proceed</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color={colors.onPrimary} />
            </>
          )}
        </TouchableOpacity>
      </View>

      <Snackbar visible={Boolean(snackbarMessage)} onDismiss={() => setSnackbarMessage(null)} duration={3500}>
        {snackbarMessage}
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
    paddingBottom: 16,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  universityHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.heading,
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.label,
    marginBottom: 10,
  },
  loading: {
    marginTop: 24,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
  },
  emptyText: {
    color: colors.muted,
    textAlign: 'center',
  },
  studentCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  studentMiddle: {
    flex: 1,
    marginLeft: 4,
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
  studentStat: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 8,
  },
  studentStatValue: {
    fontWeight: '700',
    color: colors.heading,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statusIcon: {
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  expandButton: {
    padding: 6,
  },
  coursesList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  courseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  courseName: {
    fontSize: 12,
    color: colors.heading,
    flex: 1,
    marginRight: 8,
  },
  courseCost: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.label,
    marginBottom: 4,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    marginBottom: 10,
  },
  currencySymbol: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.heading,
    marginRight: 4,
  },
  amountInput: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.heading,
    minWidth: 100,
    textAlign: 'center',
    padding: 0,
  },
  proceedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
  },
  proceedButtonDisabled: {
    opacity: 0.5,
  },
  proceedButtonText: {
    color: colors.onPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
});
