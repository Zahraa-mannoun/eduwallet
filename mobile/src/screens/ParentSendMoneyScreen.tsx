import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput as NativeTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import {
  ActivityIndicator,
  Avatar,
  HelperText,
  Text,
  TextInput,
  TouchableRipple,
} from 'react-native-paper';
import type { TransactionCategory } from '../types/api';
import IconBadge from '../components/IconBadge';
import { LOCKABLE_BUDGET_CATEGORIES } from '../constants/budgetCategories';
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

const SCREEN_BACKGROUND = '#F8FAFC';

const LOCK_CATEGORIES = LOCKABLE_BUDGET_CATEGORIES;

function formatDateTime(date: Date): string {
  const datePart = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  const timePart = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${datePart} at ${timePart}`;
}

const CATEGORY_EXPLANATIONS: Partial<Record<BudgetCategoryKey, string>> = {
  tuition: 'Student can only use these funds for tuition payments.',
  books: 'Student can only use these funds for textbooks and course materials.',
  food: 'Student can only use these funds for food and dining.',
  transport: 'Student can only use these funds for transportation.',
  software: 'Student can only use these funds for software and tech tools.',
  rent: 'Student can only use these funds for rent and housing.',
  lifestyle: 'Student can only use these funds for personal/lifestyle spending.',
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

export default function ParentSendMoneyScreen({ navigation }: Readonly<ParentTabScreenProps<'Send'>>) {
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
  const [copiedId, setCopiedId] = useState(false);
  const checkmarkScale = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    setIsLoadingStudents(true);
    setLoadError(null);
    try {
      const result = await parentalService.getLinkedStudents();
      setStudents(result);
      // Re-sync the already-selected student (if any) against the freshly fetched list, so an
      // edit made elsewhere (e.g. on the Students tab, changing allowed categories) is reflected
      // here immediately instead of only after the student is re-tapped.
      setSelectedStudent((prev) =>
        prev ? (result.find((candidate) => candidate.student.id === prev.student.id) ?? prev) : prev
      );
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load your students.');
    } finally {
      setIsLoadingStudents(false);
    }
  }, []);

  // No throttle here (unlike most useThrottledFocusEffect callers) — this is a bottom-tab
  // screen that stays mounted, so switching Students -> Send within the default 30s throttle
  // window would silently skip the refetch and show stale "Education Lock" categories.
  useThrottledFocusEffect(load, 0);

  const parsedAmount = Number(amount);
  const canSend = Boolean(selectedStudent) && parsedAmount > 0 && Boolean(category) && !isSending;

  const availableCategories = selectedStudent
    ? LOCK_CATEGORIES.filter((cat) =>
        selectedStudent.link.categories.includes(cat.key.toUpperCase() as TransactionCategory)
      )
    : LOCK_CATEGORIES;

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

  const handleGoToDashboard = () => {
    handleSendAnother();
    navigation.navigate('Home');
  };

  const handleCopyTransactionId = async () => {
    if (!transaction) return;
    await Clipboard.setStringAsync(transaction.id.slice(0, 8).toUpperCase());
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  useEffect(() => {
    if (!transaction) {
      checkmarkScale.setValue(0);
      return;
    }
    Animated.spring(checkmarkScale, {
      toValue: 1,
      friction: 5,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [transaction, checkmarkScale]);

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text variant="headlineSmall" style={styles.headerTitle}>
            Send Money
          </Text>
        </View>

        {transaction ? (
          <View style={styles.successScreen}>
          <ScrollView contentContainerStyle={styles.successContent}>
            <View style={styles.successCard}>
              <Animated.View style={[styles.checkmarkCircle, { transform: [{ scale: checkmarkScale }] }]}>
                <MaterialCommunityIcons name="check" size={44} color="#FFFFFF" />
              </Animated.View>
              <Text variant="headlineSmall" style={styles.successTitle}>
                Money Sent!
              </Text>
              <Text style={styles.successAmount}>
                ${transaction.amount.toFixed(2)} to {transaction.studentName}
              </Text>

              <View style={styles.receiptDivider} />

              <View style={styles.receiptCard}>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Transaction ID</Text>
                  <View style={styles.receiptIdRow}>
                    <Text style={styles.receiptIdValue}>{transaction.id.slice(0, 8).toUpperCase()}</Text>
                    <TouchableOpacity onPress={handleCopyTransactionId} hitSlop={8}>
                      <MaterialCommunityIcons
                        name={copiedId ? 'check' : 'content-copy'}
                        size={15}
                        color={copiedId ? colors.accent : colors.primary}
                        style={styles.receiptCopyIcon}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Education Lock</Text>
                  <View style={[styles.receiptPill, { backgroundColor: `${transaction.category.color}1F` }]}>
                    <Text style={[styles.receiptPillText, { color: transaction.category.color }]}>
                      {transaction.category.label}
                    </Text>
                  </View>
                </View>
                {transaction.note ? (
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Note</Text>
                    <Text style={styles.receiptValue}>{transaction.note}</Text>
                  </View>
                ) : null}
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Date</Text>
                  <Text style={styles.receiptValue}>{formatDateTime(transaction.timestamp)}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Status</Text>
                  <View style={styles.statusBadge}>
                    <MaterialCommunityIcons name="check-circle" size={12} color="#065F46" />
                    <Text style={styles.statusBadgeText}>Completed</Text>
                  </View>
                </View>
              </View>
            </View>

            <TouchableOpacity activeOpacity={0.85} style={styles.sendButtonWrapper} onPress={handleSendAnother}>
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sendButton}
              >
                <MaterialCommunityIcons name="send-outline" size={18} color="#FFFFFF" />
                <Text style={[styles.sendButtonText, { color: '#FFFFFF' }]}>Send Another</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.dashboardButton}
              onPress={handleGoToDashboard}
            >
              <MaterialCommunityIcons name="home-outline" size={18} color={colors.primary} />
              <Text style={styles.dashboardButtonText}>Go to Dashboard</Text>
            </TouchableOpacity>
          </ScrollView>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}

            <View style={styles.infoBanner}>
              <MaterialCommunityIcons
                name="information-outline"
                size={16}
                color={colors.primaryDark}
                style={styles.infoBannerIcon}
              />
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
                      onPress={() => {
                        setSelectedStudent(linkedStudent);
                        setCategory(null);
                      }}
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
                        <IconBadge icon="check-circle" color={colors.primary} size={28} iconSize={16} />
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
            {selectedStudent && availableCategories.length === 0 ? (
              <Text style={styles.emptyText}>
                Your parental settings for {selectedStudent.student.fullName} don't allow any
                spending categories yet — add categories (including General) from the Students
                tab before sending.
              </Text>
            ) : null}
            <View style={styles.categoryGrid}>
              {availableCategories.map((cat, index) => {
                const selected = category?.key === cat.key;
                // A plain `justifyContent: 'space-between'` 3-column grid pushes a 2-item last
                // row to opposite edges with a big gap between them — explicit per-item margins
                // instead keep every row (including a ragged last one) evenly and consistently
                // spaced, so e.g. Lifestyle and General sit directly side by side.
                const isLastInRow = (index + 1) % 3 === 0;
                return (
                  <TouchableRipple
                    key={cat.key}
                    onPress={() => setCategory(cat)}
                    style={[
                      styles.categoryItem,
                      !isLastInRow && styles.categoryItemGap,
                      selected && styles.categoryItemSelected,
                    ]}
                    borderless
                  >
                    <View style={styles.categoryItemContent}>
                      <MaterialCommunityIcons
                        name={cat.icon}
                        size={22}
                        color={selected ? '#FFFFFF' : cat.color}
                      />
                      <Text style={[styles.categoryItemLabel, selected && styles.categoryItemLabelSelected]}>
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

            <Text style={styles.inputLabel}>Note (optional)</Text>
            <TextInput
              mode="outlined"
              placeholder="What's this for?"
              value={note}
              onChangeText={setNote}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              theme={{ roundness: 12 }}
              style={styles.noteInput}
              multiline
            />

            <HelperText type="error" visible={Boolean(sendError)}>
              {sendError}
            </HelperText>

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={!canSend}
              onPress={handleSend}
              style={styles.sendButtonWrapper}
            >
              <LinearGradient
                colors={canSend ? [colors.gradientStart, colors.gradientEnd] : [colors.border, colors.border]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sendButton}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="send-outline"
                      size={18}
                      color={canSend ? '#FFFFFF' : colors.muted}
                    />
                    <Text style={[styles.sendButtonText, { color: canSend ? '#FFFFFF' : colors.muted }]}>
                      Send Money
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.surface,
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
    flexDirection: 'row',
    backgroundColor: `${colors.primary}14`,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  infoBannerIcon: {
    marginRight: 8,
    marginTop: 1,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.primaryDark,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  studentRowSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}0F`,
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
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  categoryItem: {
    width: '31%',
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  categoryItemGap: {
    marginRight: '3.5%',
  },
  categoryItemSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
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
  categoryItemLabelSelected: {
    color: '#FFFFFF',
  },
  categoryExplanation: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    marginBottom: 6,
  },
  noteInput: {
    backgroundColor: '#FFFFFF',
    marginBottom: 4,
  },
  sendButtonWrapper: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 16,
  },
  sendButtonText: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
  successScreen: {
    flex: 1,
    backgroundColor: SCREEN_BACKGROUND,
  },
  successContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  successCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 20,
  },
  checkmarkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
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
    textAlign: 'center',
  },
  receiptDivider: {
    width: '100%',
    height: 1,
    backgroundColor: colors.border,
    marginTop: 20,
  },
  receiptCard: {
    width: '100%',
    marginTop: 4,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
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
  receiptIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  receiptIdValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.heading,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  receiptCopyIcon: {
    marginLeft: 8,
  },
  receiptPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  receiptPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
    marginLeft: 4,
  },
  dashboardButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.primary,
    marginTop: 12,
  },
  dashboardButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: 8,
  },
});
