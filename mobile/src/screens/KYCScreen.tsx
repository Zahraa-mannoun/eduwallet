import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Chip, IconButton, Text } from 'react-native-paper';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import IconBadge from '../components/IconBadge';
import { colors } from '../theme/colors';
import type { RootStackScreenProps } from '../navigation/types';

type KYCStatus = 'NOT_STARTED' | 'PENDING' | 'VERIFIED';

const STATUS_META: Record<KYCStatus, { title: string; subtitle: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string }> = {
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
};

type DocumentKey = 'studentId' | 'enrollmentCertificate';

const DOCUMENTS: { key: DocumentKey; title: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; filename: string }[] = [
  { key: 'studentId', title: 'Student ID', icon: 'card-account-details-outline', filename: 'student_id.jpg' },
  { key: 'enrollmentCertificate', title: 'Enrollment Certificate', icon: 'file-certificate-outline', filename: 'enrollment_certificate.pdf' },
];

export default function KYCScreen({ navigation }: RootStackScreenProps<'KYC'>) {
  const [uploaded, setUploaded] = useState<Record<DocumentKey, boolean>>({
    studentId: false,
    enrollmentCertificate: false,
  });
  const [status, setStatus] = useState<KYCStatus>('NOT_STARTED');

  const allUploaded = uploaded.studentId && uploaded.enrollmentCertificate;

  useEffect(() => {
    if (allUploaded && status === 'NOT_STARTED') {
      setStatus('PENDING');
    }
  }, [allUploaded, status]);

  const handleUpload = (key: DocumentKey) => {
    setUploaded((prev) => ({ ...prev, [key]: true }));
  };

  const statusMeta = STATUS_META[status];

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
        <Text variant="titleLarge" style={styles.headerTitle}>
          University Verification
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
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
          const isUploaded = uploaded[document.key];
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
                    {isUploaded ? document.filename : 'Not uploaded'}
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
                    onPress={() => handleUpload(document.key)}
                  >
                    Upload
                  </Button>
                )}
              </Card.Content>
            </Card>
          );
        })}

        {status === 'PENDING' ? (
          <Button
            mode="outlined"
            textColor={colors.primary}
            icon="check-decagram-outline"
            style={styles.simulateButton}
            onPress={() => setStatus('VERIFIED')}
          >
            Simulate University Approval (Demo)
          </Button>
        ) : null}
      </ScrollView>
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
  simulateButton: {
    borderRadius: 10,
    borderColor: colors.primary,
    marginTop: 12,
  },
});
