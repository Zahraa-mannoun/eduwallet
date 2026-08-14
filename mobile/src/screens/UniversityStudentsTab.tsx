import { useCallback, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput as NativeTextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Checkbox, Snackbar, Text } from 'react-native-paper';
import type { UniversityStudentSummary } from '../types/api';
import FundingBreakdownRow from '../components/FundingBreakdownRow';
import StatusDotBadge from '../components/StatusDotBadge';
import { colors } from '../theme/colors';
import * as universityService from '../services/universityService';
import { ApiError } from '../services/api';
import { useNotificationRefetch } from '../hooks/useNotificationRefetch';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PARTIAL_COLOR = '#F59E0B';
const WILL_BE_FUNDED_COLOR = '#EC4899';
// A lighter blue-to-blue gradient than the app's usual navy send-button gradient
// (colors.gradientStart/End) — keeps this button reading as "enabled and ready", not the
// same visual weight as an auth-flow submit button.
const PROCEED_GRADIENT: [string, string] = ['#2E5FAC', '#4a7fd4'];
const NO_COVERAGE_COLOR = '#EF4444';

// Per-student, not per-cost — fundingGap already nets out what this specific student's parent
// and institution have covered so far (university.service.ts). In practice every student
// rendered here has fundingGap > 0 (load() filters out anyone already fully funded — they're
// only shown, read only, in the "Students" bottom tab), but the fundingGap <= 0 branch is kept
// so this function stays correct on its own even if that upstream filter ever changes.
// - fundingGap <= 0: parent + institution already cover the full cost — always green, no
//   matter what's checked/typed.
// - Checked: the typed amount is about to be sent to THIS student, so show what disbursing it
//   would do — pink "Fully funded" (this disbursement would close the gap) or amber "Partial"
//   with what's still short.
// - Unchecked: the typed amount isn't going to this student at all. Red "No coverage" if
//   neither the parent nor the institution has sent anything yet, amber "Partially covered" if
//   one of them has but a gap remains — distinguishing "nobody's started" from "still short".
function fundingStatusFor(
  fundingGap: number,
  checked: boolean,
  amount: number,
  parentSent: number,
  received: number
): { label: string; color: string } {
  if (fundingGap <= 0) {
    return { label: 'Fully Funded', color: colors.accent };
  }
  if (checked) {
    const remaining = fundingGap - amount;
    if (remaining <= 0) {
      return { label: 'Fully Funded', color: WILL_BE_FUNDED_COLOR };
    }
    return { label: `Partial — $${remaining.toFixed(2)} still needed`, color: PARTIAL_COLOR };
  }
  if (parentSent === 0 && received === 0) {
    return { label: 'No Coverage', color: NO_COVERAGE_COLOR };
  }
  return { label: 'Partially Covered', color: PARTIAL_COLOR };
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
  const [isAmountFocused, setIsAmountFocused] = useState(false);
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

  useNotificationRefetch(load);

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

  const toggleExpanded = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((current) => (current === id ? null : id));
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
          <View style={styles.universityHeaderRow}>
            <MaterialCommunityIcons name="school-outline" size={18} color={colors.primary} />
            <Text style={styles.universityHeader}>
              {students[0].universityName} — Verified Students
            </Text>
          </View>
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
            const status = fundingStatusFor(
              Number(student.fundingGap),
              checked,
              parsedAmount,
              Number(student.parentSent),
              Number(student.received)
            );
            return (
              <View key={student.id} style={[styles.studentCard, checked && styles.studentCardChecked]}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.studentRow}
                  onPress={() => toggleStudent(student.id)}
                >
                  <Checkbox
                    status={checked ? 'checked' : 'unchecked'}
                    onPress={() => toggleStudent(student.id)}
                    color={colors.primary}
                  />
                  <View style={styles.studentMiddle}>
                    <Text style={styles.studentName}>{student.fullName}</Text>
                    <Text style={styles.studentSubtitle}>#{student.studentNumber}</Text>

                    <FundingBreakdownRow
                      totalCost={Number(student.totalCreditCost)}
                      parentSent={Number(student.parentSent)}
                      institutionSent={Number(student.received)}
                      gap={Number(student.fundingGap)}
                    />

                    <StatusDotBadge label={status.label} color={status.color} style={styles.statusBadge} />
                  </View>
                  <TouchableOpacity
                    style={styles.expandButton}
                    onPress={() => toggleExpanded(student.id)}
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
            <MaterialCommunityIcons name="account-school-outline" size={40} color={colors.border} />
            <Text style={styles.emptyText}>
              No verified students available — everyone eligible is already selected or funded.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.fieldLabel}>Amount per Student</Text>
        <View style={[styles.amountContainer, isAmountFocused && styles.amountContainerFocused]}>
          <Text style={styles.currencySymbol}>$</Text>
          <NativeTextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={(text: string) => setAmount(text.replace(/[^0-9.]/g, ''))}
            onFocus={() => setIsAmountFocused(true)}
            onBlur={() => setIsAmountFocused(false)}
            placeholder="0.00"
            placeholderTextColor={colors.placeholder}
            keyboardType="decimal-pad"
          />
        </View>
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!canProceed}
          onPress={() => void handleNotifyAndProceed()}
          style={styles.proceedButtonWrapper}
        >
          <LinearGradient
            colors={canProceed ? PROCEED_GRADIENT : [colors.border, colors.border]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.proceedButton}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.onPrimary} size={18} />
            ) : (
              <>
                <Text style={[styles.proceedButtonText, { color: canProceed ? colors.onPrimary : colors.muted }]}>
                  Notify &amp; Proceed
                </Text>
                <MaterialCommunityIcons
                  name="arrow-right"
                  size={18}
                  color={canProceed ? colors.onPrimary : colors.muted}
                />
              </>
            )}
          </LinearGradient>
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
  universityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  universityHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.heading,
    marginLeft: 6,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.label,
    marginBottom: 10,
    marginTop: 6,
  },
  loading: {
    marginTop: 24,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  emptyText: {
    color: colors.muted,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 19,
  },
  studentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 1,
  },
  studentCardChecked: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  statusBadge: {
    marginTop: 10,
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
    backgroundColor: '#FFFFFF',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.label,
    marginBottom: 6,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    marginBottom: 12,
  },
  amountContainerFocused: {
    borderColor: colors.primary,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.heading,
    marginRight: 0,
  },
  amountInput: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.heading,
    minWidth: 20,
    textAlign: 'left',
    padding: 0,
    marginLeft: 0,
  },
  proceedButtonWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  proceedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  proceedButtonText: {
    fontWeight: '700',
    fontSize: 15,
  },
});
