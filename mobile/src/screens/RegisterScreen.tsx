import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import UserTypeSelector from '../components/UserTypeSelector';
import { useAuth } from '../context/AuthContext';
import type { UserType } from '../context/AuthContext';
import { colors } from '../theme/colors';
import type { RootStackScreenProps } from '../navigation/types';

export default function RegisterScreen({ navigation }: RootStackScreenProps<'Register'>) {
  const { login } = useAuth();
  const [userType, setUserType] = useState<UserType>('STUDENT');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secure, setSecure] = useState(true);

  const handleCreateAccount = () => {
    login(userType, fullName.trim() || 'there');

    if (userType === 'STUDENT') {
      navigation.replace('StudentMain');
    } else if (userType === 'PARENT') {
      navigation.replace('ParentMain');
    } else {
      navigation.replace('InstitutionMain');
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
            onChangeText={setFullName}
            autoCapitalize="words"
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
            onChangeText={setEmail}
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
            placeholder="Create a password"
            value={password}
            onChangeText={setPassword}
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

          <TextInput
            mode="outlined"
            label="Confirm Password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={secure}
            left={<TextInput.Icon icon="lock-check-outline" />}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            style={styles.input}
          />

          <Button
            mode="contained"
            buttonColor={colors.primary}
            style={styles.registerButton}
            contentStyle={styles.registerButtonContent}
            onPress={handleCreateAccount}
          >
            Create Account
          </Button>

          <Button
            mode="text"
            textColor={colors.primary}
            style={styles.loginLink}
            onPress={() => navigation.navigate('Login')}
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
