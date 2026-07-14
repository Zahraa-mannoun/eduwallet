import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Chip, IconButton, Snackbar, Text } from 'react-native-paper';
import QRCode from 'react-native-qrcode-svg';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import IconBadge from '../components/IconBadge';
import { colors } from '../theme/colors';
import { generateMockHash, truncateHash } from '../utils/generateMockHash';
import type { RootStackScreenProps } from '../navigation/types';

type DocumentType = 'Degree' | 'Transcript' | 'Certificate';

type VaultDocument = {
  id: string;
  name: string;
  type: DocumentType;
  uploadDate: string;
  hash: string;
  verified: boolean;
};

const DOC_TYPE_ICONS: Record<DocumentType, keyof typeof MaterialCommunityIcons.glyphMap> = {
  Degree: 'school-outline',
  Transcript: 'file-document-outline',
  Certificate: 'file-certificate-outline',
};

const DOC_TYPE_ROTATION: DocumentType[] = ['Degree', 'Transcript', 'Certificate'];

const INITIAL_DOCUMENTS: VaultDocument[] = [
  {
    id: 'DOC-1',
    name: 'Bachelor Degree.pdf',
    type: 'Degree',
    uploadDate: '2026-06-01T10:00:00',
    hash: generateMockHash(),
    verified: true,
  },
  {
    id: 'DOC-2',
    name: 'Fall 2025 Transcript.pdf',
    type: 'Transcript',
    uploadDate: '2026-06-15T09:30:00',
    hash: generateMockHash(),
    verified: false,
  },
];

const formatDate = (isoDate: string) =>
  new Date(isoDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

export default function BlockchainVaultScreen({ navigation }: RootStackScreenProps<'BlockchainVault'>) {
  const [documents, setDocuments] = useState<VaultDocument[]>(INITIAL_DOCUMENTS);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const handleUpload = () => {
    const type = DOC_TYPE_ROTATION[documents.length % DOC_TYPE_ROTATION.length];
    const newDocument: VaultDocument = {
      id: `DOC-${Date.now().toString(36).toUpperCase()}`,
      name: `${type} - ${new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })}.pdf`,
      type,
      uploadDate: new Date().toISOString(),
      hash: generateMockHash(),
      verified: false,
    };
    setDocuments((prev) => [newDocument, ...prev]);
    setSnackbarMessage('Document stored on blockchain.');
  };

  const handleVerify = (id: string) => {
    setDocuments((prev) =>
      prev.map((document) => (document.id === id ? { ...document, verified: true } : document))
    );
    setSnackbarMessage('Authentic — hash matches the blockchain record.');
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
        <Button
          mode="contained"
          buttonColor={colors.primary}
          icon="cloud-upload-outline"
          style={styles.uploadButton}
          contentStyle={styles.uploadButtonContent}
          onPress={handleUpload}
        >
          Upload Document
        </Button>

        {documents.map((document) => {
          const qrValue = `eduwallet://verify?hash=${document.hash}`;
          return (
            <Card key={document.id} style={styles.documentCard} mode="elevated">
              <Card.Content>
                <View style={styles.docHeaderRow}>
                  <IconBadge icon={DOC_TYPE_ICONS[document.type]} color={colors.primary} size={44} />
                  <View style={styles.docHeaderMiddle}>
                    <Text style={styles.docName}>{document.name}</Text>
                    <View style={styles.docMetaRow}>
                      <Chip compact style={styles.typeChip} textStyle={styles.typeChipText}>
                        {document.type}
                      </Chip>
                      <Text style={styles.docDate}>{formatDate(document.uploadDate)}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.hashRow}>
                  <Text style={styles.hashLabel}>SHA-256</Text>
                  <Text style={styles.hashValue}>{truncateHash(document.hash)}</Text>
                </View>

                <Chip
                  compact
                  icon="cube-outline"
                  style={styles.storedChip}
                  textStyle={styles.storedChipText}
                >
                  Stored on Blockchain
                </Chip>

                <View style={styles.footerRow}>
                  <View style={styles.qrWrapper}>
                    <QRCode value={qrValue} size={64} color={colors.heading} backgroundColor={colors.background} />
                  </View>

                  {document.verified ? (
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
                      onPress={() => handleVerify(document.id)}
                    >
                      Verify
                    </Button>
                  )}
                </View>
              </Card.Content>
            </Card>
          );
        })}
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
});
