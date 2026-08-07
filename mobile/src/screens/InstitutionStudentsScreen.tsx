import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Text } from 'react-native-paper';
import type { UniversityStudentSummary } from '../types/api';
import { colors } from '../theme/colors';
import * as universityService from '../services/universityService';
import { ApiError } from '../services/api';

const PARTIAL_COLOR = '#F59E0B';

// Read-only, so there's only ever one thing to say about a student's funding: either it's
// fully covered (institution + parent together met totalCreditCost) or it isn't — no
// "will be funded by this disbursement" preview state exists here, unlike the pickers in
// UniversityStudentsTab.tsx / ScholarshipPortalTab.tsx.
function fundingBadgeFor(fundingGap: number): { label: string; color: string; icon: string } {
  if (fundingGap <= 0) {
    return { label: 'Fully funded', color: colors.accent, icon: 'check-circle-outline' };
  }
  return {
    label: `Partial — $${fundingGap.toFixed(2)} still needed`,
    color: PARTIAL_COLOR,
    icon: 'alert-outline',
  };
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

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Students
        </Text>
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
            const badge = fundingBadgeFor(Number(student.fundingGap));
            return (
              <View key={student.id} style={styles.studentCard}>
                <TouchableOpacity
                  style={styles.studentRow}
                  onPress={() => setExpandedId(expanded ? null : student.id)}
                >
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
                        name={badge.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                        size={14}
                        color={badge.color}
                        style={styles.statusIcon}
                      />
                      <Text style={[styles.statusText, { color: badge.color }]}>{badge.label}</Text>
                    </View>
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
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerTitle: {
    fontWeight: '700',
    color: colors.heading,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.muted,
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
  expandIcon: {
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
});
