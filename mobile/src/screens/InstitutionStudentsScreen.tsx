import { useCallback, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Text } from 'react-native-paper';
import type { UniversityStudentSummary } from '../types/api';
import FundingBreakdownRow from '../components/FundingBreakdownRow';
import StatusDotBadge from '../components/StatusDotBadge';
import { colors } from '../theme/colors';
import * as universityService from '../services/universityService';
import { ApiError } from '../services/api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SCREEN_BACKGROUND = '#F8FAFC';

const PARTIAL_COLOR = '#F59E0B';
const NO_COVERAGE_COLOR = '#EF4444';

// Read-only, so there's only ever one thing to say about a student's funding — no "will be
// funded by this disbursement" preview state exists here, unlike the pickers in
// UniversityStudentsTab.tsx / ScholarshipPortalTab.tsx.
// - fundingGap <= 0: institution + parent together met totalCreditCost — always green.
// - Otherwise, distinguish "nobody's sent anything yet" (red) from "something's been sent but
//   there's still a gap" (amber) using parentSent/received, not just the gap amount alone.
function fundingBadgeFor(fundingGap: number, parentSent: number, received: number): { label: string; color: string } {
  if (fundingGap <= 0) {
    return { label: 'Fully Funded', color: colors.accent };
  }
  if (parentSent === 0 && received === 0) {
    return { label: 'No Coverage', color: NO_COVERAGE_COLOR };
  }
  return { label: 'Partially Covered', color: PARTIAL_COLOR };
}

export default function InstitutionStudentsScreen() {
  const [students, setStudents] = useState<UniversityStudentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await universityService.getAllStudents();
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

  const toggleExpanded = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((current) => (current === id ? null : id));
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Students</Text>
        {students.length > 0 ? (
          <Text style={styles.headerSubtitle}>{students[0].universityName}</Text>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} />}
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {isLoading && students.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : students.length > 0 ? (
          students.map((student) => {
            const expanded = expandedId === student.id;
            const badge = fundingBadgeFor(
              Number(student.fundingGap),
              Number(student.parentSent),
              Number(student.received)
            );
            return (
              <View key={student.id} style={styles.studentCard}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.studentRow}
                  onPress={() => toggleExpanded(student.id)}
                >
                  <View style={styles.studentMiddle}>
                    <Text style={styles.studentName}>{student.fullName}</Text>
                    <Text style={styles.studentSubtitle}>#{student.studentNumber}</Text>

                    <FundingBreakdownRow
                      totalCost={Number(student.totalCreditCost)}
                      parentSent={Number(student.parentSent)}
                      institutionSent={Number(student.received)}
                      gap={Number(student.fundingGap)}
                    />

                    <StatusDotBadge label={badge.label} color={badge.color} style={styles.statusBadge} />
                  </View>
                  <MaterialCommunityIcons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={22}
                    color={colors.muted}
                    style={styles.expandIcon}
                  />
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
            <Text style={styles.emptyText}>No verified students yet.</Text>
          </View>
        )}
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
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
  studentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
  },
  studentMiddle: {
    flex: 1,
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
  expandIcon: {
    padding: 6,
  },
  coursesList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 14,
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
});
