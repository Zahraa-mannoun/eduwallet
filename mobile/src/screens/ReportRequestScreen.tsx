import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Avatar, IconButton, Snackbar, Switch, Text } from 'react-native-paper';
import type { ReportPeriod } from '../types/api';
import * as parentalService from '../services/parentalService';
import type { LinkedStudent } from '../services/parentalService';
import * as reportService from '../services/reportService';
import { ApiError } from '../services/api';
import { getInitials } from '../utils/getInitials';
import { colors } from '../theme/colors';
import type { RootStackScreenProps } from '../navigation/types';

const PERIOD_OPTIONS: Array<{ value: ReportPeriod; label: string }> = [
  { value: 'LAST_WEEK', label: 'Last Week' },
  { value: 'LAST_MONTH', label: 'Last Month' },
  { value: 'LAST_YEAR', label: 'Last Year' },
  { value: 'LAST_2_YEARS', label: 'Last 2 Years' },
];

type IncludeKey =
  | 'includeCardPurchases'
  | 'includeTransfers'
  | 'includeWithdrawals'
  | 'includeFlagged'
  | 'includePending'
  | 'includeSavings';

const INCLUDE_OPTIONS: Array<{
  key: IncludeKey;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}> = [
  { key: 'includeCardPurchases', label: 'Card Purchases', icon: 'credit-card-outline' },
  { key: 'includeTransfers', label: 'Transfers', icon: 'swap-horizontal' },
  { key: 'includeWithdrawals', label: 'Cash Withdrawals', icon: 'cash' },
  { key: 'includeFlagged', label: 'Flagged Transactions', icon: 'alert-outline' },
  { key: 'includePending', label: 'Pending Transactions', icon: 'clock-outline' },
  { key: 'includeSavings', label: 'Personal Savings', icon: 'piggy-bank-outline' },
];

export default function ReportRequestScreen({
  navigation,
}: Readonly<RootStackScreenProps<'ReportRequest'>>) {
  const [students, setStudents] = useState<LinkedStudent[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [studentUserId, setStudentUserId] = useState<string | null>(null);
  const [period, setPeriod] = useState<ReportPeriod>('LAST_MONTH');
  const [includes, setIncludes] = useState<Record<IncludeKey, boolean>>({
    includeCardPurchases: true,
    includeTransfers: true,
    includeWithdrawals: true,
    includeFlagged: false,
    includePending: false,
    includeSavings: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoadingStudents(true);
    setLoadError(null);
    try {
      const result = await parentalService.getLinkedStudents();
      setStudents(result);
      setStudentUserId((current) => current ?? result[0]?.student.id ?? null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load your linked students.');
    } finally {
      setIsLoadingStudents(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const toggleInclude = (key: IncludeKey) => {
    setIncludes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const atLeastOneSelected = Object.values(includes).some(Boolean);
  const canSubmit = Boolean(studentUserId) && atLeastOneSelected && !isSubmitting;

  const handleSubmit = async () => {
    if (!studentUserId || !canSubmit) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await reportService.requestReport({ studentUserId, period, ...includes });
      setSnackbarMessage('Your report request has been submitted. Admin will generate it shortly.');
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Could not submit your report request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerRow}>
          <IconButton
            icon="arrow-left"
            iconColor="#FFFFFF"
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          />
        </View>
        <View style={styles.headerContent}>
          <View style={styles.headerIconCircle}>
            <MaterialCommunityIcons name="file-chart-outline" size={26} color="#FFFFFF" />
          </View>
          <Text style={styles.headerTitle}>Request History Report</Text>
          <Text style={styles.headerSubtitle}>
            Generate a detailed financial report for your student
          </Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}
        {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

        <Text style={styles.sectionLabel}>Student</Text>
        {isLoadingStudents && students.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : students.length === 0 ? (
          <Text style={styles.emptyText}>You have no linked students yet.</Text>
        ) : (
          students.map((entry) => {
            const selected = studentUserId === entry.student.id;
            return (
              <TouchableOpacity
                key={entry.student.id}
                activeOpacity={0.8}
                onPress={() => setStudentUserId(entry.student.id)}
                style={[styles.studentCard, selected ? styles.studentCardSelected : styles.studentCardUnselected]}
              >
                <Avatar.Text
                  size={40}
                  label={getInitials(entry.student.fullName)}
                  style={styles.studentAvatar}
                  color={colors.onPrimary}
                />
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{entry.student.fullName}</Text>
                  <Text style={styles.studentEmail}>{entry.student.email}</Text>
                </View>
                <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                  {selected ? <View style={styles.radioInner} /> : null}
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <Text style={styles.sectionLabel}>Period</Text>
        <View style={styles.periodGrid}>
          {PERIOD_OPTIONS.map((option) => {
            const selected = period === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                activeOpacity={0.8}
                onPress={() => setPeriod(option.value)}
                style={[styles.periodPill, selected ? styles.periodPillSelected : styles.periodPillUnselected]}
              >
                <Text style={[styles.periodPillText, selected && styles.periodPillTextSelected]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Include in Report</Text>
        <View style={styles.card}>
          {INCLUDE_OPTIONS.map((option, index) => (
            <View key={option.key}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleLeft}>
                  <MaterialCommunityIcons name={option.icon} size={20} color={colors.primary} />
                  <Text style={styles.toggleLabel}>{option.label}</Text>
                </View>
                <Switch
                  value={includes[option.key]}
                  onValueChange={() => toggleInclude(option.key)}
                  color={colors.primary}
                />
              </View>
              {index < INCLUDE_OPTIONS.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!canSubmit}
          onPress={handleSubmit}
          style={styles.submitWrapper}
        >
          <LinearGradient
            colors={canSubmit ? [colors.gradientStart, colors.gradientEnd] : [colors.border, colors.border]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitButton}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="file-chart-outline"
                  size={18}
                  color={canSubmit ? '#FFFFFF' : colors.muted}
                />
                <Text style={[styles.submitButtonText, { color: canSubmit ? '#FFFFFF' : colors.muted }]}>
                  Submit Request
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      <Snackbar
        visible={Boolean(snackbarMessage)}
        onDismiss={() => setSnackbarMessage(null)}
        duration={4000}
        action={{ label: 'OK', onPress: () => navigation.goBack() }}
      >
        {snackbarMessage}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerGradient: {
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
    paddingHorizontal: 4,
  },
  backButton: {
    margin: 0,
  },
  headerContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 4,
  },
  headerIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    marginBottom: 12,
  },
  loading: {
    marginVertical: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 20,
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 14,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 2,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  studentCardSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}0D`,
  },
  studentCardUnselected: {
    borderColor: colors.border,
  },
  studentAvatar: {
    backgroundColor: colors.primary,
    marginRight: 12,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontWeight: '700',
    color: colors.heading,
    fontSize: 14,
  },
  studentEmail: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  radioOuterSelected: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  periodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  periodPill: {
    width: '48%',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    marginBottom: 10,
  },
  periodPillUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.border,
  },
  periodPillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  periodPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.label,
  },
  periodPillTextSelected: {
    color: '#FFFFFF',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.label,
    marginLeft: 12,
  },
  submitWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 28,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
});
