import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Button, HelperText, Text, TextInput } from 'react-native-paper';
import IconBadge from '../components/IconBadge';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';
import { colors } from '../theme/colors';
import type { RootStackScreenProps } from '../navigation/types';

const SUPPORT_EMAIL = 'eduwallet@gmail.com';

export default function LoginScreen({ navigation }: RootStackScreenProps<'Login'>) {
  const {
    login,
    error,
    clearError,
    suspensionReason: sessionSuspensionReason,
    clearSuspensionReason,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Set only on an ACCOUNT_SUSPENDED login failure — replaces the form with a dedicated
  // suspension screen instead of showing this as a normal inline error. A suspended user
  // must never reach the dashboard, so this is a hard fork at login, not a banner after entry.
  const [suspensionReason, setSuspensionReason] = useState<string | null>(null);

  // Covers both ways a student ends up looking at this screen with a suspension to explain:
  // failing to log in while already suspended (suspensionReason, set below), or getting
  // suspended mid-session and bounced back here by AuthContext (sessionSuspensionReason).
  const effectiveSuspensionReason = suspensionReason ?? sessionSuspensionReason;

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isSubmitting;

  const handleLogin = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      // AppNavigator reacts to the resulting auth state and switches stacks on its own.
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ACCOUNT_SUSPENDED') {
        setSuspensionReason(err.message);
      }
      // Any other error is already surfaced via useAuth().error.
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToLogin = () => {
    setSuspensionReason(null);
    clearSuspensionReason();
    clearError();
  };

  if (effectiveSuspensionReason !== null) {
    return (
      <View style={styles.flex}>
        <StatusBar style="light" />
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView contentContainerStyle={styles.suspendedContainer}>
          <View style={styles.card}>
            <IconBadge icon="lock-alert-outline" color={colors.danger} size={80} iconSize={40} />
            <Text variant="titleLarge" style={styles.suspendedTitle}>
              Your account has been suspended.
            </Text>
            <Text style={styles.suspendedReason}>Reason: {effectiveSuspensionReason}</Text>

            <Button
              mode="contained"
              buttonColor={colors.primary}
              style={styles.suspendedButton}
              contentStyle={styles.suspendedButtonContent}
              onPress={() => navigation.navigate('SupportMessage', { email: email.trim() })}
            >
              Send Message
            </Button>
            <Button
              mode="outlined"
              textColor={colors.primary}
              style={styles.suspendedButton}
              contentStyle={styles.suspendedButtonContent}
              onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
            >
              Email Us
            </Button>
            <Button mode="text" textColor={colors.muted} onPress={handleBackToLogin}>
              Back to Login
            </Button>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.blobTop} pointerEvents="none" />
      <View style={styles.blobTopSmall} pointerEvents="none" />
      <View style={styles.blobBottom} pointerEvents="none" />
      <View style={styles.blobBottomSmall} pointerEvents="none" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoGradient}
            >
              <Image
                source={require('../../assets/icon.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </LinearGradient>

            <Text variant="headlineMedium" style={styles.appName}>
              EduWallet
            </Text>
            <Text style={styles.tagline}>Financial Access for Lebanese Students</Text>

            <View style={styles.form}>
              <TextInput
                mode="outlined"
                label="Email"
                placeholder="you@example.com"
                value={email}
                onChangeText={(text: string) => {
                  setEmail(text);
                  clearError();
                }}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
                left={<TextInput.Icon icon="email-outline" color={colors.primary} />}
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
                style={styles.input}
                theme={{ roundness: 14 }}
              />

              <TextInput
                mode="outlined"
                label="Password"
                placeholder="Enter your password"
                value={password}
                onChangeText={(text: string) => {
                  setPassword(text);
                  clearError();
                }}
                secureTextEntry={secure}
                autoComplete="password"
                textContentType="password"
                left={<TextInput.Icon icon="lock-outline" color={colors.primary} />}
                right={
                  <TextInput.Icon
                    icon={secure ? 'eye-off-outline' : 'eye-outline'}
                    color={colors.muted}
                    onPress={() => setSecure((v) => !v)}
                  />
                }
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
                style={styles.input}
                theme={{ roundness: 14 }}
              />

              <HelperText type="error" visible={Boolean(error)}>
                {error}
              </HelperText>

              <TouchableGradientButton
                label="Log In"
                loading={isSubmitting}
                disabled={!canSubmit}
                onPress={handleLogin}
              />

              <Button
                mode="text"
                textColor={colors.primary}
                style={styles.createAccountLink}
                labelStyle={styles.createAccountLinkLabel}
                onPress={() => navigation.navigate('Register')}
                disabled={isSubmitting}
              >
                Don&apos;t have an account? Create Account
              </Button>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

type TouchableGradientButtonProps = Readonly<{
  label: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}>;

function TouchableGradientButton({ label, loading, disabled, onPress }: TouchableGradientButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled}
      onPress={onPress}
      style={styles.loginButtonWrapper}
    >
      <LinearGradient
        colors={disabled ? [colors.border, colors.border] : [colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.loginButtonContent}
      >
        {loading ? (
          <ActivityIndicator size={18} color={colors.onPrimary} />
        ) : (
          <Text style={[styles.loginButtonLabel, { color: disabled ? colors.muted : colors.onPrimary }]}>
            {label}
          </Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  blobTop: {
    position: 'absolute',
    top: -70,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  blobTopSmall: {
    position: 'absolute',
    top: 60,
    right: -40,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  blobBottom: {
    position: 'absolute',
    bottom: -80,
    right: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  blobBottomSmall: {
    position: 'absolute',
    bottom: 40,
    left: -50,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  logoGradient: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 12,
  },
  appName: {
    fontWeight: '800',
    color: colors.heading,
  },
  tagline: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 4,
    marginBottom: 28,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  loginButtonWrapper: {
    borderRadius: 14,
    marginTop: 8,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 5,
  },
  loginButtonContent: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  createAccountLink: {
    marginTop: 12,
  },
  createAccountLinkLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  suspendedContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  suspendedTitle: {
    fontWeight: '700',
    color: colors.heading,
    textAlign: 'center',
    marginTop: 20,
  },
  suspendedReason: {
    fontSize: 16,
    color: colors.danger,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 28,
    lineHeight: 22,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    overflow: 'hidden',
  },
  suspendedButton: {
    width: '100%',
    borderRadius: 10,
    marginBottom: 12,
  },
  suspendedButtonContent: {
    paddingVertical: 6,
  },
});
