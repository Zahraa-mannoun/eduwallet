import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Button, Card, Chip, IconButton, Snackbar, Text } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { AcademicDocument, KYCStatus } from '../types/api';
import IconBadge from '../components/IconBadge';
import { colors } from '../theme/colors';
import * as kycService from '../services/kycService';
import { ApiError } from '../services/api';
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
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<DocumentKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await kycService.getKYCStatus();
      setStatus(result.kycStatus);
      setDocuments(result.documents);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load your KYC status.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpload = async (key: DocumentKey, documentType: 'STUDENT_ID' | 'ENROLLMENT_CERTIFICATE') => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    setUploadingKey(key);
    try {
      await kycService.submitDocument({
        documentType,
        fileName: asset.name,
        fileSize: asset.size ?? 1,
      });
      setSnackbarMessage(`${asset.name} submitted for review.`);
      await load();
    } catch (err) {
      setSnackbarMessage(err instanceof ApiError ? err.message : 'Could not submit that document.');
    } finally {
      setUploadingKey(null);
    }
  };

  const hasDocument = (documentType: 'STUDENT_ID' | 'ENROLLMENT_CERTIFICATE') =>
    documents.some((document) => document.documentType === documentType);

  const statusKey: KYCStatus | 'NOT_STARTED' =
    status === 'PENDING' && documents.length === 0 ? 'NOT_STARTED' : status;
  const statusMeta = STATUS_META[statusKey];

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
            <Card style={styles.statusCard} mode="elevated">
              <Card.Content style={styles.statusContent}>
                <IconBadge icon={statusMeta.icon} color={statusMeta.color} size={64} iconSize={32} />
                <Text variant="titleMedium" style={styles.statusTitle}>
                  {statusMeta.title}
                </Text>
                <Text style={styles.statusSubtitle}>{statusMeta.subtitle}</Text>
              </Card.Content>
            </Card>

            <Text style={styles.sectionLabel}>Required Documents</Text>
            {DOCUMENTS.map((document) => {
              const isUploaded = hasDocument(document.type);
              const isUploading = uploadingKey === document.key;
              return (
                <Card key={document.key} style={styles.documentCard} mode="elevated">
                  <Card.Content style={styles.documentContent}>
                    <IconBadge
                      icon={document.icon}
                      color={isUploaded ? colors.accent : colors.primary}
                      size={44}
                    />
                    <View style={styles.documentMiddle}>
                      <Text style={styles.documentTitle}>{document.title}</Text>
                      <Text style={styles.documentStatus}>
                        {isUploaded ? 'Submitted' : 'Not uploaded'}
                      </Text>
                    </View>
                    {isUploaded ? (
                      <Chip
                        compact
                        icon="check"
                        style={styles.uploadedChip}
                        textStyle={styles.uploadedChipText}
                      >
                        Uploaded
                      </Chip>
                    ) : (
                      <Button
                        mode="contained"
                        buttonColor={colors.primary}
                        icon="upload-outline"
                        compact
                        loading={isUploading}
                        disabled={isUploading}
                        onPress={() => handleUpload(document.key, document.type)}
                      >
                        Upload
                      </Button>
                    )}
                  </Card.Content>
                </Card>
              );
            })}
          </>
        )}
      </ScrollView>

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
    paddingVertical: 20,
  },
  statusTitle: {
    fontWeight: '700',
    color: colors.heading,
    marginTop: 14,
    marginBottom: 6,
  },
  statusSubtitle: {
    color: colors.muted,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.label,
    marginBottom: 10,
  },
  documentCard: {
    borderRadius: 16,
    marginBottom: 12,
  },
  documentContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  documentMiddle: {
    flex: 1,
    marginLeft: 12,
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
  uploadedChip: {
    backgroundColor: `${colors.accent}1F`,
  },
  uploadedChipText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 11,
  },
});
