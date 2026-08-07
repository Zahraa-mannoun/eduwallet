import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import {
  ActivityIndicator,
  Button,
  Chip,
  Dialog,
  IconButton,
  Portal,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import type { WithdrawalRequest } from '../types/api';
import IconBadge from '../components/IconBadge';
import { colors } from '../theme/colors';
import * as withdrawalService from '../services/withdrawalService';
import { ApiError } from '../services/api';
import type { RootStackScreenProps } from '../navigation/types';

const STATUS_META: Record<WithdrawalRequest['status'], { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: colors.muted },
  PENDING_PARENT_APPROVAL: { label: 'Awaiting Parent', color: '#F59E0B' },
  APPROVED: { label: 'Approved', color: colors.primary },
  REJECTED: { label: 'Rejected', color: colors.danger },
  COMPLETED: { label: 'Completed', color: colors.accent },
};

const RECEIPT_STATUS_META: Record<
  NonNullable<WithdrawalRequest['receiptVerificationStatus']>,
  { label: string; icon: string; color: string }
> = {
  AUTO_VERIFIED: { label: 'Verified', icon: 'check-circle-outline', color: colors.accent },
  FLAGGED: { label: 'Flagged for review', icon: 'alert-outline', color: colors.danger },
  PENDING: { label: 'Pending review', icon: 'clock-outline', color: '#F59E0B' },
  MANUALLY_VERIFIED: { label: 'Verified', icon: 'check-circle-outline', color: colors.accent },
};

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
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

  const receiptsNeeded = withdrawals.filter(
    (request) => request.status === 'COMPLETED' && !request.receiptPath
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
    const statusMeta = STATUS_META[request.status];
    const receiptMeta = request.receiptVerificationStatus
      ? RECEIPT_STATUS_META[request.receiptVerificationStatus]
      : null;

    return (
      <View key={request.id} style={styles.row}>
        <IconBadge icon="cash-multiple" color={statusMeta.color} size={44} />
        <View style={styles.rowMiddle}>
          <Text style={styles.rowTitle}>
            ${Number(request.amount).toFixed(2)} · {request.category}
          </Text>
          <Text style={styles.rowDate}>{formatDate(request.completedAt ?? request.createdAt)}</Text>

          {!request.receiptPath ? (
            <Button
              mode="text"
              compact
              textColor={colors.primary}
              style={styles.receiptButton}
              onPress={() => openReceiptDialog(request)}
            >
              Upload Receipt
            </Button>
          ) : null}

          {request.receiptPath && receiptMeta ? (
            <View style={styles.receiptStatusRow}>
              <IconBadge icon={receiptMeta.icon as never} color={receiptMeta.color} size={20} iconSize={12} />
              <Text style={[styles.receiptStatusText, { color: receiptMeta.color }]}>
                {receiptMeta.label}
              </Text>
            </View>
          ) : null}
        </View>
        <Chip
          compact
          style={[styles.statusChip, { backgroundColor: `${statusMeta.color}1F` }]}
          textStyle={{ color: statusMeta.color, fontSize: 11, fontWeight: '700' }}
        >
          {statusMeta.label}
        </Chip>
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

        {receiptsNeeded.length > 0 ? (
          <View style={styles.receiptReminderBanner}>
            <IconBadge icon="receipt" color={colors.primary} size={36} />
            <View style={styles.receiptReminderTextBlock}>
              <Text style={styles.receiptReminderTitle}>
                {receiptsNeeded.length === 1
                  ? 'Upload your receipt'
                  : `Upload ${receiptsNeeded.length} receipts`}
              </Text>
              <Text style={styles.receiptReminderSubtitle}>
                Your agent withdrawal is complete. Upload the receipt so it can be verified.
              </Text>
            </View>
            <Button
              mode="contained"
              compact
              buttonColor={colors.primary}
              style={styles.receiptReminderButton}
              onPress={() => openReceiptDialog(receiptsNeeded[0])}
            >
              Upload
            </Button>
          </View>
        ) : null}

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
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeReceiptDialog} disabled={isUploadingReceipt}>
              Cancel
            </Button>
            <Button onPress={handleSubmitReceipt} disabled={!pendingReceipt || isUploadingReceipt}>
              {isUploadingReceipt ? <ActivityIndicator size={16} color={colors.primary} /> : 'Upload'}
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
  receiptReminderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.primary}14`,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${colors.primary}40`,
    padding: 12,
    marginTop: 12,
  },
  receiptReminderTextBlock: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  receiptReminderTitle: {
    fontWeight: '700',
    color: colors.heading,
    fontSize: 13,
  },
  receiptReminderSubtitle: {
    fontSize: 11,
    color: colors.label,
    marginTop: 2,
    lineHeight: 15,
  },
  receiptReminderButton: {
    borderRadius: 20,
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
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  rowMiddle: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  rowTitle: {
    fontWeight: '700',
    color: colors.heading,
    fontSize: 13,
  },
  rowDate: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
  },
  receiptButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    marginLeft: -8,
  },
  receiptStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  receiptStatusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  statusChip: {
    height: 24,
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
});
