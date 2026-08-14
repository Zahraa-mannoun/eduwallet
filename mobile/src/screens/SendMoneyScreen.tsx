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
import {
  ActivityIndicator,
  Avatar,
  Button,
  HelperText,
  IconButton,
  Text,
  TextInput,
} from 'react-native-paper';
import type { UserType } from '../types/api';
import IconBadge from '../components/IconBadge';
import KYCGate from '../components/KYCGate';
import { useWallet } from '../context/WalletContext';
import { useThrottledFocusEffect } from '../hooks/useThrottledFocusEffect';
import * as parentalService from '../services/parentalService';
import * as walletService from '../services/walletService';
import { ApiError } from '../services/api';
import { colors } from '../theme/colors';
import { getInitials } from '../utils/getInitials';
import type { RootStackScreenProps } from '../navigation/types';

const SCREEN_BACKGROUND = '#F8FAFC';
const NOTE_MAX_LENGTH = 500;

function formatApprovalDateTime(date: Date): string {
  const datePart = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  const timePart = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${datePart} at ${timePart}`;
}

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
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [transaction, setTransaction] = useState<SentTransaction | null>(null);
  const [approvalThreshold, setApprovalThreshold] = useState<number | null>(null);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!transaction?.requiresApproval) return undefined;
    pulseAnim.setValue(0);
    const loop = Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 1600,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [transaction?.requiresApproval, pulseAnim]);

  const loadApprovalThreshold = useCallback(async () => {
    try {
      const permissions = await parentalService.getMyPermissions();
      const threshold = permissions ? Number(permissions.approvalThreshold) : 0;
      setApprovalThreshold(threshold > 0 ? threshold : null);
    } catch {
      // Reminder is supplementary — leave it hidden on failure rather than showing stale data.
      setApprovalThreshold(null);
    }
  }, []);

  useThrottledFocusEffect(refresh);
  useThrottledFocusEffect(loadApprovalThreshold);

  const parsedAmount = Number(amount);
  const canSend = Boolean(recipient) && parsedAmount > 0 && !isSending;

  const handleFindRecipient = async () => {
    const email = recipientEmail.trim().toLowerCase();
    if (!email || !wallet) return;
    setIsLookingUp(true);
    setLookupError(null);
    try {
      const result = await walletService.lookupWalletByEmail(email, wallet.currency);
      if (result.userType !== 'STUDENT') {
        setLookupError('You can only send money to other students.');
        setRecipient(null);
        return;
      }
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
        category: 'GENERAL',
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

      {transaction?.requiresApproval ? (
        <LinearGradient colors={['#F1F5F9', '#FFFFFF']} style={styles.approvalGradientBg}>
          <ScrollView contentContainerStyle={styles.approvalContent}>
            <View style={styles.pulseWrapper}>
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
                    transform: [
                      { scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) },
                    ],
                  },
                ]}
              />
              <View style={styles.pulseInnerCircle}>
                <MaterialCommunityIcons name="clock-outline" size={56} color="#FFFFFF" />
              </View>
            </View>

            <Text style={styles.approvalTitle}>Sent for Approval</Text>
            <Text style={styles.approvalSubtitle}>
              ${transaction.amount.toFixed(2)} to {transaction.recipient.fullName}
            </Text>
            <View style={styles.approvalPill}>
              <Text style={styles.approvalPillText}>⏳ Pending Parent Approval</Text>
            </View>

            <View style={styles.approvalInfoCard}>
              <View style={styles.approvalInfoRow}>
                <Text style={styles.approvalInfoLabel}>Transaction ID</Text>
                <Text style={styles.approvalInfoValue}>{transaction.id.slice(0, 8).toUpperCase()}</Text>
              </View>
              <View style={styles.approvalDivider} />
              <View style={styles.approvalInfoRow}>
                <Text style={styles.approvalInfoLabel}>Date</Text>
                <Text style={styles.approvalInfoValue}>{formatApprovalDateTime(transaction.timestamp)}</Text>
              </View>
              <View style={styles.approvalDivider} />
              <View style={styles.approvalInfoRow}>
                <Text style={styles.approvalInfoLabel}>Recipient</Text>
                <Text style={styles.approvalInfoValue}>{transaction.recipient.fullName}</Text>
              </View>
              <View style={styles.approvalDivider} />
              <View style={styles.approvalInfoRow}>
                <Text style={styles.approvalInfoLabel}>Amount</Text>
                <Text style={styles.approvalInfoValue}>${transaction.amount.toFixed(2)}</Text>
              </View>
            </View>

            <View style={styles.approvalInfoBanner}>
              <MaterialCommunityIcons
                name="information-outline"
                size={16}
                color="#92400E"
                style={styles.approvalInfoBannerIcon}
              />
              <Text style={styles.approvalInfoBannerText}>
                Your parent will be notified to approve this transfer. You&apos;ll receive a
                notification once it&apos;s approved or rejected.
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.approvalDoneButtonWrapper}
              onPress={() => navigation.goBack()}
            >
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.approvalDoneButton}
              >
                <Text style={styles.approvalDoneButtonText}>Done</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.approvalSendAnotherButton}
              onPress={handleSendAnother}
            >
              <Text style={styles.approvalSendAnotherButtonText}>Send Another</Text>
            </TouchableOpacity>
          </ScrollView>
        </LinearGradient>
      ) : transaction ? (
        <ScrollView contentContainerStyle={styles.successContent}>
          <IconBadge icon="check-circle-outline" color={colors.accent} size={88} iconSize={48} />
          <Text variant="headlineSmall" style={styles.successTitle}>
            Money Sent!
          </Text>
          <Text style={styles.successAmount}>
            ${transaction.amount.toFixed(2)} to {transaction.recipient.fullName}
          </Text>

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
          <Text style={styles.sectionLabel}>Recipient</Text>
          <View style={styles.sectionCard}>
            {recipient ? (
              <View style={styles.recipientRow}>
                <Avatar.Text
                  size={44}
                  label={getInitials(recipient.fullName)}
                  color={colors.onPrimary}
                  style={styles.recipientAvatar}
                />
                <View style={styles.recipientMiddle}>
                  <Text style={styles.recipientName}>{recipient.fullName}</Text>
                  <Text style={styles.recipientEmail}>{recipient.email}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setRecipient(null);
                    setRecipientEmail('');
                  }}
                  hitSlop={8}
                >
                  <MaterialCommunityIcons name="check-circle" size={26} color={colors.accent} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.lookupRow}>
                <TextInput
                  mode="outlined"
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
                  theme={{ roundness: 12 }}
                  style={styles.lookupInput}
                  left={<TextInput.Icon icon="email-outline" color={colors.muted} />}
                  onSubmitEditing={handleFindRecipient}
                />
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={!recipientEmail.trim() || isLookingUp}
                  onPress={handleFindRecipient}
                  style={[
                    styles.findButton,
                    (!recipientEmail.trim() || isLookingUp) && styles.findButtonDisabled,
                  ]}
                >
                  {isLookingUp ? (
                    <ActivityIndicator size={16} color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.findButtonText}>Find</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
            <HelperText type="error" visible={Boolean(lookupError)} style={styles.helperTextNoPad}>
              {lookupError}
            </HelperText>
          </View>

          <Text style={styles.sectionLabel}>Amount</Text>
          <View style={styles.sectionCard}>
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

            {approvalThreshold !== null && (
              <View style={styles.thresholdBanner}>
                <MaterialCommunityIcons
                  name="flash-outline"
                  size={16}
                  color="#92400E"
                  style={styles.thresholdBannerIcon}
                />
                <Text style={styles.thresholdBannerText}>
                  Transfers above ${approvalThreshold.toFixed(0)} require parent approval
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.sectionLabel}>Note (Optional)</Text>
          <View style={styles.sectionCard}>
            <TextInput
              mode="outlined"
              placeholder="What's this for?"
              value={note}
              onChangeText={(text) => setNote(text.slice(0, NOTE_MAX_LENGTH))}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              theme={{ roundness: 12 }}
              style={styles.noteInput}
              left={<TextInput.Icon icon="pencil-outline" color={colors.muted} />}
              multiline
            />
            <Text style={styles.charCounter}>
              {note.length}/{NOTE_MAX_LENGTH}
            </Text>
          </View>

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
    </KYCGate>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: SCREEN_BACKGROUND,
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
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  helperTextNoPad: {
    paddingHorizontal: 0,
  },
  lookupRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  lookupInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  findButton: {
    marginTop: 6,
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  findButtonDisabled: {
    backgroundColor: colors.border,
  },
  findButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recipientAvatar: {
    backgroundColor: colors.primary,
  },
  recipientMiddle: {
    flex: 1,
    marginLeft: 12,
  },
  recipientName: {
    fontWeight: '700',
    color: colors.heading,
    fontSize: 15,
  },
  recipientEmail: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  currencySymbol: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.muted,
    marginRight: 8,
    alignSelf: 'center',
  },
  amountInput: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.heading,
    minWidth: 120,
    textAlign: 'center',
    padding: 0,
  },
  thresholdBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
  },
  thresholdBannerIcon: {
    marginRight: 8,
    marginTop: 1,
  },
  thresholdBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
    fontWeight: '600',
  },
  noteInput: {
    backgroundColor: '#FFFFFF',
  },
  charCounter: {
    fontSize: 11,
    color: colors.muted,
    textAlign: 'right',
    marginTop: 4,
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
  approvalGradientBg: {
    flex: 1,
  },
  approvalContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  pulseWrapper: {
    width: 130,
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  pulseRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#FDE68A',
  },
  pulseInnerCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  approvalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.heading,
  },
  approvalSubtitle: {
    fontSize: 16,
    color: colors.muted,
    marginTop: 4,
  },
  approvalPill: {
    backgroundColor: '#FEF3C7',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 12,
  },
  approvalPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  approvalInfoCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FDE68A',
    padding: 18,
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  approvalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
  },
  approvalDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  approvalInfoLabel: {
    fontSize: 13,
    color: colors.muted,
  },
  approvalInfoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.heading,
  },
  approvalInfoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  approvalInfoBannerIcon: {
    marginRight: 8,
    marginTop: 1,
  },
  approvalInfoBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
  approvalDoneButtonWrapper: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 24,
  },
  approvalDoneButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 16,
  },
  approvalDoneButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  approvalSendAnotherButton: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.primary,
    marginTop: 12,
  },
  approvalSendAnotherButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
});
