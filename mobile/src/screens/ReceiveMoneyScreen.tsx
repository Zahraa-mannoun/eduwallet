import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { Button, IconButton, Snackbar, Text, TextInput } from 'react-native-paper';
import KYCGate from '../components/KYCGate';
import { useWallet } from '../context/WalletContext';
import { colors } from '../theme/colors';
import type { RootStackScreenProps } from '../navigation/types';

export default function ReceiveMoneyScreen({ navigation }: RootStackScreenProps<'ReceiveMoney'>) {
  const { wallet } = useWallet();
  const walletId = wallet?.id ?? '';
  const [requestAmount, setRequestAmount] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const qrValue = useMemo(() => {
    if (!walletId) return '';
    const amount = Number(requestAmount);
    return amount > 0
      ? `eduwallet://receive?wallet=${walletId}&amount=${amount.toFixed(2)}`
      : `eduwallet://receive?wallet=${walletId}`;
  }, [requestAmount, walletId]);

  const handleCopy = async () => {
    if (!walletId) return;
    await Clipboard.setStringAsync(walletId);
    setSnackbarMessage('Wallet ID copied to clipboard.');
  };

  const handleShareWalletId = async () => {
    if (!walletId) return;
    try {
      await Clipboard.setStringAsync(walletId);
      await Share.share({
        message: `Send me money on EduWallet — my wallet ID is ${walletId}`,
      });
      setSnackbarMessage('Wallet ID copied and ready to share.');
    } catch {
      setSnackbarMessage('Sharing is not supported on this device.');
    }
  };

  return (
    <KYCGate>
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
        <Text variant="titleLarge" style={styles.headerTitle}>
          Receive Money
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.qrCard}>
          {walletId ? (
            <QRCode value={qrValue} size={200} color={colors.heading} backgroundColor={colors.background} />
          ) : (
            <ActivityIndicator color={colors.primary} style={styles.qrLoading} />
          )}
        </View>

        <Text style={styles.walletIdLabel}>Your Wallet ID</Text>
        <Text selectable style={styles.walletId}>
          {walletId || 'Loading…'}
        </Text>

        <View style={styles.actionsRow}>
          <Button
            mode="outlined"
            icon="content-copy"
            textColor={colors.primary}
            style={styles.actionButton}
            disabled={!walletId}
            onPress={handleCopy}
          >
            Copy
          </Button>
          <Button
            mode="contained"
            buttonColor={colors.primary}
            icon="share-variant-outline"
            style={styles.actionButton}
            disabled={!walletId}
            onPress={handleShareWalletId}
          >
            Share Wallet ID
          </Button>
        </View>

        <TextInput
          mode="outlined"
          label="Amount to request (optional)"
          placeholder="0.00"
          value={requestAmount}
          onChangeText={(text: string) => setRequestAmount(text.replace(/[^0-9.]/g, ''))}
          keyboardType="decimal-pad"
          left={<TextInput.Icon icon="currency-usd" />}
          outlineColor={colors.border}
          activeOutlineColor={colors.primary}
          style={styles.amountInput}
        />

        <Text style={styles.instructions}>
          Share your QR code or wallet ID with another EduWallet user to receive money instantly —
          this is also the easiest way for a parent to find your wallet. If you entered an amount,
          it will be pre-filled for the sender when they scan your code.
        </Text>
      </ScrollView>

      <Snackbar
        visible={snackbarMessage !== null}
        onDismiss={() => setSnackbarMessage(null)}
        duration={2000}
      >
        {snackbarMessage ?? ''}
      </Snackbar>
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
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  qrCard: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    minWidth: 200,
  },
  qrLoading: {
    margin: 20,
  },
  walletIdLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: 4,
  },
  walletId: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.heading,
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 10,
    borderColor: colors.primary,
  },
  amountInput: {
    width: '100%',
    backgroundColor: colors.inputBackground,
    marginBottom: 16,
  },
  instructions: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
