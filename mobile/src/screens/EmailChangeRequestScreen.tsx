import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { ActivityIndicator, Button, Chip, IconButton, Text, TextInput } from 'react-native-paper';
import type { EmailChangeRequest } from '../types/api';
import { useAuth } from '../context/AuthContext';
import * as emailChangeService from '../services/emailChangeService';
import { ApiError } from '../services/api';
import { colors } from '../theme/colors';
import type { RootStackScreenProps } from '../navigation/types';

const STATUS_META: Record<EmailChangeRequest['status'], { label: string; color: string }> = {
  PENDING: { label: 'Pending Review', color: '#F59E0B' },
  ACCEPTED: { label: 'Approved', color: colors.accent },
  REJECTED: { label: 'Rejected', color: colors.danger },
};

export default function EmailChangeRequestScreen({
  navigation,
}: Readonly<RootStackScreenProps<'EmailChangeRequest'>>) {
  const { user, logout } = useAuth();

  const [currentRequest, setCurrentRequest] = useState<EmailChangeRequest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [requestedEmail, setRequestedEmail] = useState('');
  const [reason, setReason] = useState('');
  const [pendingProof, setPendingProof] = useState<{
    uri: string;
    name: string;
    mimeType: string;
    file?: File;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await emailChangeService.getMyRequest();
      setCurrentRequest(result);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load your request.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // ACCEPTED means the backend already changed the account's email and revoked this
  // session's refresh token — sign out now rather than waiting for the next silent
  // refresh to fail unexpectedly (same reasoning as ChangePasswordSection).
  useEffect(() => {
    if (currentRequest?.status !== 'ACCEPTED') return;
    const timeout = setTimeout(() => {
      void logout();
    }, 2500);
    return () => clearTimeout(timeout);
  }, [currentRequest?.status, logout]);

  const handlePickProof = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    setPendingProof({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? 'image/jpeg',
      file: asset.file,
    });
  };

  const canSubmit =
    requestedEmail.trim().length > 0 &&
    reason.trim().length > 0 &&
    pendingProof !== null &&
    !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit || !pendingProof) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const created = await emailChangeService.requestEmailChange({
        requestedEmail: requestedEmail.trim(),
        reason: reason.trim(),
        fileUri: pendingProof.uri,
        fileName: pendingProof.name,
        fileType: pendingProof.mimeType,
        file: pendingProof.file,
      });
      setCurrentRequest(created);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Could not submit your request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setRequestedEmail('');
    setReason('');
    setPendingProof(null);
    setSubmitError(null);
    setCurrentRequest(null);
  };

  const showForm = !currentRequest || currentRequest.status === 'REJECTED';

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
        <Text variant="titleLarge" style={styles.headerTitle}>
          Request Email Change
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}

        {isLoading && !currentRequest ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : currentRequest?.status === 'PENDING' ? (
          <View style={styles.statusCard}>
            <Chip
              compact
              style={[styles.statusChip, { backgroundColor: `${STATUS_META.PENDING.color}1F` }]}
              textStyle={{ color: STATUS_META.PENDING.color, fontWeight: '700' }}
            >
              {STATUS_META.PENDING.label}
            </Chip>
            <Text style={styles.statusText}>
              Your email change request is pending admin review. Requested email:{' '}
              <Text style={styles.statusEmail}>{currentRequest.requestedEmail}</Text>
            </Text>
          </View>
        ) : currentRequest?.status === 'ACCEPTED' ? (
          <View style={styles.statusCard}>
            <Chip
              compact
              style={[styles.statusChip, { backgroundColor: `${STATUS_META.ACCEPTED.color}1F` }]}
              textStyle={{ color: STATUS_META.ACCEPTED.color, fontWeight: '700' }}
            >
              {STATUS_META.ACCEPTED.label}
            </Chip>
            <Text style={styles.statusText}>
              Your email has been changed to{' '}
              <Text style={styles.statusEmail}>{currentRequest.requestedEmail}</Text>. Please log
              in again.
            </Text>
            <ActivityIndicator color={colors.primary} style={styles.loading} />
          </View>
        ) : null}

        {showForm ? (
          <>
            {currentRequest?.status === 'REJECTED' ? (
              <View style={styles.rejectedNotice}>
                <Chip
                  compact
                  style={[styles.statusChip, { backgroundColor: `${STATUS_META.REJECTED.color}1F` }]}
                  textStyle={{ color: STATUS_META.REJECTED.color, fontWeight: '700' }}
                >
                  {STATUS_META.REJECTED.label}
                </Chip>
                <Text style={styles.statusText}>
                  Your previous email change request was rejected. Please contact support for more
                  information, or submit a new request below.
                </Text>
                <Button mode="text" onPress={resetForm} style={styles.newRequestButton}>
                  Start a New Request
                </Button>
              </View>
            ) : null}

            {(!currentRequest || currentRequest.status === 'REJECTED') && (
              <>
                <Text style={styles.fieldLabel}>Current Email</Text>
                <Text style={styles.currentEmail}>{user?.email}</Text>

                <TextInput
                  mode="outlined"
                  label="New email address"
                  value={requestedEmail}
                  onChangeText={setRequestedEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  outlineColor={colors.border}
                  activeOutlineColor={colors.primary}
                  style={styles.input}
                />

                <TextInput
                  mode="outlined"
                  label="Reason"
                  placeholder="e.g. My university email was deactivated"
                  value={reason}
                  onChangeText={setReason}
                  outlineColor={colors.border}
                  activeOutlineColor={colors.primary}
                  style={styles.input}
                  multiline
                />

                <Button
                  mode="outlined"
                  icon="camera-outline"
                  style={styles.input}
                  onPress={handlePickProof}
                >
                  {pendingProof ? pendingProof.name : 'Upload Proof'}
                </Button>

                {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

                <Button
                  mode="contained"
                  buttonColor={colors.primary}
                  style={styles.submitButton}
                  contentStyle={styles.submitButtonContent}
                  disabled={!canSubmit}
                  loading={isSubmitting}
                  onPress={handleSubmit}
                >
                  Submit Request
                </Button>
              </>
            )}
          </>
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
    paddingTop: 8,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  loading: {
    marginTop: 16,
  },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  statusChip: {
    height: 28,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 19,
  },
  statusEmail: {
    fontWeight: '700',
    color: colors.heading,
  },
  rejectedNotice: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  newRequestButton: {
    marginTop: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.label,
    marginBottom: 4,
  },
  currentEmail: {
    fontSize: 14,
    color: colors.heading,
    marginBottom: 16,
  },
  input: {
    backgroundColor: colors.inputBackground,
    marginBottom: 12,
  },
  submitButton: {
    borderRadius: 10,
    marginTop: 4,
  },
  submitButtonContent: {
    paddingVertical: 6,
  },
});
