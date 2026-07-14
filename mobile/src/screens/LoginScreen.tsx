import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { ActivityIndicator, Button, HelperText, Text, TextInput } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import type { RootStackScreenProps } from '../navigation/types';

export default function LoginScreen({ navigation }: RootStackScreenProps<'Login'>) {
  const { login, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isSubmitting;

  const handleLogin = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
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
                icon={secure ? 'eye-outline' : 'eye-off-outline'}
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
});
