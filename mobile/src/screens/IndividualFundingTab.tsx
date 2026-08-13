import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput as NativeTextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Button, Snackbar, Text } from 'react-native-paper';
import type { TransactionCategory, UniversityStudentSummary } from '../types/api';
import CategorySelectorGrid from '../components/CategorySelectorGrid';
import { BUDGET_CATEGORIES } from '../constants/budgetCategories';
import type { BudgetCategoryDefinition, BudgetCategoryKey } from '../constants/budgetCategories';
import { colors } from '../theme/colors';
import * as universityService from '../services/universityService';
import { ApiError } from '../services/api';
import { useNotificationRefetch } from '../hooks/useNotificationRefetch';

const ACADEMIC_CATEGORY_KEYS: ReadonlySet<BudgetCategoryKey> = new Set(['tuition', 'books', 'software']);
const ACADEMIC_CATEGORIES = BUDGET_CATEGORIES.filter((category) =>
  ACADEMIC_CATEGORY_KEYS.has(category.key)
);

export default function IndividualFundingTab() {
  const [students, setStudents] = useState<UniversityStudentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<UniversityStudentSummary | null>(null);

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<BudgetCategoryDefinition | null>(null);
  const [isFunding, setIsFunding] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await universityService.getVerifiedStudents();
      setStudents(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load students.');
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

  const searchResults = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];
    return students.filter(
      (student) =>
        student.fullName.toLowerCase().includes(trimmed) ||
        student.studentNumber.toLowerCase().includes(trimmed)
    );
  }, [query, students]);

  const selectStudent = (student: UniversityStudentSummary) => {
    setSelected(student);
    setQuery('');
    setAmount('');
    setCategory(null);
  };

  const clearSelection = () => {
    setSelected(null);
    setAmount('');
    setCategory(null);
  };

  const parsedAmount = Number(amount);
  const received = selected ? Number(selected.received) : 0;
  const parentSent = selected ? Number(selected.parentSent) : 0;
  const totalCreditCost = selected ? Number(selected.totalCreditCost) : 0;
  const projectedTotal = received + parentSent + parsedAmount;
  const fundingStatus =
    selected && parsedAmount > 0
      ? projectedTotal >= totalCreditCost
        ? { label: 'Fully funded', color: colors.accent, icon: 'check-circle-outline' as const }
        : {
            label: `Partial — $${(totalCreditCost - projectedTotal).toFixed(2)} still needed`,
            color: '#F59E0B',
            icon: 'alert-outline' as const,
          }
      : null;

  const canFund = Boolean(selected) && parsedAmount > 0 && Boolean(category) && !isFunding;

  const handleFund = async () => {
    if (!selected || !category || !canFund) return;
    setIsFunding(true);
    setError(null);
    try {
      const result = await universityService.fundIndividual({
        studentUserId: selected.userId,
        amount: parsedAmount,
        category: category.key.toUpperCase() as TransactionCategory,
      });
      setSnackbarMessage(
        `$${Number(result.amount).toFixed(2)} sent to ${selected.fullName} — ${result.fundingStatus === 'FULL' ? 'fully' : 'partially'} funded.`
      );
      clearSelection();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not fund this student.');
    } finally {
      setIsFunding(false);
    }
  };

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {!selected ? (
          <>
            <Text style={styles.sectionLabel}>Search Student</Text>
            <View style={styles.searchBox}>
              <MaterialCommunityIcons name="magnify" size={20} color={colors.muted} />
              <NativeTextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Name or student number"
                placeholderTextColor={colors.placeholder}
              />
            </View>

            {isLoading && students.length === 0 ? (
              <ActivityIndicator color={colors.primary} style={styles.loading} />
            ) : query.trim().length === 0 ? (
              <Text style={styles.hintText}>Start typing to search eligible students.</Text>
            ) : searchResults.length > 0 ? (
              searchResults.map((student) => (
                <TouchableOpacity
                  key={student.id}
                  style={styles.resultRow}
                  onPress={() => selectStudent(student)}
                >
                  <View style={styles.studentMiddle}>
                    <Text style={styles.studentName}>{student.fullName}</Text>
                    <Text style={styles.studentSubtitle}>#{student.studentNumber}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.hintText}>No eligible students match that search.</Text>
            )}
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.backRow} onPress={clearSelection}>
              <MaterialCommunityIcons name="arrow-left" size={18} color={colors.primary} />
              <Text style={styles.backText}>Back to search</Text>
            </TouchableOpacity>

            <View style={styles.profileCard}>
              <Text style={styles.studentName}>{selected.fullName}</Text>
              <Text style={styles.studentSubtitle}>
                #{selected.studentNumber} · {selected.universityName}
              </Text>

              <View style={styles.fundingBreakdown}>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Total Cost</Text>
                  <Text style={styles.breakdownValue}>${totalCreditCost.toFixed(2)}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Parent sent</Text>
                  <Text style={styles.breakdownValue}>${parentSent.toFixed(2)}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Institution</Text>
                  <Text style={styles.breakdownValue}>${received.toFixed(2)}</Text>
                </View>
                <View style={[styles.breakdownRow, styles.breakdownRowLast]}>
                  <Text style={[styles.breakdownLabel, styles.breakdownGapLabel]}>Gap</Text>
                  <Text style={[styles.breakdownValue, styles.breakdownGapValue]}>
                    ${Number(selected.fundingGap).toFixed(2)}
                  </Text>
                </View>
              </View>

              <Text style={styles.coursesLabel}>Courses</Text>
              {selected.courses.map((course) => (
                <View key={course.id} style={styles.courseRow}>
                  <Text style={styles.courseName}>{course.courseName}</Text>
                  <Text style={styles.courseCost}>
                    {course.credits} cr · ${Number(course.totalCost).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Amount to Fund</Text>
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
            {fundingStatus ? (
              <View style={styles.statusRow}>
                <MaterialCommunityIcons name={fundingStatus.icon} size={14} color={fundingStatus.color} />
                <Text style={[styles.statusText, { color: fundingStatus.color }]}>
                  {fundingStatus.label}
                </Text>
              </View>
            ) : null}

            <Text style={styles.sectionLabel}>Category</Text>
            <CategorySelectorGrid value={category} onChange={setCategory} categories={ACADEMIC_CATEGORIES} />

            <Button
              mode="contained"
              buttonColor={colors.primary}
              icon="send-outline"
              disabled={!canFund}
              loading={isFunding}
              style={styles.fundButton}
              contentStyle={styles.fundButtonContent}
              onPress={handleFund}
            >
              Fund This Student
            </Button>
          </>
        )}
      </ScrollView>

      <Snackbar visible={Boolean(snackbarMessage)} onDismiss={() => setSnackbarMessage(null)} duration={3500}>
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 14,
    color: colors.heading,
  },
  loading: {
    marginTop: 24,
  },
  hintText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 6,
  },
  studentMiddle: {
    flex: 1,
  },
  studentName: {
    fontWeight: '700',
    color: colors.heading,
    fontSize: 15,
  },
  studentSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  fundingBreakdown: {
    marginTop: 14,
    marginBottom: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  breakdownRowLast: {
    borderBottomWidth: 0,
  },
  breakdownLabel: {
    fontSize: 12,
    color: colors.muted,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.heading,
  },
  breakdownGapLabel: {
    fontWeight: '700',
    color: colors.heading,
  },
  breakdownGapValue: {
    color: colors.primary,
    marginTop: 2,
  },
  coursesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.label,
    marginTop: 16,
    marginBottom: 6,
  },
  courseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.heading,
    marginRight: 4,
  },
  amountInput: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.heading,
    minWidth: 100,
    textAlign: 'center',
    padding: 0,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  fundButton: {
    borderRadius: 10,
    marginTop: 20,
  },
  fundButtonContent: {
    paddingVertical: 6,
  },
});
