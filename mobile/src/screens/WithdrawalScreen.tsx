import { useCallback, useState } from 'react';
import {
  ActivityIndicator as RNActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
import ImagePreviewModal from '../components/ImagePreviewModal';
import { useAuthenticatedImage } from '../hooks/useAuthenticatedImage';
import { categoryColors, colors } from '../theme/colors';
import * as withdrawalService from '../services/withdrawalService';
import { API_BASE_URL, ApiError, getAccessToken } from '../services/api';
import { receiptBadgeFor } from '../utils/receiptStatus';
import type { ReceiptBadgeMeta } from '../utils/receiptStatus';
import { withdrawalStatusMeta } from '../utils/transactionDisplay';
import { useNotificationRefetch } from '../hooks/useNotificationRefetch';
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

// A receipt can only be removed and replaced while it's still unresolved — once an admin or the
// auto-verification pipeline has acted on it (AUTO_VERIFIED/MANUALLY_VERIFIED/FLAGGED/REJECTED),
// the file is the record of what was reviewed and must stay in place. Kept in lockstep with the
// backend's own DELETABLE_RECEIPT_STATUSES (withdrawals.service.ts).
const DELETABLE_RECEIPT_STATUSES = new Set(['PENDING', 'PROCESSING']);

type DialogMode = 'VIEW' | 'CONFIRM_DELETE' | 'UPLOAD';

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

  const [detailTarget, setDetailTarget] = useState<WithdrawalRequest | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>('VIEW');
  const [receiptToken, setReceiptToken] = useState<string | null>(null);
  const [receiptMerchantName, setReceiptMerchantName] = useState('');
  const [pendingReceipt, setPendingReceipt] = useState<{
    uri: string;
    name: string;
    mimeType: string;
    file?: File;
  } | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [isDeletingReceipt, setIsDeletingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const [isFullPreviewVisible, setIsFullPreviewVisible] = useState(false);

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

  useNotificationRefetch(load);

  const openDetail = async (request: WithdrawalRequest) => {
    setDetailTarget(request);
    setReceiptMerchantName('');
    setPendingReceipt(null);
    setReceiptError(null);
    setDialogMode('VIEW');
    setReceiptToken(await getAccessToken());
  };

  const openUploadDirect = async (request: WithdrawalRequest) => {
    setDetailTarget(request);
    setReceiptMerchantName('');
    setPendingReceipt(null);
    setReceiptError(null);
    setDialogMode('UPLOAD');
    setReceiptToken(await getAccessToken());
  };

  const closeDetail = () => {
    if (isUploadingReceipt || isDeletingReceipt) return;
    setDetailTarget(null);
    setDialogMode('VIEW');
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
    if (!detailTarget || !pendingReceipt) return;
    setIsUploadingReceipt(true);
    setReceiptError(null);
    try {
      await withdrawalService.uploadReceipt({
        withdrawalId: detailTarget.id,
        fileUri: pendingReceipt.uri,
        fileName: pendingReceipt.name,
        fileType: pendingReceipt.mimeType,
        merchantName: receiptMerchantName.trim() || undefined,
        file: pendingReceipt.file,
      });
      setDetailTarget(null);
      setDialogMode('VIEW');
      setSnackbarMessage('Receipt uploaded.');
      await load();
    } catch (err) {
      setReceiptError(err instanceof ApiError ? err.message : 'Could not upload your receipt.');
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  const startDeleteReceipt = () => setDialogMode('CONFIRM_DELETE');
  const cancelDeleteReceipt = () => setDialogMode('VIEW');

  const confirmDeleteReceipt = async () => {
    if (!detailTarget) return;
    setIsDeletingReceipt(true);
    setReceiptError(null);
    try {
      await withdrawalService.deleteReceipt(detailTarget.id);
      setSnackbarMessage('Receipt removed. Upload a new one when ready.');
      setDetailTarget((prev) => (prev ? { ...prev, receiptPath: null } : prev));
      setDialogMode('UPLOAD');
      await load();
    } catch (err) {
      setReceiptError(err instanceof ApiError ? err.message : 'Could not remove that receipt.');
      setDialogMode('VIEW');
    } finally {
      setIsDeletingReceipt(false);
    }
  };

  const openFullReceiptPreview = () => setIsFullPreviewVisible(true);

  const receiptImageUri =
    dialogMode === 'VIEW' && detailTarget?.receiptPath
      ? `${API_BASE_URL}/withdrawals/${detailTarget.id}/receipt-file`
      : null;
  const {
    resolvedUri: inlineReceiptUri,
    hasFetchError: inlineReceiptHasError,
    nativeHeaders: inlineReceiptHeaders,
  } = useAuthenticatedImage(receiptImageUri, receiptToken);

  const canDeleteReceipt = Boolean(
    detailTarget?.receiptPath &&
      DELETABLE_RECEIPT_STATUSES.has(detailTarget.receiptVerificationStatus)
  );
  const canUploadReceipt = Boolean(
    detailTarget &&
      detailTarget.status === 'COMPLETED' &&
      !detailTarget.receiptPath &&
      detailTarget.category !== 'GENERAL'
  );

  const renderWithdrawalItem = (request: WithdrawalRequest) => {
    const categoryMeta = CATEGORY_META[request.category];
    const receiptMeta = receiptBadgeFor(request.receiptPath, request.receiptVerificationStatus);
    const isProcessing = Boolean(request.receiptPath) && request.receiptVerificationStatus === 'PROCESSING';
    const statusMeta = withdrawalStatusMeta(request.status);
    const showUploadButton =
      request.status === 'COMPLETED' && !request.receiptPath && request.category !== 'GENERAL';

    return (
      <TouchableOpacity
        key={request.id}
        style={[styles.card, { borderLeftColor: receiptMeta.fg }]}
        activeOpacity={0.85}
        onPress={() => void openDetail(request)}
      >
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
          <View style={styles.cardBadgeColumn}>
            <View style={[styles.withdrawalStatusBadge, { backgroundColor: statusMeta.bg }]}>
              <Text style={[styles.withdrawalStatusBadgeText, { color: statusMeta.fg }]} numberOfLines={1}>
                {statusMeta.label}
              </Text>
            </View>
            <ReceiptBadge meta={receiptMeta} isProcessing={isProcessing} />
          </View>
        </View>

        {showUploadButton ? (
          <Button
            mode="contained"
            icon="camera-outline"
            style={styles.uploadButton}
            contentStyle={styles.uploadButtonContent}
            onPress={(event) => {
              event.stopPropagation();
              void openUploadDirect(request);
            }}
          >
            Upload Receipt
          </Button>
        ) : null}
      </TouchableOpacity>
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
            withdrawals will show up here once processed. Tap a withdrawal to see its receipt.
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
        <Dialog
          visible={Boolean(detailTarget)}
          onDismiss={closeDetail}
          style={styles.dialogContainer}
        >
          <View style={styles.dialogHeaderRow}>
            <View style={styles.dialogHeaderIconCircle}>
              <MaterialCommunityIcons
                name={dialogMode === 'CONFIRM_DELETE' ? 'alert-circle-outline' : 'receipt-text-outline'}
                size={22}
                color={dialogMode === 'CONFIRM_DELETE' ? colors.danger : colors.primary}
              />
            </View>
            <View style={styles.dialogHeaderTextColumn}>
              <Text style={styles.dialogTitleText}>
                {dialogMode === 'CONFIRM_DELETE'
                  ? 'Remove Receipt?'
                  : dialogMode === 'UPLOAD'
                    ? detailTarget?.receiptPath
                      ? 'Replace Receipt'
                      : 'Upload Receipt'
                    : 'Withdrawal Details'}
              </Text>
              {detailTarget ? (
                <Text style={styles.dialogHeaderSubtitle}>
                  ${Number(detailTarget.amount).toFixed(2)} · {detailTarget.category}
                </Text>
              ) : null}
            </View>
          </View>
          <Dialog.Content>
            {receiptError ? <Text style={styles.errorText}>{receiptError}</Text> : null}

            {dialogMode === 'VIEW' && detailTarget ? (
              detailTarget.receiptPath ? (
                <>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={openFullReceiptPreview}
                    style={styles.receiptPreviewBox}
                  >
                    {inlineReceiptUri && !inlineReceiptHasError ? (
                      <Image
                        key={inlineReceiptUri}
                        source={{ uri: inlineReceiptUri, headers: inlineReceiptHeaders }}
                        style={styles.receiptPreviewImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.receiptPreviewPlaceholder}>
                        <MaterialCommunityIcons name="file-image-outline" size={28} color={colors.primary} />
                      </View>
                    )}
                    <View style={styles.receiptPreviewOverlay}>
                      <MaterialCommunityIcons name="magnify-plus-outline" size={14} color="#FFFFFF" />
                      <Text style={styles.receiptPreviewOverlayText}>View full size</Text>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.detailReceiptBadgeRow}>
                    <ReceiptBadge
                      meta={receiptBadgeFor(detailTarget.receiptPath, detailTarget.receiptVerificationStatus)}
                      isProcessing={detailTarget.receiptVerificationStatus === 'PROCESSING'}
                    />
                    {canDeleteReceipt ? (
                      <TouchableOpacity onPress={startDeleteReceipt} style={styles.deleteReceiptLink} hitSlop={8}>
                        <MaterialCommunityIcons name="delete-outline" size={15} color={colors.danger} />
                        <Text style={styles.deleteReceiptLinkText}>Remove &amp; Replace</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.noReceiptBox}>
                    <MaterialCommunityIcons name="receipt-text-outline" size={32} color={colors.muted} />
                    <Text style={styles.noReceiptText}>No receipt uploaded</Text>
                  </View>
                  {canUploadReceipt ? (
                    <Button
                      mode="contained"
                      icon="camera-outline"
                      buttonColor={colors.primary}
                      style={styles.uploadFromDetailButton}
                      onPress={() => setDialogMode('UPLOAD')}
                    >
                      Upload Receipt
                    </Button>
                  ) : null}
                </>
              )
            ) : null}

            {dialogMode === 'CONFIRM_DELETE' ? (
              <View style={styles.confirmDeleteBox}>
                <Text style={styles.confirmDeleteText}>
                  Remove this receipt? You&apos;ll be able to upload a new one right after.
                </Text>
              </View>
            ) : null}

            {dialogMode === 'UPLOAD' ? (
              <>
                <TouchableOpacity activeOpacity={0.85} onPress={handlePickReceipt} style={styles.uploadArea}>
                  {pendingReceipt ? (
                    <View style={styles.uploadAreaSelectedRow}>
                      <Image
                        key={pendingReceipt.uri}
                        source={{ uri: pendingReceipt.uri }}
                        style={styles.uploadThumbnail}
                        fadeDuration={0}
                      />
                      <View style={styles.uploadSelectedTextColumn}>
                        <View style={styles.uploadSelectedTitleRow}>
                          <MaterialCommunityIcons name="check-circle" size={16} color={colors.accent} />
                          <Text style={styles.uploadSelectedFilename} numberOfLines={1}>
                            {pendingReceipt.name}
                          </Text>
                        </View>
                        <Text style={styles.changePhotoLink}>Change photo</Text>
                      </View>
                    </View>
                  ) : (
                    <>
                      <MaterialCommunityIcons name="camera-plus-outline" size={40} color={colors.primary} />
                      <Text style={styles.uploadAreaTitle}>Select Receipt Photo</Text>
                      <Text style={styles.uploadAreaSubtitle}>JPG or PNG accepted</Text>
                    </>
                  )}
                </TouchableOpacity>

                <Text style={styles.fieldLabel}>Merchant Name (Optional)</Text>
                <TextInput
                  mode="outlined"
                  placeholder="e.g. Campus Café"
                  value={receiptMerchantName}
                  onChangeText={setReceiptMerchantName}
                  outlineColor={colors.border}
                  activeOutlineColor={colors.primary}
                  theme={{ roundness: 12 }}
                  style={styles.dialogInput}
                  left={<TextInput.Icon icon="store-outline" color={colors.muted} />}
                />
                <Text style={styles.fieldHelperText}>
                  Our system will auto-detect the merchant from your receipt
                </Text>

                <View style={styles.infoBannerBlue}>
                  <MaterialCommunityIcons
                    name="information-outline"
                    size={16}
                    color="#1E40AF"
                    style={styles.infoBannerBlueIcon}
                  />
                  <Text style={styles.infoBannerBlueText}>
                    Receipt will be verified against our merchant database automatically
                  </Text>
                </View>

                {isUploadingReceipt ? (
                  <View style={styles.verifyingRow}>
                    <ActivityIndicator size={16} color={colors.primary} />
                    <Text style={styles.verifyingText}>Verifying your receipt...</Text>
                  </View>
                ) : null}
              </>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            {dialogMode === 'CONFIRM_DELETE' ? (
              <>
                <Button
                  mode="outlined"
                  textColor={colors.muted}
                  style={styles.dialogCancelButton}
                  disabled={isDeletingReceipt}
                  onPress={cancelDeleteReceipt}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  buttonColor={colors.danger}
                  style={styles.dialogCancelButton}
                  loading={isDeletingReceipt}
                  disabled={isDeletingReceipt}
                  onPress={confirmDeleteReceipt}
                >
                  Remove
                </Button>
              </>
            ) : dialogMode === 'UPLOAD' ? (
              <>
                <Button
                  mode="outlined"
                  textColor={colors.muted}
                  style={styles.dialogCancelButton}
                  disabled={isUploadingReceipt}
                  onPress={closeDetail}
                >
                  Cancel
                </Button>
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={!pendingReceipt || isUploadingReceipt}
                  onPress={handleSubmitReceipt}
                  style={styles.dialogPrimaryButtonWrapper}
                >
                  <LinearGradient
                    colors={
                      pendingReceipt && !isUploadingReceipt
                        ? [colors.gradientStart, colors.gradientEnd]
                        : [colors.border, colors.border]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.dialogPrimaryButton}
                  >
                    <Text
                      style={[
                        styles.dialogPrimaryButtonText,
                        { color: pendingReceipt && !isUploadingReceipt ? '#FFFFFF' : colors.muted },
                      ]}
                    >
                      Upload
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <Button
                mode="outlined"
                textColor={colors.muted}
                style={styles.dialogCloseButtonFull}
                onPress={closeDetail}
              >
                Close
              </Button>
            )}
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <ImagePreviewModal
        visible={isFullPreviewVisible}
        uri={receiptImageUri}
        authToken={receiptToken}
        title="Receipt"
        onClose={() => setIsFullPreviewVisible(false)}
      />

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
  cardBadgeColumn: {
    alignItems: 'flex-end',
    gap: 6,
  },
  withdrawalStatusBadge: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    maxWidth: 190,
  },
  withdrawalStatusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
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
    backgroundColor: '#FFFFFF',
    marginBottom: 4,
  },
  verifyingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  verifyingText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 8,
  },
  dialogContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  dialogHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 4,
  },
  dialogHeaderIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${colors.primary}1A`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogHeaderTextColumn: {
    flex: 1,
    marginLeft: 12,
  },
  dialogTitleText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  dialogHeaderSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 16,
  },
  receiptPreviewBox: {
    borderRadius: 12,
    overflow: 'hidden',
    height: 160,
    marginTop: 16,
    backgroundColor: colors.surface,
  },
  receiptPreviewImage: {
    width: '100%',
    height: '100%',
  },
  receiptPreviewPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptPreviewOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    backgroundColor: 'rgba(10,14,20,0.55)',
  },
  receiptPreviewOverlayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 6,
  },
  detailReceiptBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  deleteReceiptLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteReceiptLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger,
    marginLeft: 4,
  },
  noReceiptBox: {
    alignItems: 'center',
    paddingVertical: 24,
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  noReceiptText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
    marginTop: 8,
  },
  uploadFromDetailButton: {
    marginTop: 16,
    borderRadius: 10,
  },
  confirmDeleteBox: {
    marginTop: 12,
    marginBottom: 4,
  },
  confirmDeleteText: {
    fontSize: 13,
    color: colors.label,
    lineHeight: 19,
  },
  uploadArea: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  uploadAreaTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 8,
  },
  uploadAreaSubtitle: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  uploadAreaSelectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  uploadThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.inputBackground,
  },
  uploadSelectedTextColumn: {
    flex: 1,
    marginLeft: 12,
  },
  uploadSelectedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadSelectedFilename: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.heading,
    marginLeft: 6,
    flexShrink: 1,
  },
  changePhotoLink: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  fieldHelperText: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 16,
  },
  infoBannerBlue: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#DBEAFE',
    borderRadius: 12,
    padding: 12,
  },
  infoBannerBlueIcon: {
    marginRight: 8,
    marginTop: 1,
  },
  infoBannerBlueText: {
    flex: 1,
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 18,
    fontWeight: '600',
  },
  dialogActions: {
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
  },
  dialogCancelButton: {
    flex: 1,
    marginRight: 10,
    borderRadius: 12,
    borderColor: colors.border,
  },
  dialogCloseButtonFull: {
    flex: 1,
    borderRadius: 12,
    borderColor: colors.border,
  },
  dialogPrimaryButtonWrapper: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  dialogPrimaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 12,
  },
  dialogPrimaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
