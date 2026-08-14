import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { ActivityIndicator, Button, Chip, IconButton, Text, TextInput } from 'react-native-paper';
import type { EmailChangeRequest } from '../types/api';
import { useAuth } from '../context/AuthContext';
import ImagePreviewModal from '../components/ImagePreviewModal';
import * as emailChangeService from '../services/emailChangeService';
import { ApiError } from '../services/api';
import { colors } from '../theme/colors';
import type { RootStackScreenProps } from '../navigation/types';

const SCREEN_BACKGROUND = '#F9FAFB';

const STATUS_META: Record<EmailChangeRequest['status'], { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: '#F59E0B' },
  ACCEPTED: { label: 'Accepted', color: colors.accent },
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
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [isProofPreviewVisible, setIsProofPreviewVisible] = useState(false);

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

  // pendingProof stays required even though the button-disabled spec only mentions email/reason
  // — the backend rejects a submission with no proof file outright ("Proof image is required"),
  // so leaving it out here would just let the button submit into a guaranteed server error.
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
      setJustSubmitted(true);
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
    setJustSubmitted(false);
    setCurrentRequest(null);
  };

  const showForm = !currentRequest || currentRequest.status === 'REJECTED';

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroIconCircle}>
            <MaterialCommunityIcons name="email-outline" size={32} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>Request Email Change</Text>
          <Text style={styles.heroSubtitle}>
            Submit a request to update your email address. Admin will review and approve.
          </Text>
        </View>

        {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}

        {isLoading && !currentRequest ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : justSubmitted && currentRequest?.status === 'PENDING' ? (
          <View style={styles.successCard}>
            <View style={styles.successCardRow}>
              <MaterialCommunityIcons name="check-circle" size={20} color={colors.accent} />
              <Text style={styles.successCardText}>
                Request submitted! Admin will review your request.
              </Text>
            </View>
          </View>
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
                <View style={styles.currentEmailCard}>
                  <Text style={styles.cardLabel}>Current Email</Text>
                  <View style={styles.currentEmailRow}>
                    <MaterialCommunityIcons name="email-check-outline" size={18} color={colors.primary} />
                    <Text style={styles.currentEmailText}>{user?.email}</Text>
                  </View>
                  <Text style={styles.currentEmailNote}>
                    Your account is currently linked to this email
                  </Text>
                </View>

                <Text style={styles.inputLabel}>New Email Address</Text>
                <TextInput
                  mode="outlined"
                  placeholder="you@example.com"
                  value={requestedEmail}
                  onChangeText={setRequestedEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  left={<TextInput.Icon icon="email-outline" />}
                  outlineColor={colors.border}
                  activeOutlineColor={colors.primary}
                  theme={{ roundness: 12 }}
                  style={styles.input}
                />

                <Text style={styles.inputLabel}>Reason</Text>
                <TextInput
                  mode="outlined"
                  placeholder="e.g. My current email was suspended by the provider"
                  value={reason}
                  onChangeText={setReason}
                  outlineColor={colors.border}
                  activeOutlineColor={colors.primary}
                  theme={{ roundness: 12 }}
                  style={styles.reasonInput}
                  multiline
                  numberOfLines={4}
                />

                <Text style={styles.inputLabel}>Upload Proof</Text>
                {pendingProof ? (
                  <View style={styles.uploadedBox}>
                    <TouchableOpacity
                      style={styles.uploadedBoxTapArea}
                      activeOpacity={0.7}
                      onPress={() => setIsProofPreviewVisible(true)}
                    >
                      <MaterialCommunityIcons name="check-circle" size={18} color={colors.accent} />
                      <Text style={styles.uploadedFileName} numberOfLines={1}>
                        {pendingProof.name}
                      </Text>
                      <Text style={styles.uploadedPreviewHint}>Preview</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setPendingProof(null)} hitSlop={8}>
                      <MaterialCommunityIcons name="close-circle" size={20} color={colors.muted} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.uploadBox} activeOpacity={0.7} onPress={handlePickProof}>
                    <MaterialCommunityIcons name="cloud-upload-outline" size={28} color={colors.primary} />
                    <Text style={styles.uploadBoxText}>Tap to upload proof document</Text>
                    <Text style={styles.uploadBoxNote}>JPG, PNG accepted</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.infoBanner}>
                  <MaterialCommunityIcons
                    name="information-outline"
                    size={18}
                    color={colors.primaryDark}
                    style={styles.infoBannerIcon}
                  />
                  <Text style={styles.infoBannerText}>
                    Your request will be reviewed by admin within 24-48 hours. You&apos;ll be
                    notified once approved.
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={!canSubmit}
                  onPress={handleSubmit}
                  style={styles.submitButtonWrapper}
                >
                  <LinearGradient
                    colors={canSubmit ? [colors.gradientStart, colors.gradientEnd] : [colors.border, colors.border]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.submitButton}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <MaterialCommunityIcons
                          name="send-outline"
                          size={18}
                          color={canSubmit ? '#FFFFFF' : colors.muted}
                        />
                        <Text style={[styles.submitButtonText, { color: canSubmit ? '#FFFFFF' : colors.muted }]}>
                          Submit Request
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {submitError ? (
                  <View style={styles.errorBanner}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={16} color={colors.danger} />
                    <Text style={styles.errorBannerText}>{submitError}</Text>
                  </View>
                ) : null}
              </>
            )}
          </>
        ) : null}
      </ScrollView>

      <ImagePreviewModal
        visible={isProofPreviewVisible}
        uri={pendingProof?.uri ?? null}
        title={pendingProof?.name}
        onClose={() => setIsProofPreviewVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: SCREEN_BACKGROUND,
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
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 20,
  },
  heroIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${colors.primary}1F`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.heading,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 12,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
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
  successCard: {
    backgroundColor: `${colors.accent}1A`,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  successCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  successCardText: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#065F46',
    lineHeight: 20,
    marginLeft: 8,
  },
  rejectedNotice: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  newRequestButton: {
    marginTop: 8,
  },
  currentEmailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  currentEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentEmailText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.heading,
    marginLeft: 8,
  },
  currentEmailNote: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    marginBottom: 14,
  },
  reasonInput: {
    backgroundColor: '#FFFFFF',
    minHeight: 100,
    marginBottom: 14,
  },
  uploadBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 24,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  uploadBoxText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.heading,
    marginTop: 8,
  },
  uploadBoxNote: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
  },
  uploadedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: `${colors.accent}0D`,
    marginBottom: 16,
  },
  uploadedBoxTapArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadedFileName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.heading,
    marginLeft: 8,
    marginRight: 8,
  },
  uploadedPreviewHint: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    marginRight: 8,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: `${colors.primary}14`,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  infoBannerIcon: {
    marginRight: 8,
    marginTop: 1,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.primaryDark,
    lineHeight: 17,
  },
  submitButtonWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 16,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.danger}14`,
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  errorBannerText: {
    fontSize: 12,
    color: colors.danger,
    marginLeft: 8,
    flexShrink: 1,
  },
});
