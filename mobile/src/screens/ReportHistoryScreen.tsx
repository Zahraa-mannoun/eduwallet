import { useCallback, useState } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Sharing from 'expo-sharing';
import { ActivityIndicator, Button, Card, Chip, Divider, IconButton, Text } from 'react-native-paper';
import type { ReportPeriod, ReportRequest, ReportStatus } from '../types/api';
import IconBadge from '../components/IconBadge';
import * as reportService from '../services/reportService';
import { ApiError } from '../services/api';
import { colors } from '../theme/colors';
import type { RootStackScreenProps } from '../navigation/types';

const PERIOD_LABELS: Record<ReportPeriod, string> = {
  LAST_WEEK: 'Last Week',
  LAST_MONTH: 'Last Month',
  LAST_YEAR: 'Last Year',
  LAST_2_YEARS: 'Last 2 Years',
};

// GENERATED is an admin-only preview state — from the parent's perspective it's no different
// from PENDING, since the report isn't downloadable until the admin explicitly sends it.
const STATUS_META: Record<ReportStatus, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: '#F59E0B' },
  GENERATED: { label: 'Pending', color: '#F59E0B' },
  SENT: { label: 'Ready', color: colors.accent },
};

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ReportHistoryScreen({
  navigation,
}: Readonly<RootStackScreenProps<'ReportHistory'>>) {
  const [reports, setReports] = useState<ReportRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await reportService.getMyReports();
      setReports(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load your reports.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleDownload = async (report: ReportRequest) => {
    // The Download button itself only renders for SENT reports (below), but this guard is a
    // second line of defense against a stale list (e.g. tapping right as an admin un-sends it) —
    // GENERATED/PENDING reports 400 on the backend anyway, so catch it before even trying.
    if (report.status !== 'SENT') {
      setDownloadError('Report not yet sent by admin');
      return;
    }

    setDownloadingId(report.id);
    setDownloadError(null);
    try {
      const uri = await reportService.downloadReportPdf(report.id);
      console.log('Report downloaded to', uri);
      // On web the browser's own download prompt already ran as part of downloadReportPdf —
      // there's no local file to hand off to Sharing, and navigator.share can't take a blob: URI.
      if (Platform.OS !== 'web') {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
        } else {
          console.log('Sharing is not available on this platform — file was saved but not shared');
          setDownloadError('Downloaded, but sharing is not available on this device.');
        }
      }
    } catch (err) {
      // File.downloadFileAsync throws a plain Error (not the ApiError apiRequest() produces),
      // so the previous `err instanceof ApiError` check here always fell through to the generic
      // message below regardless of what actually went wrong — logging and surfacing err.message
      // is what makes the real cause (auth, network, 404/400 from the server) visible at all.
      console.error('Report download failed', err);
      const message =
        err instanceof ApiError || err instanceof Error ? err.message : 'Could not download this report.';
      setDownloadError(message);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
        <Text variant="titleLarge" style={styles.headerTitle}>
          My Reports
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} />}
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {downloadError ? <Text style={styles.errorText}>{downloadError}</Text> : null}

        {isLoading && reports.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : reports.length > 0 ? (
          reports.map((report) => {
            const statusMeta = STATUS_META[report.status];
            return (
              <Card key={report.id} style={styles.card} mode="elevated">
                <Card.Content style={styles.cardContent}>
                  <IconBadge icon="file-document-outline" color={colors.primary} size={44} />
                  <View style={styles.cardMiddle}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {report.student.fullName}
                    </Text>
                    <Text style={styles.rowSubtitle}>{PERIOD_LABELS[report.period]}</Text>
                    <Text style={styles.rowDate}>Requested {formatDate(report.createdAt)}</Text>
                  </View>
                  <Chip
                    compact
                    style={[styles.statusChip, { backgroundColor: `${statusMeta.color}1F` }]}
                    textStyle={{ color: statusMeta.color, fontSize: 11, fontWeight: '700' }}
                  >
                    {statusMeta.label}
                  </Chip>
                </Card.Content>

                {report.status === 'SENT' ? (
                  <>
                    <Divider />
                    <Card.Actions style={styles.cardActions}>
                      <Button
                        mode="contained-tonal"
                        icon="download"
                        loading={downloadingId === report.id}
                        disabled={downloadingId === report.id}
                        onPress={() => void handleDownload(report)}
                        style={styles.downloadButton}
                        contentStyle={styles.downloadButtonContent}
                      >
                        Download
                      </Button>
                    </Card.Actions>
                  </>
                ) : null}
              </Card>
            );
          })
        ) : (
          <Text style={styles.emptyText}>
            No report requests yet. Request a history report from your profile.
          </Text>
        )}
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
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  loading: {
    marginTop: 24,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginBottom: 14,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
  },
  cardMiddle: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  rowTitle: {
    fontWeight: '700',
    color: colors.heading,
    fontSize: 14,
    lineHeight: 19,
  },
  rowSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
    lineHeight: 16,
  },
  rowDate: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
    lineHeight: 15,
  },
  statusChip: {
    height: 26,
    marginTop: 2,
  },
  cardActions: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  downloadButton: {
    flex: 1,
    borderRadius: 10,
  },
  downloadButtonContent: {
    paddingVertical: 2,
  },
});
