import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, TextInput as NativeTextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Avatar, Button, Card, IconButton, Text, TextInput, TouchableRipple } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { VirtualCard } from '../types/api';
import IconBadge from '../components/IconBadge';
import KYCGate from '../components/KYCGate';
import { colors } from '../theme/colors';
import { useWallet } from '../context/WalletContext';
import * as cardService from '../services/cardService';
import { ApiError } from '../services/api';
import type { RootStackScreenProps } from '../navigation/types';

const VIEWFINDER_HEIGHT = 260;

type RecentQRPayment = {
  id: string;
  merchantCode: string;
  amount: number;
  cardLast4: string;
  timestamp: Date;
};

function isCardUsable(card: VirtualCard): boolean {
  return !card.used && !card.frozen && new Date(card.expiry).getTime() > Date.now();
}

export default function QRPayScreen({ navigation }: RootStackScreenProps<'QRPay'>) {
  const { wallet } = useWallet();
  const [merchantCode, setMerchantCode] = useState('');
  const [submittedMerchantCode, setSubmittedMerchantCode] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [cards, setCards] = useState<VirtualCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentResult, setPaymentResult] = useState<{ amount: number; card: VirtualCard } | null>(null);
  const [recentPayments, setRecentPayments] = useState<RecentQRPayment[]>([]);
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  const loadCards = useCallback(async () => {
    try {
      const result = await cardService.getCards();
      setCards(result);
    } catch {
      // The payment form falls back to an empty card list — its own empty state covers this.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadCards();
    }, [loadCards])
  );

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scanLineAnim]);

  const scanLineTranslateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, VIEWFINDER_HEIGHT - 20],
  });

  const usableCards = cards.filter(isCardUsable);
  const parsedAmount = Number(amount);
  const canPay = Boolean(selectedCardId) && parsedAmount > 0 && !isPaying;

  const handleManualSubmit = () => {
    const code = merchantCode.trim().toUpperCase();
    if (!code) return;
    setSubmittedMerchantCode(code);
    setAmount('');
    setSelectedCardId(usableCards[0]?.id ?? null);
    setPaymentError(null);
  };

  const handleCancelPayment = () => {
    setSubmittedMerchantCode(null);
    setMerchantCode('');
    setPaymentError(null);
  };

  const handlePay = async () => {
    if (!submittedMerchantCode || !canPay) return;
    const card = cards.find((item) => item.id === selectedCardId);
    if (!card) return;

    setIsPaying(true);
    setPaymentError(null);
    try {
      await cardService.useCard({
        cardNumber: card.cardNumber,
        cvv: card.cvv,
        amount: parsedAmount,
        currency: wallet?.currency ?? 'USD',
        merchantName: submittedMerchantCode,
        category: card.categoryLock ?? 'GENERAL',
      });
      setPaymentResult({ amount: parsedAmount, card });
      setRecentPayments((prev) => [
        {
          id: `${Date.now()}`,
          merchantCode: submittedMerchantCode,
          amount: parsedAmount,
          cardLast4: card.cardNumber.slice(-4),
          timestamp: new Date(),
        },
        ...prev,
      ]);
      void loadCards();
    } catch (err) {
      setPaymentError(err instanceof ApiError ? err.message : 'Payment failed. Try again.');
    } finally {
      setIsPaying(false);
    }
  };

  const handleDone = () => {
    setPaymentResult(null);
    setSubmittedMerchantCode(null);
    setMerchantCode('');
    setAmount('');
  };

  const renderScanStep = () => (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.viewfinder}>
        <View style={[styles.corner, styles.cornerTopLeft]} />
        <View style={[styles.corner, styles.cornerTopRight]} />
        <View style={[styles.corner, styles.cornerBottomLeft]} />
        <View style={[styles.corner, styles.cornerBottomRight]} />
        <Animated.View
          style={[styles.scanLine, { transform: [{ translateY: scanLineTranslateY }] }]}
        />
        <MaterialCommunityIcons name="qrcode-scan" size={56} color="rgba(255,255,255,0.35)" />
        <Text style={styles.viewfinderText}>Point your camera at a merchant QR code</Text>
      </View>
      <Text style={styles.cameraNote}>
        Camera preview isn&apos;t available on web — this is a preview of the scan experience.
      </Text>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR ENTER CODE MANUALLY</Text>
        <View style={styles.dividerLine} />
      </View>

      <TextInput
        mode="outlined"
        label="Merchant Code"
        placeholder="e.g. CAMPUSCAFE01"
        value={merchantCode}
        onChangeText={setMerchantCode}
        autoCapitalize="characters"
        left={<TextInput.Icon icon="store-outline" />}
        outlineColor={colors.border}
        activeOutlineColor={colors.primary}
        style={styles.codeInput}
        onSubmitEditing={handleManualSubmit}
      />
      <Button
        mode="contained"
        buttonColor={colors.primary}
        disabled={!merchantCode.trim()}
        style={styles.submitButton}
        contentStyle={styles.submitButtonContent}
        onPress={handleManualSubmit}
      >
        Submit Code
      </Button>

      <Text style={styles.sectionLabel}>Recent QR Payments</Text>
      {recentPayments.length > 0 ? (
        recentPayments.map((payment) => (
          <View key={payment.id} style={styles.recentRow}>
            <IconBadge icon="qrcode-scan" color={colors.primary} size={40} />
            <View style={styles.recentMiddle}>
              <Text style={styles.recentTitle}>{payment.merchantCode}</Text>
              <Text style={styles.recentSubtitle}>
                Card •••• {payment.cardLast4} •{' '}
                {payment.timestamp.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <Text style={styles.recentAmount}>-${payment.amount.toFixed(2)}</Text>
          </View>
        ))
      ) : (
        <Card style={styles.emptyCard} mode="elevated">
          <Card.Content style={styles.emptyState}>
            <Avatar.Icon icon="qrcode-scan" size={56} style={styles.emptyIcon} color={colors.primary} />
            <Text style={styles.emptyTitle}>No QR payments yet</Text>
            <Text style={styles.emptySubtitle}>
              Payments you make by scanning a merchant QR code will show up here.
            </Text>
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );

  const renderPaymentStep = () => (
    <ScrollView contentContainerStyle={styles.content}>
      <Card style={styles.merchantCard} mode="elevated">
        <Card.Content style={styles.merchantCardContent}>
          <IconBadge icon="store-outline" color={colors.primary} size={44} />
          <View style={styles.merchantMiddle}>
            <Text style={styles.merchantLabel}>Paying</Text>
            <Text style={styles.merchantName}>{submittedMerchantCode}</Text>
          </View>
        </Card.Content>
      </Card>

      <Text style={styles.fieldLabel}>Amount</Text>
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

      <Text style={styles.fieldLabel}>Pay With</Text>
      {usableCards.length > 0 ? (
        usableCards.map((card) => {
          const selected = selectedCardId === card.id;
          return (
            <TouchableRipple
              key={card.id}
              onPress={() => setSelectedCardId(card.id)}
              style={[styles.cardOption, selected && styles.cardOptionSelected]}
              borderless
            >
              <View style={styles.cardOptionContent}>
                <IconBadge icon="credit-card-outline" color={selected ? colors.primary : colors.muted} size={36} iconSize={18} />
                <View style={styles.cardOptionMiddle}>
                  <Text style={[styles.cardOptionNumber, selected && styles.cardOptionNumberSelected]}>
                    •••• {card.cardNumber.slice(-4)}
                  </Text>
                  <Text style={styles.cardOptionMeta}>
                    {card.categoryLock ? `${card.categoryLock} only` : 'General use'}
                  </Text>
                </View>
                {selected && <IconBadge icon="check-circle" color={colors.primary} size={24} iconSize={14} />}
              </View>
            </TouchableRipple>
          );
        })
      ) : (
        <Text style={styles.emptySubtitle}>You don&apos;t have any active cards to pay with.</Text>
      )}

      {paymentError ? <Text style={styles.errorText}>{paymentError}</Text> : null}

      <Button
        mode="contained"
        buttonColor={colors.primary}
        disabled={!canPay}
        style={styles.submitButton}
        contentStyle={styles.submitButtonContent}
        onPress={handlePay}
      >
        {isPaying ? <ActivityIndicator size={18} color={colors.onPrimary} /> : `Pay ${submittedMerchantCode}`}
      </Button>
      <Button mode="text" textColor={colors.muted} onPress={handleCancelPayment} disabled={isPaying}>
        Cancel
      </Button>
    </ScrollView>
  );

  const renderResultStep = () => (
    <ScrollView contentContainerStyle={styles.resultContent}>
      <IconBadge icon="check-circle-outline" color={colors.accent} size={88} iconSize={48} />
      <Text variant="headlineSmall" style={styles.resultTitle}>
        Payment Successful
      </Text>
      <Text style={styles.resultAmount}>
        ${paymentResult?.amount.toFixed(2)} paid to {submittedMerchantCode}
      </Text>
      <Text style={styles.resultNote}>
        Charged to card •••• {paymentResult?.card.cardNumber.slice(-4)}
      </Text>
      <Button
        mode="contained"
        buttonColor={colors.primary}
        style={styles.doneButton}
        contentStyle={styles.doneButtonContent}
        onPress={handleDone}
      >
        Done
      </Button>
    </ScrollView>
  );

  return (
    <KYCGate>
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          onPress={() => (submittedMerchantCode && !paymentResult ? handleCancelPayment() : navigation.goBack())}
          style={styles.backButton}
        />
        <Text variant="titleLarge" style={styles.headerTitle}>
          QR Pay
        </Text>
      </View>

      {paymentResult ? renderResultStep() : submittedMerchantCode ? renderPaymentStep() : renderScanStep()}
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
  viewfinder: {
    height: VIEWFINDER_HEIGHT,
    borderRadius: 24,
    backgroundColor: '#0B1526',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 8,
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: colors.accent,
  },
  cornerTopLeft: {
    top: 16,
    left: 16,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  cornerTopRight: {
    top: 16,
    right: 16,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  cornerBottomLeft: {
    bottom: 16,
    left: 16,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  cornerBottomRight: {
    bottom: 16,
    right: 16,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  scanLine: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 2,
    backgroundColor: colors.accent,
    opacity: 0.85,
  },
  viewfinderText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  cameraNote: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 24,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    marginHorizontal: 10,
  },
  codeInput: {
    backgroundColor: colors.inputBackground,
    marginBottom: 16,
  },
  submitButton: {
    borderRadius: 10,
    marginBottom: 8,
  },
  submitButtonContent: {
    paddingVertical: 6,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.label,
    marginTop: 24,
    marginBottom: 10,
  },
  emptyCard: {
    borderRadius: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIcon: {
    backgroundColor: colors.surface,
    marginBottom: 14,
  },
  emptyTitle: {
    fontWeight: '700',
    color: colors.heading,
    marginBottom: 6,
  },
  emptySubtitle: {
    color: colors.muted,
    textAlign: 'center',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  recentMiddle: {
    flex: 1,
    marginLeft: 12,
  },
  recentTitle: {
    fontWeight: '700',
    color: colors.heading,
  },
  recentSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  recentAmount: {
    fontWeight: '700',
    fontSize: 14,
    color: colors.heading,
  },
  merchantCard: {
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 20,
  },
  merchantCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  merchantMiddle: {
    marginLeft: 12,
  },
  merchantLabel: {
    fontSize: 12,
    color: colors.muted,
  },
  merchantName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.heading,
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.label,
    marginBottom: 10,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginBottom: 8,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.heading,
    marginRight: 8,
  },
  amountInput: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.heading,
    minWidth: 120,
    textAlign: 'center',
    padding: 0,
  },
  cardOption: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
    marginBottom: 10,
  },
  cardOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}0F`,
  },
  cardOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  cardOptionMiddle: {
    flex: 1,
    marginLeft: 12,
  },
  cardOptionNumber: {
    fontWeight: '700',
    color: colors.heading,
  },
  cardOptionNumberSelected: {
    color: colors.primary,
  },
  cardOptionMeta: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  resultContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  resultTitle: {
    fontWeight: '700',
    color: colors.heading,
    marginTop: 16,
  },
  resultAmount: {
    fontSize: 15,
    color: colors.muted,
    marginTop: 4,
  },
  resultNote: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
  },
  doneButton: {
    width: '100%',
    borderRadius: 10,
    marginTop: 32,
  },
  doneButtonContent: {
    paddingVertical: 6,
  },
});
