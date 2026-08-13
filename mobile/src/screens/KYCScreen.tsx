import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Button, Card, Chip, IconButton, Snackbar, Text } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { AcademicDocument, KYCStatus } from '../types/api';
import IconBadge from '../components/IconBadge';
import ImagePreviewModal from '../components/ImagePreviewModal';
import { colors } from '../theme/colors';
import * as kycService from '../services/kycService';
import { API_BASE_URL, ApiError, getAccessToken } from '../services/api';
import type { RootStackScreenProps } from '../navigation/types';

const STATUS_META: Record<
  KYCStatus | 'NOT_STARTED',
  { title: string; subtitle: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string }
> = {
  NOT_STARTED: {
    title: 'Verification Not Started',
    subtitle: 'Upload your student ID and enrollment certificate to begin.',
    icon: 'card-account-details-outline',
    color: colors.muted,
  },
  PENDING: {
    title: 'Verification Pending',
    subtitle: 'Your university is reviewing your documents. This usually takes 1-2 business days.',
    icon: 'progress-clock',
    color: '#F59E0B',
  },
  VERIFIED: {
    title: 'Verified',
    subtitle: 'Your university enrollment has been verified.',
    icon: 'check-decagram',
    color: colors.accent,
  },
  REJECTED: {
    title: 'Verification Rejected',
    subtitle: 'Your documents were rejected. Please upload new ones.',
    icon: 'alert-circle-outline',
    color: colors.danger,
  },
};

type DocumentKey = 'studentId' | 'enrollmentCertificate';

const DOCUMENTS: {
  key: DocumentKey;
  type: 'STUDENT_ID' | 'ENROLLMENT_CERTIFICATE';
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}[] = [
  { key: 'studentId', type: 'STUDENT_ID', title: 'Student ID', icon: 'card-account-details-outline' },
  {
    key: 'enrollmentCertificate',
    type: 'ENROLLMENT_CERTIFICATE',
    title: 'Enrollment Certificate',
    icon: 'file-certificate-outline',
  },
];

export default function KYCScreen({ navigation }: Readonly<RootStackScreenProps<'KYC'>>) {
  const [status, setStatus] = useState<KYCStatus>('PENDING');
  const [documents, setDocuments] = useState<AcademicDocument[]>([]);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<DocumentKey | null>(null);
  const [deletingKey, setDeletingKey] = useState<DocumentKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const [previewDoc, setPreviewDoc] = useState<{ uri: string; title: string } | null>(null);
  const [previewToken, setPreviewToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await kycService.getKYCStatus();
      setStatus(result.kycStatus);
      setDocuments(result.documents);
      setRejectionReason(result.rejectionReason);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load your KYC status.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleUpload = async (key: DocumentKey, documentType: 'STUDENT_ID' | 'ENROLLMENT_CERTIFICATE') => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    setUploadingKey(key);
    try {
      await kycService.submitDocument({
        documentType,
        fileUri: asset.uri,
        file: asset.file,
        fileName: asset.name,
        fileType: asset.mimeType ?? 'application/octet-stream',
      });
      setSnackbarMessage(`${asset.name} submitted for review.`);
      await load();
    } catch (err) {
      setSnackbarMessage(err instanceof ApiError ? err.message : 'Could not submit that document.');
    } finally {
      setUploadingKey(null);
    }
  };

  const handleDelete = async (key: DocumentKey, document: AcademicDocument) => {
    setDeletingKey(key);
    try {
      await kycService.deleteDocument(document.id);
      setSnackbarMessage('Document removed. You can upload a new one.');
      await load();
    } catch (err) {
      setSnackbarMessage(err instanceof ApiError ? err.message : 'Could not remove that document.');
    } finally {
      setDeletingKey(null);
    }
  };

  const openPreview = async (document: AcademicDocument, title: string) => {
    const token = await getAccessToken();
    setPreviewToken(token);
    setPreviewDoc({ uri: `${API_BASE_URL}/kyc/document/${document.id}/file`, title });
  };

  const closePreview = () => setPreviewDoc(null);

  // getMyDocuments()/getKYCStatus() return every row newest-first, so the first match per type
  // is the current one — a student can have more than one row per type across resubmissions,
  // but only the latest is ever "the" document for that type.
  const getDocument = (documentType: 'STUDENT_ID' | 'ENROLLMENT_CERTIFICATE') =>
    documents.find((document) => document.documentType === documentType) ?? null;

  const statusKey: KYCStatus | 'NOT_STARTED' =
    status === 'PENDING' && documents.length === 0 ? 'NOT_STARTED' : status;
  const statusMeta = STATUS_META[statusKey];
  const uploadedCount = DOCUMENTS.filter((document) => getDocument(document.type)).length;

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
        <Text variant="titleLarge" style={styles.headerTitle}>
          University Verification
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {isLoading && documents.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : (
          <>
            {statusKey === 'VERIFIED' ? (
              <LinearGradient
                colors={['#ECFDF5', '#BBF7D0']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.verifiedCard}
              >
                <View style={styles.verifiedIconRing}>
                  <IconBadge icon={statusMeta.icon} color="#059669" size={92} iconSize={46} />
                </View>
                <Text variant="titleLarge" style={styles.verifiedTitle}>
                  {statusMeta.title}
                </Text>
                <Text style={styles.verifiedSubtitle}>{statusMeta.subtitle}</Text>
              </LinearGradient>
            ) : (
              <Card style={styles.statusCard} mode="elevated">
                <Card.Content style={styles.statusContent}>
                  <IconBadge icon={statusMeta.icon} color={statusMeta.color} size={72} iconSize={36} />
                  <Text variant="titleMedium" style={styles.statusTitle}>
                    {statusMeta.title}
                  </Text>
                  <Text style={styles.statusSubtitle}>{statusMeta.subtitle}</Text>
                  {status === 'REJECTED' && rejectionReason ? (
                    <Text style={styles.rejectionReasonText}>Reason: {rejectionReason}</Text>
                  ) : null}
                </Card.Content>
              </Card>
            )}

            <View style={styles.sectionLabelRow}>
              <Text style={styles.sectionLabel}>Required Documents</Text>
              <View style={styles.progressPill}>
                <Text style={styles.progressPillText}>
                  {uploadedCount}/{DOCUMENTS.length} uploaded
                </Text>
              </View>
            </View>
            {DOCUMENTS.map((documentDef) => {
              const document = getDocument(documentDef.type);
              const isUploaded = Boolean(document);
              const isUploading = uploadingKey === documentDef.key;
              const isDeleting = deletingKey === documentDef.key;
              const canDelete = isUploaded && status === 'PENDING';
              return (
                <Card
                  key={documentDef.key}
                  style={[
                    styles.documentCard,
                    { borderLeftColor: isUploaded ? colors.accent : colors.border },
                  ]}
                  mode="elevated"
                >
                  <Card.Content style={styles.documentContent}>
                    <TouchableOpacity
                      style={styles.documentHeaderRow}
                      activeOpacity={document ? 0.7 : 1}
                      disabled={!document}
                      onPress={() => document && openPreview(document, documentDef.title)}
                    >
                      <IconBadge
                        icon={documentDef.icon}
                        color={isUploaded ? colors.accent : colors.primary}
                        size={44}
                      />
                      <View style={styles.documentMiddle}>
                        <Text style={styles.documentTitle} numberOfLines={1}>
                          {documentDef.title}
                        </Text>
                        <Text style={styles.documentStatus} numberOfLines={1}>
                          {isUploaded ? 'Submitted — tap to view' : 'Not uploaded'}
                        </Text>
                      </View>
                      {isUploaded ? (
                        <View style={styles.uploadedActions}>
                          <Chip
                            compact
                            icon="check"
                            style={styles.uploadedChip}
                            textStyle={styles.uploadedChipText}
                          >
                            Uploaded
                          </Chip>
                          {canDelete ? (
                            <View style={styles.deleteDocButton}>
                              {isDeleting ? (
                                <ActivityIndicator size={14} color={colors.danger} />
                              ) : (
                                <IconButton
                                  icon="close"
                                  size={14}
                                  iconColor={colors.danger}
                                  style={styles.deleteDocIcon}
                                  onPress={() => document && handleDelete(documentDef.key, document)}
                                />
                              )}
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                    </TouchableOpacity>
                    {!isUploaded ? (
                      // A standalone full-width row, not squeezed alongside documentMiddle —
                      // the REJECTED label ("Re-upload your Enrollment Certificate") is long
                      // enough that sharing a row with it collapsed the label text down to a
                      // near-zero width and made it wrap character-by-character.
                      <Button
                        mode="contained"
                        buttonColor={colors.primary}
                        icon="upload-outline"
                        compact
                        loading={isUploading}
                        disabled={isUploading}
                        style={styles.documentActionButton}
                        onPress={() => handleUpload(documentDef.key, documentDef.type)}
                      >
                        {status === 'REJECTED' ? `Re-upload your ${documentDef.title}` : 'Upload'}
                      </Button>
                    ) : null}
                  </Card.Content>
                </Card>
              );
            })}
          </>
        )}
      </ScrollView>

      <ImagePreviewModal
        visible={Boolean(previewDoc)}
        uri={previewDoc?.uri ?? null}
        authToken={previewToken}
        title={previewDoc?.title}
        onClose={closePreview}
      />

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
  loading: {
    marginTop: 40,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginTop: 12,
  },
  statusCard: {
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 24,
  },
  statusContent: {
    alignItems: 'center',
    paddingVertical: 26,
  },
  statusTitle: {
    fontWeight: '700',
    color: colors.heading,
    marginTop: 16,
    marginBottom: 6,
  },
  statusSubtitle: {
    color: colors.muted,
    textAlign: 'center',
  },
  rejectionReasonText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 12,
  },
  verifiedCard: {
    borderRadius: 20,
    marginTop: 8,
    marginBottom: 24,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 3,
  },
  verifiedIconRing: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  verifiedTitle: {
    fontWeight: '800',
    color: '#065F46',
    marginTop: 18,
    marginBottom: 6,
  },
  verifiedSubtitle: {
    color: '#047857',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.label,
  },
  progressPill: {
    backgroundColor: `${colors.primary}1F`,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  progressPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  documentCard: {
    borderRadius: 16,
    borderLeftWidth: 4,
    marginBottom: 12,
  },
  documentContent: {
    flexDirection: 'column',
  },
  documentHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  documentMiddle: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    marginRight: 8,
  },
  documentTitle: {
    fontWeight: '700',
    color: colors.heading,
  },
  documentStatus: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  documentActionButton: {
    alignSelf: 'stretch',
    marginTop: 12,
  },
  uploadedActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadedChip: {
    backgroundColor: `${colors.accent}1F`,
  },
  uploadedChipText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 11,
  },
  deleteDocButton: {
    marginLeft: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: `${colors.danger}14`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteDocIcon: {
    margin: 0,
  },
});
