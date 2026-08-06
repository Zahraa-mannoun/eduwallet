import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Button,
  Checkbox,
  IconButton,
  RadioButton,
  Snackbar,
  Text,
} from 'react-native-paper';
import type { ReportPeriod } from '../types/api';
import * as parentalService from '../services/parentalService';
import type { LinkedStudent } from '../services/parentalService';
import * as reportService from '../services/reportService';
import { ApiError } from '../services/api';
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

const INCLUDE_OPTIONS: Array<{ key: IncludeKey; label: string }> = [
  { key: 'includeCardPurchases', label: 'Card Purchases' },
  { key: 'includeTransfers', label: 'Transfers' },
  { key: 'includeWithdrawals', label: 'Cash Withdrawals' },
  { key: 'includeFlagged', label: 'Flagged Transactions' },
  { key: 'includePending', label: 'Pending Transactions' },
  { key: 'includeSavings', label: 'Personal Savings' },
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
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
        <Text variant="titleLarge" style={styles.headerTitle}>
          Request History Report
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}
        {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

        <Text style={styles.sectionLabel}>Student</Text>
        {isLoadingStudents && students.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : students.length === 0 ? (
          <Text style={styles.emptyText}>You have no linked students yet.</Text>
        ) : (
          <RadioButton.Group
            onValueChange={(value) => setStudentUserId(value)}
            value={studentUserId ?? ''}
          >
            <View style={styles.card}>
              {students.map((entry, index) => (
                <View key={entry.student.id}>
                  <RadioButton.Item
                    label={entry.student.fullName}
                    value={entry.student.id}
                    color={colors.primary}
                    style={styles.radioItem}
                  />
                  {index < students.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </RadioButton.Group>
        )}

        <Text style={styles.sectionLabel}>Period</Text>
        <RadioButton.Group onValueChange={(value) => setPeriod(value as ReportPeriod)} value={period}>
          <View style={styles.card}>
            {PERIOD_OPTIONS.map((option, index) => (
              <View key={option.value}>
                <RadioButton.Item
                  label={option.label}
                  value={option.value}
                  color={colors.primary}
                  style={styles.radioItem}
                />
                {index < PERIOD_OPTIONS.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        </RadioButton.Group>

        <Text style={styles.sectionLabel}>Include in Report</Text>
        <View style={styles.card}>
          {INCLUDE_OPTIONS.map((option, index) => (
            <View key={option.key}>
              <Checkbox.Item
                label={option.label}
                status={includes[option.key] ? 'checked' : 'unchecked'}
                onPress={() => toggleInclude(option.key)}
                color={colors.primary}
                style={styles.radioItem}
              />
              {index < INCLUDE_OPTIONS.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        <Button
          mode="contained"
          buttonColor={colors.primary}
          style={styles.submitButton}
          contentStyle={styles.submitButtonContent}
          disabled={!canSubmit}
          loading={isSubmitting}
          onPress={handleSubmit}
        >
          Submit Request
        </Button>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  backButton: {
    margin: 0,
  },
  headerTitle: {
    fontWeight: '700',
    color: colors.heading,
    marginLeft: 4,
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
    fontWeight: '600',
    color: colors.label,
    marginTop: 20,
    marginBottom: 10,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
  },
  radioItem: {
    paddingVertical: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  submitButton: {
    borderRadius: 10,
    marginTop: 28,
  },
  submitButtonContent: {
    paddingVertical: 6,
  },
});
