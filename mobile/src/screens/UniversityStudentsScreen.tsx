import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TextInput as NativeTextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Button, Card, Checkbox, IconButton, Text } from 'react-native-paper';
import type { UniversityStudentSummary } from '../types/api';
import type { PreselectedUniversityStudent } from '../navigation/types';
import { colors } from '../theme/colors';
import * as universityService from '../services/universityService';
import { ApiError } from '../services/api';
import type { RootStackScreenProps } from '../navigation/types';

function fundingStatusFor(
  amount: number,
  totalCreditCost: number
): { label: string; color: string; icon: string } | null {
  if (amount <= 0) return null;
  if (amount >= totalCreditCost) {
    return { label: 'Fully funded', color: colors.accent, icon: 'check-circle-outline' };
  }
  const gap = totalCreditCost - amount;
  return {
    label: `Partial — $${gap.toFixed(2)} still needed`,
    color: '#F59E0B',
    icon: 'alert-outline',
  };
}

export default function UniversityStudentsScreen({
  navigation,
}: Readonly<RootStackScreenProps<'UniversityStudents'>>) {
  const [students, setStudents] = useState<UniversityStudentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [amount, setAmount] = useState('');
  const [isPreparing, setIsPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await universityService.getVerifiedStudents();
      setStudents(result);
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
  const canProceed = selectedIds.size > 0 && parsedAmount > 0 && !isPreparing;

  const handleProceed = async () => {
    if (!canProceed) return;
    setIsPreparing(true);
    setPrepareError(null);
    try {
      const preview = await universityService.prepareDisbursement({
        studentIds: [...selectedIds],
        amountPerStudent: parsedAmount,
      });
      const preselectedStudents: PreselectedUniversityStudent[] = preview.map((entry) => ({
        userId: entry.userId,
        fullName: entry.fullName,
        email: entry.email,
      }));
      navigation.navigate('InstitutionMain', {
        screen: 'Portal',
        params: { preselectedStudents, amountPerStudent: parsedAmount },
      });
    } catch (err) {
      setPrepareError(err instanceof ApiError ? err.message : 'Could not prepare that disbursement.');
    } finally {
      setIsPreparing(false);
    }
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
        <Text variant="titleLarge" style={styles.headerTitle}>
          University Students
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} />}
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Card style={styles.card} mode="elevated">
          <Card.Content>
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
          </Card.Content>
        </Card>

        <Text style={styles.sectionLabel}>
          Verified Students {selectedIds.size > 0 ? `(${selectedIds.size} selected)` : ''}
        </Text>

        {isLoading && students.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : students.length > 0 ? (
          students.map((student) => {
            const checked = selectedIds.has(student.id);
            const status = fundingStatusFor(parsedAmount, Number(student.totalCreditCost));
            return (
              <TouchableOpacity
                key={student.id}
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
                  <View style={styles.studentStatsRow}>
                    <Text style={styles.studentStat}>
                      Total: <Text style={styles.studentStatValue}>${Number(student.totalCreditCost).toFixed(2)}</Text>
                    </Text>
                    <Text style={styles.studentStat}>
                      Received: <Text style={styles.studentStatValue}>${Number(student.received).toFixed(2)}</Text>
                    </Text>
                  </View>
                  <Text style={styles.studentGap}>
                    Funding gap: ${Number(student.fundingGap).toFixed(2)}
                  </Text>
                  {status ? (
                    <View style={styles.statusRow}>
                      <MaterialCommunityIcons
                        name={status.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                        size={14}
                        color={status.color}
                        style={styles.statusIcon}
                      />
                      <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <Card style={styles.card} mode="elevated">
            <Card.Content>
              <Text style={styles.emptyText}>No verified, enrolled students found.</Text>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {prepareError ? <Text style={styles.errorText}>{prepareError}</Text> : null}
        <Button
          mode="contained"
          buttonColor={colors.primary}
          icon="arrow-right"
          disabled={!canProceed}
          loading={isPreparing}
          style={styles.proceedButton}
          contentStyle={styles.proceedButtonContent}
          onPress={handleProceed}
        >
          Proceed to Send
        </Button>
      </View>
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
    paddingBottom: 16,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  card: {
    borderRadius: 16,
    marginBottom: 20,
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
    paddingVertical: 8,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.heading,
    marginRight: 4,
  },
  amountInput: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.heading,
    minWidth: 100,
    textAlign: 'center',
    padding: 0,
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
  emptyText: {
    color: colors.muted,
    textAlign: 'center',
  },
  studentRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  studentMiddle: {
    flex: 1,
    marginLeft: 8,
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
  studentStatsRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  studentStat: {
    fontSize: 12,
    color: colors.muted,
    marginRight: 16,
  },
  studentStatValue: {
    fontWeight: '700',
    color: colors.heading,
  },
  studentGap: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
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
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  proceedButton: {
    borderRadius: 10,
  },
  proceedButtonContent: {
    paddingVertical: 6,
  },
});
