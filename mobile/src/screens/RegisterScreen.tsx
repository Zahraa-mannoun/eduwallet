import { useEffect, useState } from 'react';
import {
  ActivityIndicator as RNActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';
import UserTypeSelector from '../components/UserTypeSelector';
import { useAuth } from '../context/AuthContext';
import type { UserType } from '../context/AuthContext';
import { colors } from '../theme/colors';
import type { RootStackScreenProps } from '../navigation/types';

export default function RegisterScreen({ navigation }: RootStackScreenProps<'Register'>) {
  const { register, error, clearError } = useAuth();
  const [userType, setUserType] = useState<UserType>('STUDENT');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Some platforms (notably iOS) populate autofill suggestions into these fields shortly
  // after mount, bypassing the empty useState() initializers above — force them back to
  // empty once the screen has settled.
  useEffect(() => {
    setFullName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  }, []);

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const formError =
    password.length > 0 && password.length < 8
      ? 'Password must be at least 8 characters'
      : confirmPassword.length > 0 && !passwordsMatch
        ? 'Passwords do not match'
        : null;

  const canSubmit =
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 8 &&
    passwordsMatch &&
    !isSubmitting;

  const handleCreateAccount = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await register({ fullName: fullName.trim(), email: email.trim(), password, userType });
      // AppNavigator reacts to the resulting auth state and switches stacks on its own.
    } catch {
      // error is already surfaced via useAuth().error
    } finally {
      setIsSubmitting(false);
    }
  };

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
      <View style={styles.blobBottom} pointerEvents="none" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.logoGradientWrapper}>
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoGradient}
              >
                <MaterialCommunityIcons name="wallet-outline" size={38} color={colors.onPrimary} />
              </LinearGradient>
            </View>

            <Text variant="headlineMedium" style={styles.appName}>
              Create Account
            </Text>
            <Text style={styles.tagline}>Financial Access for Lebanese Students</Text>

            <View style={styles.form}>
              <Text style={styles.sectionLabel}>I am a...</Text>
              <View style={styles.selectorWrapper}>
                <UserTypeSelector value={userType} onChange={setUserType} />
              </View>

              <TextInput
                mode="outlined"
                label="Full Name"
                placeholder="Your full name"
                value={fullName}
                onChangeText={(text: string) => {
                  setFullName(text);
                  clearError();
                }}
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect={false}
                importantForAutofill="no"
                left={<TextInput.Icon icon="account-outline" color={colors.primary} />}
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
                style={styles.input}
                theme={{ roundness: 14 }}
              />

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
                autoComplete="off"
                textContentType="none"
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
                placeholder="Create a password"
                value={password}
                onChangeText={(text: string) => {
                  setPassword(text);
                  clearError();
                }}
                secureTextEntry={secure}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
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

              <TextInput
                mode="outlined"
                label="Confirm Password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChangeText={(text: string) => {
                  setConfirmPassword(text);
                  clearError();
                }}
                secureTextEntry={secure}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                left={<TextInput.Icon icon="lock-check-outline" color={colors.primary} />}
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

              <HelperText type="error" visible={Boolean(formError || error)}>
                {formError ?? error}
              </HelperText>

              <TouchableOpacity
                activeOpacity={0.85}
                disabled={isSubmitting}
                onPress={handleCreateAccount}
                style={styles.registerButtonWrapper}
              >
                <LinearGradient
                  colors={[colors.gradientStart, colors.gradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.registerButtonContent}
                >
                  {isSubmitting ? (
                    <RNActivityIndicator size={18} color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.registerButtonLabel}>Create Account</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <Button
                mode="text"
                textColor={colors.primary}
                style={styles.loginLink}
                labelStyle={styles.loginLinkLabel}
                onPress={() => navigation.navigate('Login')}
                disabled={isSubmitting}
              >
                Already have an account? Log In
              </Button>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
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
  blobBottom: {
    position: 'absolute',
    bottom: -80,
    right: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.05)',
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
  logoGradientWrapper: {
    marginBottom: 16,
  },
  logoGradient: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
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
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.label,
    marginBottom: 10,
  },
  selectorWrapper: {
    marginBottom: 24,
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  registerButtonWrapper: {
    borderRadius: 14,
    marginTop: 8,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 5,
  },
  registerButtonContent: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  loginLink: {
    marginTop: 12,
  },
  loginLinkLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});
