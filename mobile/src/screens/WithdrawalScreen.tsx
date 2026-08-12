import { useCallback, useState } from 'react';
import { ActivityIndicator as RNActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import {
  ActivityIndicator,
  Button,
  Dialog,
  IconButton,
  Portal,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import type { TransactionCategory, WithdrawalRequest } from '../types/api';
import IconBadge from '../components/IconBadge';
import { categoryColors, colors } from '../theme/colors';
import * as withdrawalService from '../services/withdrawalService';
import { ApiError } from '../services/api';
import type { RootStackScreenProps } from '../navigation/types';

const CATEGORY_META: Record<
  TransactionCategory,
  { icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string }
> = {
  FOOD: { icon: 'food', color: categoryColors.food },
  BOOKS: { icon: 'book-open-variant', color: categoryColors.books },
  TRANSPORT: { icon: 'bus', color: categoryColors.transport },
  SOFTWARE: { icon: 'laptop', color: categoryColors.software },
  TUITION: { icon: 'school', color: categoryColors.tuition },
  LIFESTYLE: { icon: 'shopping-outline', color: categoryColors.lifestyle },
  RENT: { icon: 'home-outline', color: categoryColors.rent },
  PERSONAL_SAVINGS: { icon: 'piggy-bank-outline', color: categoryColors.personalSavings },
  GENERAL: { icon: 'wallet-outline', color: categoryColors.general },
};

type ReceiptBadgeMeta = {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  bg: string;
  fg: string;
};

const RECEIPT_STATUS_META: Record<
  NonNullable<WithdrawalRequest['receiptVerificationStatus']>,
  ReceiptBadgeMeta
> = {
  AUTO_VERIFIED: { label: 'Verified', icon: 'check-circle', bg: '#D1FAE5', fg: '#065F46' },
  MANUALLY_VERIFIED: { label: 'Verified', icon: 'check-circle', bg: '#D1FAE5', fg: '#065F46' },
  FLAGGED: { label: 'Flagged for Review', icon: 'alert', bg: '#FEE2E2', fg: '#991B1B' },
  PENDING: { label: 'Pending Review', icon: 'clock-outline', bg: '#FEF3C7', fg: '#92400E' },
  PROCESSING: { label: 'Verifying...', icon: 'sync', bg: '#DBEAFE', fg: '#1E40AF' },
  REJECTED: { label: 'Rejected', icon: 'close-circle', bg: '#FCA5A5', fg: '#7F1D1D' },
};

const NO_RECEIPT_META: ReceiptBadgeMeta = {
  label: 'No Receipt',
  icon: 'file-outline',
  bg: '#F3F4F6',
  fg: '#6B7280',
};

// A receipt row only becomes "PROCESSING" once uploadReceipt has written a file — before that,
// receiptVerificationStatus is still whatever default the row was created with, so receiptPath
// is what actually distinguishes "nothing uploaded" from "something uploaded, being checked".
function receiptBadgeFor(request: WithdrawalRequest): ReceiptBadgeMeta {
  if (!request.receiptPath || !request.receiptVerificationStatus) return NO_RECEIPT_META;
  return RECEIPT_STATUS_META[request.receiptVerificationStatus];
}

function formatDateTime(isoDate: string): string {
  const date = new Date(isoDate);
  const datePart = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  const timePart = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${datePart} at ${timePart}`;
}

function ReceiptBadge({ meta, isProcessing }: Readonly<{ meta: ReceiptBadgeMeta; isProcessing: boolean }>) {
  return (
    <View style={[styles.receiptBadge, { backgroundColor: meta.bg }]}>
      {isProcessing ? (
        <RNActivityIndicator size={11} color={meta.fg} />
      ) : (
        <MaterialCommunityIcons name={meta.icon} size={13} color={meta.fg} />
      )}
      <Text style={[styles.receiptBadgeText, { color: meta.fg }]} numberOfLines={1}>
        {meta.label}
      </Text>
    </View>
  );
}

export default function WithdrawalScreen({
  navigation,
}: Readonly<RootStackScreenProps<'Withdrawal'>>) {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const [receiptTarget, setReceiptTarget] = useState<WithdrawalRequest | null>(null);
  const [receiptMerchantName, setReceiptMerchantName] = useState('');
  const [pendingReceipt, setPendingReceipt] = useState<{
    uri: string;
    name: string;
    mimeType: string;
    file?: File;
  } | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await withdrawalService.getMyWithdrawals();
      setWithdrawals(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load your withdrawals.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const openReceiptDialog = (request: WithdrawalRequest) => {
    setReceiptTarget(request);
    setReceiptMerchantName('');
    setPendingReceipt(null);
    setReceiptError(null);
  };

  const closeReceiptDialog = () => {
    if (isUploadingReceipt) return;
    setReceiptTarget(null);
  };

  const handlePickReceipt = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    setPendingReceipt({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? 'image/jpeg',
      file: asset.file,
    });
  };

  const handleSubmitReceipt = async () => {
    if (!receiptTarget || !pendingReceipt) return;
    setIsUploadingReceipt(true);
    setReceiptError(null);
    try {
      await withdrawalService.uploadReceipt({
        withdrawalId: receiptTarget.id,
        fileUri: pendingReceipt.uri,
        fileName: pendingReceipt.name,
        fileType: pendingReceipt.mimeType,
        merchantName: receiptMerchantName.trim() || undefined,
        file: pendingReceipt.file,
      });
      setReceiptTarget(null);
      setSnackbarMessage('Receipt uploaded.');
      await load();
    } catch (err) {
      setReceiptError(err instanceof ApiError ? err.message : 'Could not upload your receipt.');
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  const renderWithdrawalItem = (request: WithdrawalRequest) => {
    const categoryMeta = CATEGORY_META[request.category];
    const receiptMeta = receiptBadgeFor(request);
    const isProcessing = Boolean(request.receiptPath) && request.receiptVerificationStatus === 'PROCESSING';
    const showUploadButton =
      request.status === 'COMPLETED' && !request.receiptPath && request.category !== 'GENERAL';

    return (
      <View key={request.id} style={[styles.card, { borderLeftColor: receiptMeta.fg }]}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardLeft}>
            <IconBadge icon={categoryMeta.icon} color={categoryMeta.color} size={44} />
            <View style={styles.cardTextGroup}>
              <View style={styles.cardCategoryAmountRow}>
                <Text style={styles.amountText}>${Number(request.amount).toFixed(2)}</Text>
                <Text style={styles.categoryText}>{request.category}</Text>
              </View>
              <Text style={styles.dateText}>
                {formatDateTime(request.completedAt ?? request.createdAt)}
              </Text>
            </View>
          </View>
          <ReceiptBadge meta={receiptMeta} isProcessing={isProcessing} />
        </View>

        {showUploadButton ? (
          <Button
            mode="contained"
            icon="camera-outline"
            style={styles.uploadButton}
            contentStyle={styles.uploadButtonContent}
            onPress={() => openReceiptDialog(request)}
          >
            Upload Receipt
          </Button>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
        <Text variant="titleLarge" style={styles.headerTitle}>
          Cash Withdrawals
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} />}
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            Visit an agent in person to withdraw cash from your locked or free balance. Your
            withdrawals will show up here once processed.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Your Withdrawals</Text>
        {isLoading && withdrawals.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : withdrawals.length > 0 ? (
          <View style={styles.list}>{withdrawals.map(renderWithdrawalItem)}</View>
        ) : (
          <Text style={styles.emptyText}>
            No withdrawals yet. Visit an agent to collect cash from your locked or free balance.
          </Text>
        )}
      </ScrollView>

      <Portal>
        <Dialog visible={Boolean(receiptTarget)} onDismiss={closeReceiptDialog}>
          <Dialog.Title>Upload Receipt</Dialog.Title>
          <Dialog.Content>
            {receiptError ? <Text style={styles.errorText}>{receiptError}</Text> : null}
            <Text style={styles.dialogHint}>
              Take a photo of your receipt — we&apos;ll check it matches the declared category.
            </Text>
            <Button
              mode="outlined"
              icon="camera-outline"
              style={styles.dialogInput}
              onPress={handlePickReceipt}
            >
              {pendingReceipt ? pendingReceipt.name : 'Select Receipt Photo'}
            </Button>
            <TextInput
              mode="outlined"
              label="Merchant name (optional)"
              value={receiptMerchantName}
              onChangeText={setReceiptMerchantName}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              style={styles.dialogInput}
            />
            {isUploadingReceipt ? (
              <View style={styles.verifyingRow}>
                <ActivityIndicator size={16} color={colors.primary} />
                <Text style={styles.verifyingText}>Verifying your receipt...</Text>
              </View>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeReceiptDialog} disabled={isUploadingReceipt}>
              Cancel
            </Button>
            <Button onPress={handleSubmitReceipt} disabled={!pendingReceipt || isUploadingReceipt}>
              Upload
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={Boolean(snackbarMessage)}
        onDismiss={() => setSnackbarMessage(null)}
        duration={3500}
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
  infoBanner: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    marginBottom: 20,
  },
  infoBannerText: {
    fontSize: 12,
    color: colors.label,
    lineHeight: 18,
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
    fontSize: 13,
    lineHeight: 18,
  },
  list: {
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderLeftWidth: 4,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  cardTextGroup: {
    marginLeft: 12,
    flexShrink: 1,
  },
  cardCategoryAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  amountText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.heading,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    marginLeft: 6,
  },
  dateText: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },
  receiptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    maxWidth: 150,
  },
  receiptBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 5,
    flexShrink: 1,
  },
  uploadButton: {
    marginTop: 14,
    borderRadius: 10,
  },
  uploadButtonContent: {
    paddingVertical: 2,
  },
  dialogInput: {
    backgroundColor: colors.inputBackground,
    marginBottom: 12,
  },
  dialogHint: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 12,
    lineHeight: 18,
  },
  verifyingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  verifyingText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 8,
  },
});
