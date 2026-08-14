import { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, IconButton, Snackbar, Switch, Text, TextInput } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import * as authService from '../services/authService';
import * as cardService from '../services/cardService';
import { ApiError } from '../services/api';
import { colors } from '../theme/colors';
import type { RootStackScreenProps } from '../navigation/types';

const SCREEN_BACKGROUND = '#F9FAFB';

function ChangePasswordSection() {
  const { logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    confirmPassword.length > 0 &&
    !isSubmitting &&
    !succeeded;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      setSucceeded(true);
      // Changing the password revokes this session's refresh token server-side — sign out
      // shortly after showing confirmation, rather than waiting for the next silent refresh to
      // fail unexpectedly.
      setTimeout(() => {
        void logout();
      }, 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change your password.');
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Text style={styles.sectionLabel}>Security</Text>
      <View style={styles.settingCard}>
        <View style={styles.cardHeaderRow}>
          <View style={[styles.rowIconCircle, { backgroundColor: `${colors.primary}1F` }]}>
            <MaterialCommunityIcons name="lock-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.cardHeaderText}>Change Password</Text>
        </View>

        <Text style={styles.inputLabel}>Current password</Text>
        <TextInput
          mode="outlined"
          placeholder="Enter current password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry={secure}
          right={
            <TextInput.Icon
              icon={secure ? 'eye-off-outline' : 'eye-outline'}
              onPress={() => setSecure((v) => !v)}
            />
          }
          outlineColor={colors.border}
          activeOutlineColor={colors.primary}
          theme={{ roundness: 12 }}
          style={styles.passwordInput}
        />

        <Text style={styles.inputLabel}>New password</Text>
        <TextInput
          mode="outlined"
          placeholder="At least 8 characters"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry={secure}
          right={
            <TextInput.Icon
              icon={secure ? 'eye-off-outline' : 'eye-outline'}
              onPress={() => setSecure((v) => !v)}
            />
          }
          outlineColor={colors.border}
          activeOutlineColor={colors.primary}
          theme={{ roundness: 12 }}
          style={styles.passwordInput}
        />

        <Text style={styles.inputLabel}>Confirm new password</Text>
        <TextInput
          mode="outlined"
          placeholder="Re-enter new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={secure}
          right={
            <TextInput.Icon
              icon={secure ? 'eye-off-outline' : 'eye-outline'}
              onPress={() => setSecure((v) => !v)}
            />
          }
          outlineColor={colors.border}
          activeOutlineColor={colors.primary}
          theme={{ roundness: 12 }}
          style={styles.passwordInput}
        />

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!canSubmit}
          onPress={handleSubmit}
          style={styles.gradientButtonWrapper}
        >
          <LinearGradient
            colors={canSubmit ? [colors.gradientStart, colors.gradientEnd] : [colors.border, colors.border]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientButton}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="lock-check-outline"
                  size={18}
                  color={canSubmit ? '#FFFFFF' : colors.muted}
                />
                <Text style={[styles.gradientButtonText, { color: canSubmit ? '#FFFFFF' : colors.muted }]}>
                  Update Password
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {succeeded ? (
          <View style={styles.successBanner}>
            <MaterialCommunityIcons name="check-circle" size={16} color={colors.accent} />
            <Text style={styles.successBannerText}>Password updated successfully</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBanner}>
            <MaterialCommunityIcons name="alert-circle-outline" size={16} color={colors.danger} />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : null}
      </View>
    </>
  );
}

export default function AccountSettingsScreen({
  navigation,
}: Readonly<RootStackScreenProps<'AccountSettings'>>) {
  const { user, refreshUser } = useAuth();
  const [cardAutoRenew, setCardAutoRenew] = useState(user?.cardAutoRenew ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const handleToggleCardAutoRenew = async (next: boolean) => {
    setCardAutoRenew(next);
    setIsSaving(true);
    try {
      await cardService.updateCardAutoRenew(next);
      await refreshUser();
      setSnackbarMessage(next ? 'Auto-renew turned on.' : 'Auto-renew turned off.');
    } catch (err) {
      setCardAutoRenew(!next);
      setSnackbarMessage(err instanceof ApiError ? err.message : 'Could not update this setting.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroIconCircle}>
            <MaterialCommunityIcons name="cog-outline" size={32} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>Account Settings</Text>
          <Text style={styles.heroSubtitle}>Manage your account security and email</Text>
        </View>

        {user?.userType === 'STUDENT' && (
          <>
            <Text style={styles.sectionLabel}>Card Settings</Text>
            <View style={styles.settingCard}>
              <View style={styles.settingRow}>
                <View style={[styles.rowIconCircle, { backgroundColor: `${colors.primary}1F` }]}>
                  <MaterialCommunityIcons name="credit-card-outline" size={19} color={colors.primary} />
                </View>
                <View style={styles.settingTextColumn}>
                  <Text style={styles.settingTitle}>Auto-renew cards</Text>
                  <Text style={styles.settingDescription}>
                    {cardAutoRenew
                      ? 'Used cards are automatically deleted after use. Generate a new card manually when needed.'
                      : 'Used cards are frozen after use and can be reused for the same category.'}
                  </Text>
                </View>
                <Switch
                  value={cardAutoRenew}
                  onValueChange={handleToggleCardAutoRenew}
                  disabled={isSaving}
                  color={colors.primary}
                />
              </View>
            </View>
          </>
        )}

        <ChangePasswordSection />

        {user?.userType !== 'ADMIN' && (
          <>
            <Text style={styles.sectionLabel}>Account Email</Text>
            <TouchableOpacity
              style={styles.settingCard}
              onPress={() => navigation.navigate('EmailChangeRequest')}
            >
              <View style={styles.settingRow}>
                <View style={[styles.rowIconCircle, { backgroundColor: `${colors.primary}1F` }]}>
                  <MaterialCommunityIcons name="email-outline" size={19} color={colors.primary} />
                </View>
                <View style={styles.settingTextColumn}>
                  <Text style={styles.settingTitle}>Request Email Change</Text>
                  <Text style={styles.settingDescription}>
                    Submit a request to change the email address on your account, with proof for
                    admin review.
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color={colors.primary} />
              </View>
            </TouchableOpacity>
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
    paddingBottom: 32,
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
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  settingCard: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingTextColumn: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontWeight: '700',
    color: colors.heading,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.heading,
    marginLeft: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: 6,
  },
  passwordInput: {
    backgroundColor: colors.inputBackground,
    marginBottom: 12,
  },
  gradientButtonWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 4,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 16,
  },
  gradientButtonText: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.accent}1A`,
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  successBannerText: {
    flexShrink: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#065F46',
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
