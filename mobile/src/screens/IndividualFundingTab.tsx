import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput as NativeTextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Snackbar, Text } from 'react-native-paper';
import type { TransactionCategory, UniversityStudentSummary } from '../types/api';
import CategorySelectorGrid from '../components/CategorySelectorGrid';
import StatusDotBadge from '../components/StatusDotBadge';
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

// Same gradient as UniversityStudentsTab's "Notify & Proceed" — every primary action button in
// the Institution funding flows should read as the same button, not a mix of gradients.
const ACTION_GRADIENT: [string, string] = ['#2E5FAC', '#4a7fd4'];

export default function IndividualFundingTab() {
  const [students, setStudents] = useState<UniversityStudentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selected, setSelected] = useState<UniversityStudentSummary | null>(null);

  const [amount, setAmount] = useState('');
  const [isAmountFocused, setIsAmountFocused] = useState(false);
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
        ? { label: 'Fully Funded', color: colors.accent }
        : {
            label: `Partial — $${(totalCreditCost - projectedTotal).toFixed(2)} still needed`,
            color: '#F59E0B',
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
            <View style={[styles.searchBox, isSearchFocused && styles.searchBoxFocused]}>
              <MaterialCommunityIcons
                name="magnify"
                size={20}
                color={isSearchFocused ? colors.primary : colors.muted}
              />
              <NativeTextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
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
                  activeOpacity={0.8}
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
            <TouchableOpacity style={styles.backRow} activeOpacity={0.7} onPress={clearSelection}>
              <MaterialCommunityIcons name="arrow-left" size={16} color={colors.primary} />
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
                <View style={styles.breakdownGapRow}>
                  <Text style={styles.breakdownGapLabel}>Gap</Text>
                  <Text style={styles.breakdownGapValue}>${Number(selected.fundingGap).toFixed(2)}</Text>
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
            {fundingStatus ? (
              <View style={styles.statusRow}>
                <StatusDotBadge label={fundingStatus.label} color={fundingStatus.color} />
              </View>
            ) : null}

            <Text style={styles.sectionLabel}>Category</Text>
            <CategorySelectorGrid
              value={category}
              onChange={setCategory}
              categories={ACADEMIC_CATEGORIES}
              variant="primary"
            />

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={!canFund}
              onPress={() => void handleFund()}
              style={styles.fundButtonWrapper}
            >
              <LinearGradient
                colors={canFund ? ACTION_GRADIENT : [colors.border, colors.border]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.fundButton}
              >
                {isFunding ? (
                  <ActivityIndicator color={colors.onPrimary} size={18} />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="send-outline"
                      size={18}
                      color={canFund ? colors.onPrimary : colors.muted}
                    />
                    <Text style={[styles.fundButtonText, { color: canFund ? colors.onPrimary : colors.muted }]}>
                      Fund This Student
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
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
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchBoxFocused: {
    borderColor: colors.primary,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: `${colors.primary}14`,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  backText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 1,
  },
  fundingBreakdown: {
    marginTop: 14,
    marginBottom: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  breakdownGapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: `${colors.primary}12`,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 6,
  },
  breakdownGapLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  breakdownGapValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
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
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
  },
  amountContainerFocused: {
    borderColor: colors.primary,
  },
  currencySymbol: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.heading,
    marginRight: 0,
  },
  amountInput: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.heading,
    minWidth: 20,
    textAlign: 'left',
    padding: 0,
    marginLeft: 0,
  },
  statusRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  fundButtonWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 20,
  },
  fundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  fundButtonText: {
    fontWeight: '700',
    fontSize: 15,
  },
});
