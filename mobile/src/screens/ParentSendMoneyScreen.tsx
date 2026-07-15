import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput as NativeTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Avatar,
  Button,
  HelperText,
  Text,
  TextInput,
  TouchableRipple,
} from 'react-native-paper';
import type { TransactionCategory } from '../types/api';
import IconBadge from '../components/IconBadge';
import { BUDGET_CATEGORIES } from '../constants/budgetCategories';
import type { BudgetCategoryDefinition, BudgetCategoryKey } from '../constants/budgetCategories';
import { useWallet } from '../context/WalletContext';
import { useThrottledFocusEffect } from '../hooks/useThrottledFocusEffect';
import * as parentalService from '../services/parentalService';
import type { LinkedStudent } from '../services/parentalService';
import * as walletService from '../services/walletService';
import { ApiError } from '../services/api';
import { colors } from '../theme/colors';
import { getInitials } from '../utils/getInitials';
import type { ParentTabScreenProps } from '../navigation/types';

// Personal spending doesn't fit "education-locked funds" — a parent locking a
// transfer only ever restricts it to an academic category, or leaves it unrestricted (General).
const LOCK_CATEGORIES = BUDGET_CATEGORIES.filter((category) => category.key !== 'personal');

const CATEGORY_EXPLANATIONS: Partial<Record<BudgetCategoryKey, string>> = {
  tuition: 'Student can only use these funds for tuition payments.',
  books: 'Student can only use these funds for textbooks and course materials.',
  food: 'Student can only use these funds for food and dining.',
  transport: 'Student can only use these funds for transportation.',
  software: 'Student can only use these funds for software and tech tools.',
  rent: 'Student can only use these funds for rent and housing.',
  general: 'No restriction — the student can spend this money anywhere.',
};

type SentTransaction = {
  id: string;
  studentName: string;
  amount: number;
  category: BudgetCategoryDefinition;
  note: string;
  requiresApproval: boolean;
  timestamp: Date;
};

export default function ParentSendMoneyScreen(_props: Readonly<ParentTabScreenProps<'Send'>>) {
  const { wallet } = useWallet();
  const [students, setStudents] = useState<LinkedStudent[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedStudent, setSelectedStudent] = useState<LinkedStudent | null>(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<BudgetCategoryDefinition | null>(null);
  const [note, setNote] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [transaction, setTransaction] = useState<SentTransaction | null>(null);

  const load = useCallback(async () => {
    setIsLoadingStudents(true);
    setLoadError(null);
    try {
      const result = await parentalService.getLinkedStudents();
      setStudents(result);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load your students.');
    } finally {
      setIsLoadingStudents(false);
    }
  }, []);

  useThrottledFocusEffect(load);

  const parsedAmount = Number(amount);
  const canSend = Boolean(selectedStudent) && parsedAmount > 0 && Boolean(category) && !isSending;

  const handleSend = async () => {
    if (!selectedStudent || !category || !wallet) return;
    const studentWallet = selectedStudent.wallets.find((w) => w.currency === wallet.currency);
    if (!studentWallet) {
      setSendError(`${selectedStudent.student.fullName} has no ${wallet.currency} wallet.`);
      return;
    }

    setIsSending(true);
    setSendError(null);
    try {
      const result = await walletService.transfer({
        toWalletId: studentWallet.id,
        amount: parsedAmount,
        currency: wallet.currency,
        category: category.key.toUpperCase() as TransactionCategory,
        note: note.trim() || undefined,
      });
      setTransaction({
        id: result.transaction.id,
        studentName: selectedStudent.student.fullName,
        amount: parsedAmount,
        category,
        note: note.trim(),
        requiresApproval: result.requiresApproval,
        timestamp: new Date(),
      });
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : 'Could not send money. Try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendAnother = () => {
    setTransaction(null);
    setSelectedStudent(null);
    setAmount('');
    setCategory(null);
    setNote('');
    setSendError(null);
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text variant="headlineSmall" style={styles.headerTitle}>
            Send Money
          </Text>
        </View>

        {transaction ? (
          <ScrollView contentContainerStyle={styles.successContent}>
            <IconBadge
              icon="check-circle-outline"
              color={colors.accent}
              size={88}
              iconSize={48}
            />
            <Text variant="headlineSmall" style={styles.successTitle}>
              Money Sent!
            </Text>
            <Text style={styles.successAmount}>
              ${transaction.amount.toFixed(2)} to {transaction.studentName}
            </Text>

            <View style={styles.receiptCard}>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Transaction ID</Text>
                <Text style={styles.receiptValue}>{transaction.id.slice(0, 8).toUpperCase()}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Education Lock</Text>
                <Text style={[styles.receiptValue, { color: transaction.category.color }]}>
                  {transaction.category.label}
                </Text>
              </View>
              {transaction.note ? (
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Note</Text>
                  <Text style={styles.receiptValue}>{transaction.note}</Text>
                </View>
              ) : null}
            </View>

            <Button
              mode="contained"
              buttonColor={colors.primary}
              style={styles.doneButton}
              contentStyle={styles.doneButtonContent}
              onPress={handleSendAnother}
            >
              Send Another
            </Button>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}

            <View style={styles.infoBanner}>
              <Text style={styles.infoBannerText}>
                Money you send with an Education Lock is automatically approved when your student
                spends it in the correct category. No extra approval needed.
              </Text>
            </View>

            <Text style={styles.sectionLabel}>Select Student</Text>
            {isLoadingStudents && students.length === 0 ? (
              <ActivityIndicator color={colors.primary} style={styles.loading} />
            ) : students.length > 0 ? (
              <View style={styles.studentList}>
                {students.map((linkedStudent) => {
                  const { student } = linkedStudent;
                  const selected = selectedStudent?.student.id === student.id;
                  return (
                    <TouchableOpacity
                      key={student.id}
                      style={[styles.studentRow, selected && styles.studentRowSelected]}
                      onPress={() => setSelectedStudent(linkedStudent)}
                    >
                      <Avatar.Text
                        size={40}
                        label={getInitials(student.fullName)}
                        style={styles.studentAvatar}
                        color={colors.onPrimary}
                      />
                      <View style={styles.studentMiddle}>
                        <Text style={styles.studentName}>{student.fullName}</Text>
                        <Text style={styles.studentEmail}>{student.email}</Text>
                      </View>
                      {selected ? (
                        <IconBadge icon="check-circle" color={colors.accent} size={28} iconSize={16} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyText}>Link a student first from the Students tab.</Text>
            )}

            <View style={styles.amountContainer}>
              <Text style={styles.currencySymbol}>{wallet?.currency ?? 'USD'}</Text>
              <NativeTextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={(text: string) => setAmount(text.replace(/[^0-9.]/g, ''))}
                placeholder="0.00"
                placeholderTextColor={colors.placeholder}
                keyboardType="decimal-pad"
              />
            </View>

            <Text style={styles.sectionLabel}>Education Lock</Text>
            <View style={styles.categoryGrid}>
              {LOCK_CATEGORIES.map((cat) => {
                const selected = category?.key === cat.key;
                return (
                  <TouchableRipple
                    key={cat.key}
                    onPress={() => setCategory(cat)}
                    style={[
                      styles.categoryItem,
                      selected && { borderColor: cat.color, backgroundColor: `${cat.color}14` },
                    ]}
                    borderless
                  >
                    <View style={styles.categoryItemContent}>
                      <IconBadge icon={cat.icon} color={cat.color} size={36} iconSize={20} />
                      <Text style={[styles.categoryItemLabel, selected && { color: cat.color }]}>
                        {cat.label}
                      </Text>
                    </View>
                  </TouchableRipple>
                );
              })}
            </View>
            <Text style={styles.categoryExplanation}>
              {category
                ? (CATEGORY_EXPLANATIONS[category.key] ?? '')
                : 'Choose a category to lock these funds to — or General for no restriction.'}
            </Text>

            <TextInput
              mode="outlined"
              label="Note (optional)"
              placeholder="What's this for?"
              value={note}
              onChangeText={setNote}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              style={styles.noteInput}
              multiline
            />

            <HelperText type="error" visible={Boolean(sendError)}>
              {sendError}
            </HelperText>

            <Button
              mode="contained"
              buttonColor={colors.primary}
              disabled={!canSend}
              style={styles.sendButton}
              contentStyle={styles.sendButtonContent}
              onPress={handleSend}
            >
              {isSending ? <ActivityIndicator size={18} color={colors.onPrimary} /> : 'Send Money'}
            </Button>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
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
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  infoBanner: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  infoBannerText: {
    fontSize: 12,
    color: colors.label,
    lineHeight: 18,
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
  },
  loading: {
    marginVertical: 12,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    marginBottom: 12,
  },
  studentList: {
    marginBottom: 8,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  studentRowSelected: {
    borderColor: colors.accent,
    backgroundColor: `${colors.accent}0F`,
  },
  studentAvatar: {
    backgroundColor: colors.primary,
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
  studentEmail: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.heading,
    marginRight: 8,
  },
  amountInput: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.heading,
    minWidth: 120,
    textAlign: 'center',
    padding: 0,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  categoryItem: {
    width: '31%',
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
  },
  categoryItemContent: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  categoryItemLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    marginTop: 6,
  },
  categoryExplanation: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
    marginBottom: 20,
  },
  noteInput: {
    backgroundColor: colors.inputBackground,
    marginBottom: 4,
  },
  sendButton: {
    borderRadius: 10,
  },
  sendButtonContent: {
    paddingVertical: 6,
  },
  successContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  successTitle: {
    fontWeight: '700',
    color: colors.heading,
    marginTop: 16,
  },
  successAmount: {
    fontSize: 15,
    color: colors.muted,
    marginTop: 4,
  },
  receiptCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
    marginTop: 24,
    marginBottom: 24,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  receiptLabel: {
    fontSize: 13,
    color: colors.muted,
  },
  receiptValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.heading,
  },
  doneButton: {
    width: '100%',
    borderRadius: 10,
  },
  doneButtonContent: {
    paddingVertical: 6,
  },
});
