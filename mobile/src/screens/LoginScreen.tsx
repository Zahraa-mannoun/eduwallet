import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
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
        <ScrollView contentContainerStyle={styles.suspendedContainer}>
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
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text variant="headlineMedium" style={styles.appName}>
          EduWallet
        </Text>
        <Text style={styles.tagline}>Financial Access for Lebanese Students</Text>

        <View style={styles.form}>
          <TextInput
            mode="outlined"
            label="Email"
            placeholder="you@university.edu.lb"
            value={email}
            onChangeText={(text: string) => {
              setEmail(text);
              clearError();
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            left={<TextInput.Icon icon="email-outline" />}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            style={styles.input}
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
            left={<TextInput.Icon icon="lock-outline" />}
            right={
              <TextInput.Icon
                icon={secure ? 'eye-off-outline' : 'eye-outline'}
                onPress={() => setSecure((v) => !v)}
              />
            }
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            style={styles.input}
          />

          <HelperText type="error" visible={Boolean(error)}>
            {error}
          </HelperText>

          <Button
            mode="contained"
            buttonColor={colors.primary}
            style={styles.loginButton}
            contentStyle={styles.loginButtonContent}
            onPress={handleLogin}
            disabled={!canSubmit}
          >
            {isSubmitting ? <ActivityIndicator size={18} color={colors.onPrimary} /> : 'Log In'}
          </Button>

          <Button
            mode="text"
            textColor={colors.primary}
            style={styles.createAccountLink}
            onPress={() => navigation.navigate('Register')}
            disabled={isSubmitting}
          >
            Don&apos;t have an account? Create Account
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 16,
    marginBottom: 8,
  },
  appName: {
    fontWeight: '700',
    color: colors.heading,
  },
  tagline: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 4,
    marginBottom: 24,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  input: {
    marginBottom: 16,
    backgroundColor: colors.inputBackground,
  },
  loginButton: {
    borderRadius: 10,
    marginTop: 8,
  },
  loginButtonContent: {
    paddingVertical: 6,
  },
  createAccountLink: {
    marginTop: 12,
  },
  suspendedContainer: {
    flexGrow: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
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
