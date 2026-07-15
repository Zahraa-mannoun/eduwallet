import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Dialog,
  IconButton,
  Portal,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import QRCode from 'react-native-qrcode-svg';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { AcademicDocument } from '../types/api';
import IconBadge from '../components/IconBadge';
import { colors } from '../theme/colors';
import * as blockchainService from '../services/blockchainService';
import { ApiError } from '../services/api';
import type { RootStackScreenProps } from '../navigation/types';

type DocumentType = 'DEGREE' | 'TRANSCRIPT' | 'CERTIFICATE';

const DOC_TYPES: { key: DocumentType; label: string }[] = [
  { key: 'DEGREE', label: 'Degree' },
  { key: 'TRANSCRIPT', label: 'Transcript' },
  { key: 'CERTIFICATE', label: 'Certificate' },
];

const DOC_TYPE_ICONS: Record<DocumentType, keyof typeof MaterialCommunityIcons.glyphMap> = {
  DEGREE: 'school-outline',
  TRANSCRIPT: 'file-document-outline',
  CERTIFICATE: 'file-certificate-outline',
};

const formatDate = (isoDate: string) =>
  new Date(isoDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

function truncateHash(hash: string): string {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

type PendingUpload = { uri: string; name: string; mimeType: string };

export default function BlockchainVaultScreen({
  navigation,
}: Readonly<RootStackScreenProps<'BlockchainVault'>>) {
  const [documents, setDocuments] = useState<AcademicDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  const [documentName, setDocumentName] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('DEGREE');
  const [isUploading, setIsUploading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await blockchainService.getDocuments();
      setDocuments(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load your documents.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePick = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    setPendingUpload({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/octet-stream' });
    setDocumentName(asset.name);
    setDocumentType('DEGREE');
  };

  const handleConfirmUpload = async () => {
    if (!pendingUpload || !documentName.trim()) return;
    setIsUploading(true);
    try {
      await blockchainService.uploadDocument({
        fileUri: pendingUpload.uri,
        fileName: pendingUpload.name,
        fileType: pendingUpload.mimeType,
        documentName: documentName.trim(),
        documentType,
      });
      setPendingUpload(null);
      setSnackbarMessage('Document stored on blockchain.');
      await load();
    } catch (err) {
      setSnackbarMessage(err instanceof ApiError ? err.message : 'Could not upload that document.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleVerify = async (document: AcademicDocument) => {
    if (!document.sha256Hash) return;
    setVerifyingId(document.id);
    try {
      const result = await blockchainService.verifyDocument(document.sha256Hash);
      if (result.status === 'AUTHENTIC') {
        setVerifiedIds((prev) => new Set(prev).add(document.id));
        setSnackbarMessage('Authentic — hash matches the blockchain record.');
      } else {
        setSnackbarMessage('No matching blockchain record found.');
      }
    } catch (err) {
      setSnackbarMessage(err instanceof ApiError ? err.message : 'Could not verify that document.');
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
        <Text variant="titleLarge" style={styles.headerTitle}>
          Blockchain Vault
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button
          mode="contained"
          buttonColor={colors.primary}
          icon="cloud-upload-outline"
          style={styles.uploadButton}
          contentStyle={styles.uploadButtonContent}
          onPress={handlePick}
        >
          Upload Document
        </Button>

        {isLoading && documents.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : (
          documents.map((document) => {
            const type = (document.documentType ?? 'CERTIFICATE') as DocumentType;
            const isVerified = verifiedIds.has(document.id);
            const qrValue = document.sha256Hash ? `eduwallet://verify?hash=${document.sha256Hash}` : '';

            return (
              <Card key={document.id} style={styles.documentCard} mode="elevated">
                <Card.Content>
                  <View style={styles.docHeaderRow}>
                    <IconBadge icon={DOC_TYPE_ICONS[type] ?? 'file-outline'} color={colors.primary} size={44} />
                    <View style={styles.docHeaderMiddle}>
                      <Text style={styles.docName}>{document.documentName ?? document.fileName}</Text>
                      <View style={styles.docMetaRow}>
                        <Chip compact style={styles.typeChip} textStyle={styles.typeChipText}>
                          {type}
                        </Chip>
                        <Text style={styles.docDate}>{formatDate(document.createdAt)}</Text>
                      </View>
                    </View>
                  </View>

                  {document.sha256Hash ? (
                    <View style={styles.hashRow}>
                      <Text style={styles.hashLabel}>SHA-256</Text>
                      <Text style={styles.hashValue}>{truncateHash(document.sha256Hash)}</Text>
                    </View>
                  ) : null}

                  <Chip
                    compact
                    icon="cube-outline"
                    style={styles.storedChip}
                    textStyle={styles.storedChipText}
                  >
                    Stored on Blockchain
                  </Chip>

                  <View style={styles.footerRow}>
                    {qrValue ? (
                      <View style={styles.qrWrapper}>
                        <QRCode value={qrValue} size={64} color={colors.heading} backgroundColor={colors.background} />
                      </View>
                    ) : (
                      <View />
                    )}

                    {isVerified ? (
                      <Chip
                        compact
                        icon="check-decagram"
                        style={styles.verifiedChip}
                        textStyle={styles.verifiedChipText}
                      >
                        Authentic
                      </Chip>
                    ) : (
                      <Button
                        mode="outlined"
                        textColor={colors.primary}
                        icon="link-variant"
                        loading={verifyingId === document.id}
                        disabled={verifyingId === document.id}
                        onPress={() => handleVerify(document)}
                      >
                        Verify
                      </Button>
                    )}
                  </View>
                </Card.Content>
              </Card>
            );
          })
        )}
      </ScrollView>

      <Portal>
        <Dialog visible={pendingUpload !== null} onDismiss={() => setPendingUpload(null)}>
          <Dialog.Title>Upload Document</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Document name"
              value={documentName}
              onChangeText={(text: string) => setDocumentName(text)}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              style={styles.dialogInput}
            />
            <View style={styles.typeChipsRow}>
              {DOC_TYPES.map((type) => (
                <Chip
                  key={type.key}
                  selected={documentType === type.key}
                  onPress={() => setDocumentType(type.key)}
                  style={styles.typeChoiceChip}
                >
                  {type.label}
                </Chip>
              ))}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPendingUpload(null)} disabled={isUploading}>
              Cancel
            </Button>
            <Button onPress={handleConfirmUpload} disabled={!documentName.trim() || isUploading}>
              {isUploading ? <ActivityIndicator size={16} color={colors.primary} /> : 'Upload'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

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
    marginTop: 24,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  uploadButton: {
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 20,
  },
  uploadButtonContent: {
    paddingVertical: 6,
  },
  documentCard: {
    borderRadius: 16,
    marginBottom: 16,
  },
  docHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  docHeaderMiddle: {
    flex: 1,
    marginLeft: 12,
  },
  docName: {
    fontWeight: '700',
    color: colors.heading,
    marginBottom: 4,
  },
  docMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeChip: {
    height: 24,
    backgroundColor: colors.surface,
    marginRight: 8,
  },
  typeChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.label,
  },
  docDate: {
    fontSize: 12,
    color: colors.muted,
  },
  hashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  hashLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
  },
  hashValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.heading,
    letterSpacing: 0.5,
  },
  storedChip: {
    alignSelf: 'flex-start',
    backgroundColor: `${colors.accent}1F`,
    marginBottom: 14,
  },
  storedChipText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qrWrapper: {
    padding: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  verifiedChip: {
    backgroundColor: `${colors.accent}1F`,
  },
  verifiedChipText: {
    color: colors.accent,
    fontWeight: '700',
  },
  dialogInput: {
    marginBottom: 12,
  },
  typeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChoiceChip: {
    marginRight: 4,
  },
});
