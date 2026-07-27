import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { ActivityIndicator, Button, HelperText, Text, TextInput } from 'react-native-paper';
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
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
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
            left={<TextInput.Icon icon="account-outline" />}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            style={styles.input}
          />

          <TextInput
            mode="outlined"
            label="University Email"
            placeholder="you@university.edu.lb"
            value={email}
            onChangeText={(text: string) => {
              setEmail(text);
              clearError();
            }}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            importantForAutofill="no"
            keyboardType="email-address"
            left={<TextInput.Icon icon="email-outline" />}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            style={styles.input}
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
            autoComplete="off"
            autoCorrect={false}
            importantForAutofill="no"
            textContentType="oneTimeCode"
            left={<TextInput.Icon icon="lock-outline" />}
            right={
              <TextInput.Icon
                icon={secure ? 'eye-outline' : 'eye-off-outline'}
                onPress={() => setSecure((v) => !v)}
              />
            }
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            style={styles.input}
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
            autoComplete="off"
            autoCorrect={false}
            importantForAutofill="no"
            textContentType="oneTimeCode"
            left={<TextInput.Icon icon="lock-check-outline" />}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            style={styles.input}
          />

          <HelperText type="error" visible={Boolean(formError || error)}>
            {formError ?? error}
          </HelperText>

          <Button
            mode="contained"
            buttonColor={colors.primary}
            style={styles.registerButton}
            contentStyle={styles.registerButtonContent}
            onPress={handleCreateAccount}
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <ActivityIndicator size={18} color={colors.onPrimary} />
            ) : (
              'Create Account'
            )}
          </Button>

          <Button
            mode="text"
            textColor={colors.primary}
            style={styles.loginLink}
            onPress={() => navigation.navigate('Login')}
            disabled={isSubmitting}
          >
            Already have an account? Log In
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
  appName: {
    fontWeight: '700',
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
    backgroundColor: colors.inputBackground,
  },
  registerButton: {
    borderRadius: 10,
    marginTop: 8,
  },
  registerButtonContent: {
    paddingVertical: 6,
  },
  loginLink: {
    marginTop: 12,
  },
});
