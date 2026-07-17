import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput as NativeTextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Avatar,
  Button,
  Chip,
  HelperText,
  IconButton,
  Text,
  TextInput,
} from 'react-native-paper';
import type { TransactionCategory, UserType } from '../types/api';
import CategorySelectorGrid from '../components/CategorySelectorGrid';
import IconBadge from '../components/IconBadge';
import KYCGate from '../components/KYCGate';
import { BUDGET_CATEGORIES } from '../constants/budgetCategories';
import type { BudgetCategoryDefinition } from '../constants/budgetCategories';
import { useWallet } from '../context/WalletContext';
import * as walletService from '../services/walletService';
import { ApiError } from '../services/api';
import { colors } from '../theme/colors';
import { getInitials } from '../utils/getInitials';
import type { RootStackScreenProps } from '../navigation/types';

const DEFAULT_CATEGORY = BUDGET_CATEGORIES.find((category) => category.key === 'general') ?? null;

type ResolvedRecipient = {
  walletId: string;
  fullName: string;
  email: string;
  userType: UserType;
};

type SentTransaction = {
  id: string;
  recipient: ResolvedRecipient;
  amount: number;
  note: string;
  requiresApproval: boolean;
  timestamp: Date;
};

export default function SendMoneyScreen({ navigation }: RootStackScreenProps<'SendMoney'>) {
  const { wallet, refresh } = useWallet();
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipient, setRecipient] = useState<ResolvedRecipient | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState<BudgetCategoryDefinition | null>(DEFAULT_CATEGORY);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [transaction, setTransaction] = useState<SentTransaction | null>(null);

  const parsedAmount = Number(amount);
  const canSend = Boolean(recipient) && parsedAmount > 0 && !isSending;

  const handleFindRecipient = async () => {
    const email = recipientEmail.trim().toLowerCase();
    if (!email || !wallet) return;
    setIsLookingUp(true);
    setLookupError(null);
    try {
      const result = await walletService.lookupWalletByEmail(email, wallet.currency);
      setRecipient({
        walletId: result.walletId,
        fullName: result.fullName,
        email,
        userType: result.userType,
      });
    } catch (err) {
      setLookupError(err instanceof ApiError ? err.message : 'Could not find that recipient.');
      setRecipient(null);
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSend = async () => {
    if (!recipient || !wallet) return;
    setIsSending(true);
    setSendError(null);
    try {
      const result = await walletService.transfer({
        toWalletId: recipient.walletId,
        amount: parsedAmount,
        currency: wallet.currency,
        category: category ? (category.key.toUpperCase() as TransactionCategory) : 'GENERAL',
        note: note.trim() || undefined,
      });
      setTransaction({
        id: result.transaction.id,
        recipient,
        amount: parsedAmount,
        note: note.trim(),
        requiresApproval: result.requiresApproval,
        timestamp: new Date(),
      });
      void refresh();
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : 'Could not send money. Try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendAnother = () => {
    setTransaction(null);
    setRecipient(null);
    setRecipientEmail('');
    setAmount('');
    setNote('');
    setCategory(DEFAULT_CATEGORY);
    setSendError(null);
    setLookupError(null);
  };

  return (
    <KYCGate>
    <SafeAreaView style={styles.flex} edges={['top']}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
        <Text variant="titleLarge" style={styles.headerTitle}>
          Send Money
        </Text>
      </View>

      {transaction ? (
        <ScrollView contentContainerStyle={styles.successContent}>
          <IconBadge
            icon={transaction.requiresApproval ? 'clock-outline' : 'check-circle-outline'}
            color={transaction.requiresApproval ? colors.primary : colors.accent}
            size={88}
            iconSize={48}
          />
          <Text variant="headlineSmall" style={styles.successTitle}>
            {transaction.requiresApproval ? 'Sent for Approval' : 'Money Sent!'}
          </Text>
          <Text style={styles.successAmount}>
            ${transaction.amount.toFixed(2)} to {transaction.recipient.fullName}
          </Text>
          {transaction.requiresApproval && (
            <Text style={styles.successNote}>
              This amount needs your parent&apos;s approval before it&apos;s sent.
            </Text>
          )}

          <View style={styles.receiptCard}>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Transaction ID</Text>
              <Text style={styles.receiptValue}>{transaction.id.slice(0, 8).toUpperCase()}</Text>
            </View>
            {transaction.note ? (
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Note</Text>
                <Text style={styles.receiptValue}>{transaction.note}</Text>
              </View>
            ) : null}
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Date</Text>
              <Text style={styles.receiptValue}>
                {transaction.timestamp.toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </View>

          <Button
            mode="contained"
            buttonColor={colors.primary}
            style={styles.doneButton}
            contentStyle={styles.doneButtonContent}
            onPress={() => navigation.goBack()}
          >
            Done
          </Button>
          <Button mode="text" textColor={colors.primary} onPress={handleSendAnother}>
            Send Another
          </Button>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {recipient ? (
            <Chip
              avatar={
                <Avatar.Text
                  size={24}
                  label={getInitials(recipient.fullName)}
                  color={colors.onPrimary}
                  style={styles.contactAvatar}
                />
              }
              onClose={() => {
                setRecipient(null);
                setRecipientEmail('');
              }}
              style={styles.recipientChip}
            >
              To: {recipient.fullName}
            </Chip>
          ) : (
            <View style={styles.lookupRow}>
              <TextInput
                mode="outlined"
                label="Recipient email"
                placeholder="friend@university.edu.lb"
                value={recipientEmail}
                onChangeText={(text: string) => {
                  setRecipientEmail(text);
                  setLookupError(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
                style={styles.lookupInput}
                onSubmitEditing={handleFindRecipient}
              />
              <Button
                mode="contained"
                buttonColor={colors.primary}
                style={styles.findButton}
                onPress={handleFindRecipient}
                disabled={!recipientEmail.trim() || isLookingUp}
              >
                {isLookingUp ? <ActivityIndicator size={16} color={colors.onPrimary} /> : 'Find'}
              </Button>
            </View>
          )}
          <HelperText type="error" visible={Boolean(lookupError)}>
            {lookupError}
          </HelperText>

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

          <Text style={styles.categoryLabel}>Spending Category (optional)</Text>
          <CategorySelectorGrid value={category} onChange={setCategory} />
          <Text style={styles.categoryNote}>
            Select a category to track which budget this payment belongs to.
          </Text>

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
    </KYCGate>
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
  lookupRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  lookupInput: {
    flex: 1,
    backgroundColor: colors.inputBackground,
    marginRight: 8,
  },
  findButton: {
    marginTop: 6,
    borderRadius: 10,
  },
  contactAvatar: {
    backgroundColor: colors.primary,
  },
  recipientChip: {
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 4,
    backgroundColor: '#EAF0FA',
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
  noteInput: {
    backgroundColor: colors.inputBackground,
    marginBottom: 4,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.label,
    marginBottom: 10,
  },
  categoryNote: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
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
  successNote: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 8,
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
    marginBottom: 8,
  },
  doneButtonContent: {
    paddingVertical: 6,
  },
});
