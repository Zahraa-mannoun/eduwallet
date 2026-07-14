import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput as NativeTextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Button, Card, Checkbox, Chip, IconButton, Snackbar, Text } from 'react-native-paper';
import CategorySelectorGrid from '../components/CategorySelectorGrid';
import IconBadge from '../components/IconBadge';
import type { BudgetCategoryDefinition } from '../constants/budgetCategories';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { getInitials } from '../utils/getInitials';
import type { RootStackScreenProps } from '../navigation/types';

type RegisteredStudent = {
  id: string;
  name: string;
  university: string;
};

const REGISTERED_STUDENTS: RegisteredStudent[] = [
  { id: 'STU-1', name: 'Zahraa Student', university: 'American University of Beirut' },
  { id: 'STU-2', name: 'Karim Youssef', university: 'Lebanese American University' },
  { id: 'STU-3', name: 'Nour Chamoun', university: 'Université Saint-Joseph' },
  { id: 'STU-4', name: 'Ali Mansour', university: 'Lebanese University' },
];

type Disbursement = {
  id: string;
  studentCount: number;
  amountPerStudent: number;
  totalAmount: number;
  category: BudgetCategoryDefinition;
  date: string;
};

const INITIAL_DISBURSEMENTS: Disbursement[] = [];

const formatDate = (isoDate: string) =>
  new Date(isoDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

export default function ScholarshipPortalScreen({
  navigation,
}: RootStackScreenProps<'InstitutionMain'>) {
  const { logout } = useAuth();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<BudgetCategoryDefinition | null>(null);
  const [disbursements, setDisbursements] = useState<Disbursement[]>(INITIAL_DISBURSEMENTS);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const parsedAmount = Number(amount);
  const canSend = selectedIds.size > 0 && parsedAmount > 0 && Boolean(category);

  const handleLogout = () => {
    logout();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

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

  const handleSendDisbursement = () => {
    if (!category) return;
    const newDisbursement: Disbursement = {
      id: `DSB-${Date.now().toString(36).toUpperCase()}`,
      studentCount: selectedIds.size,
      amountPerStudent: parsedAmount,
      totalAmount: parsedAmount * selectedIds.size,
      category,
      date: new Date().toISOString(),
    };
    setDisbursements((prev) => [newDisbursement, ...prev]);
    setSnackbarMessage(`Disbursement sent to ${selectedIds.size} student${selectedIds.size === 1 ? '' : 's'}.`);
    setSelectedIds(new Set());
    setAmount('');
    setCategory(null);
  };

  const reports = useMemo(() => {
    const totalDisbursed = disbursements.reduce((sum, d) => sum + d.totalAmount, 0);
    const studentsFunded = disbursements.reduce((sum, d) => sum + d.studentCount, 0);
    const totalsByCategory = new Map<string, number>();
    disbursements.forEach((d) => {
      totalsByCategory.set(d.category.key, (totalsByCategory.get(d.category.key) ?? 0) + d.totalAmount);
    });
    const topCategory: BudgetCategoryDefinition | null = disbursements.reduce<{
      category: BudgetCategoryDefinition | null;
      amount: number;
    }>(
      (best, d) => {
        const total = totalsByCategory.get(d.category.key) ?? 0;
        return total > best.amount ? { category: d.category, amount: total } : best;
      },
      { category: null, amount: 0 }
    ).category;

    return { totalDisbursed, studentsFunded, topCategory };
  }, [disbursements]);

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Scholarship Portal
        </Text>
        <IconButton icon="logout" iconColor={colors.danger} onPress={handleLogout} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>
          Registered Students {selectedIds.size > 0 ? `(${selectedIds.size} selected)` : ''}
        </Text>
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            {REGISTERED_STUDENTS.map((student) => {
              const checked = selectedIds.has(student.id);
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
                  <Avatar.Text
                    size={36}
                    label={getInitials(student.name)}
                    style={styles.studentAvatar}
                    color={colors.onPrimary}
                  />
                  <View style={styles.studentMiddle}>
                    <Text style={styles.studentName}>{student.name}</Text>
                    <Text style={styles.studentUniversity}>{student.university}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </Card.Content>
        </Card>

        <Text style={styles.sectionLabel}>Bulk Disbursement</Text>
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <Text style={styles.fieldLabel}>Amount per Student</Text>
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

            <Text style={styles.fieldLabel}>Category Lock</Text>
            <CategorySelectorGrid value={category} onChange={setCategory} />

            <Button
              mode="contained"
              buttonColor={colors.primary}
              icon="send-outline"
              disabled={!canSend}
              style={styles.sendButton}
              contentStyle={styles.sendButtonContent}
              onPress={handleSendDisbursement}
            >
              Send Disbursement
            </Button>
          </Card.Content>
        </Card>

        <Text style={styles.sectionLabel}>Disbursement History</Text>
        {disbursements.length > 0 ? (
          disbursements.map((disbursement) => (
            <View key={disbursement.id} style={styles.historyRow}>
              <IconBadge icon={disbursement.category.icon} color={disbursement.category.color} size={40} />
              <View style={styles.historyMiddle}>
                <Text style={styles.historyTitle}>
                  {disbursement.studentCount} student{disbursement.studentCount === 1 ? '' : 's'} • $
                  {disbursement.amountPerStudent.toFixed(2)} each
                </Text>
                <Text style={styles.historySubtitle}>{formatDate(disbursement.date)}</Text>
              </View>
              <Text style={styles.historyAmount}>${disbursement.totalAmount.toFixed(2)}</Text>
            </View>
          ))
        ) : (
          <Card style={styles.card} mode="elevated">
            <Card.Content style={styles.emptyState}>
              <Avatar.Icon
                icon="send-outline"
                size={48}
                style={styles.emptyIcon}
                color={colors.primary}
              />
              <Text style={styles.emptyTitle}>No disbursements yet</Text>
              <Text style={styles.emptySubtitle}>Sent disbursements will show up here.</Text>
            </Card.Content>
          </Card>
        )}

        <Text style={styles.sectionLabel}>Reports</Text>
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <View style={styles.reportRow}>
              <Text style={styles.reportLabel}>Total Disbursed</Text>
              <Text style={styles.reportValue}>${reports.totalDisbursed.toFixed(2)}</Text>
            </View>
            <View style={styles.reportRow}>
              <Text style={styles.reportLabel}>Students Funded</Text>
              <Text style={styles.reportValue}>{reports.studentsFunded}</Text>
            </View>
            <View style={styles.reportRow}>
              <Text style={styles.reportLabel}>Top Category</Text>
              {reports.topCategory ? (
                <Chip
                  compact
                  style={[styles.reportChip, { backgroundColor: `${reports.topCategory.color}1F` }]}
                  textStyle={{ color: reports.topCategory.color, fontWeight: '700', fontSize: 11 }}
                >
                  {reports.topCategory.label}
                </Chip>
              ) : (
                <Text style={styles.reportValue}>—</Text>
              )}
            </View>
          </Card.Content>
        </Card>
      </ScrollView>

      <Snackbar
        visible={snackbarMessage !== null}
        onDismiss={() => setSnackbarMessage(null)}
        duration={2500}
      >
        {snackbarMessage ?? ''}
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  headerTitle: {
    fontWeight: '700',
    color: colors.heading,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.label,
    marginBottom: 10,
  },
  card: {
    borderRadius: 16,
    marginBottom: 24,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  studentAvatar: {
    backgroundColor: colors.primary,
    marginLeft: 4,
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
  studentUniversity: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.label,
    marginBottom: 10,
    marginTop: 4,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 8,
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
  sendButton: {
    borderRadius: 10,
    marginTop: 8,
  },
  sendButtonContent: {
    paddingVertical: 6,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  historyMiddle: {
    flex: 1,
    marginLeft: 12,
  },
  historyTitle: {
    fontWeight: '700',
    color: colors.heading,
    fontSize: 13,
  },
  historySubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  historyAmount: {
    fontWeight: '700',
    color: colors.heading,
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyIcon: {
    backgroundColor: colors.background,
    marginBottom: 10,
  },
  emptyTitle: {
    fontWeight: '700',
    color: colors.heading,
    marginBottom: 4,
  },
  emptySubtitle: {
    color: colors.muted,
  },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  reportLabel: {
    fontSize: 13,
    color: colors.muted,
  },
  reportValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.heading,
  },
  reportChip: {
    height: 26,
  },
});
