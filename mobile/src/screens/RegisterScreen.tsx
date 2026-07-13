import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Button, Text, TextInput, TouchableRipple } from 'react-native-paper';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import IconBadge from '../components/IconBadge';
import { colors } from '../theme/colors';
import type { RootStackScreenProps } from '../navigation/types';

type UserType = 'STUDENT' | 'PARENT' | 'INSTITUTION';

const USER_TYPES: {
  key: UserType;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}[] = [
  { key: 'STUDENT', label: 'Student', icon: 'school-outline' },
  { key: 'PARENT', label: 'Parent', icon: 'account-heart-outline' },
  { key: 'INSTITUTION', label: 'Institution', icon: 'bank-outline' },
];

export default function RegisterScreen({ navigation }: RootStackScreenProps<'Register'>) {
  const [userType, setUserType] = useState<UserType>('STUDENT');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secure, setSecure] = useState(true);

  const handleCreateAccount = () => {
    navigation.replace('Main');
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
          <View style={styles.typeRow}>
            {USER_TYPES.map((type) => {
              const selected = userType === type.key;
              return (
                <TouchableRipple
                  key={type.key}
                  onPress={() => setUserType(type.key)}
                  style={[styles.typeCard, selected && styles.typeCardSelected]}
                  borderless
                >
                  <View style={styles.typeCardContent}>
                    <IconBadge
                      icon={type.icon}
                      color={selected ? colors.primary : colors.muted}
                      size={40}
                      iconSize={22}
                      style={styles.typeIconBadge}
                    />
                    <Text style={[styles.typeLabel, selected && styles.typeLabelSelected]}>
                      {type.label}
                    </Text>
                  </View>
                </TouchableRipple>
              );
            })}
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
  typeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  typeCard: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
  },
  typeCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#EAF0FA',
  },
  typeCardContent: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 6,
  },
  typeIconBadge: {
    marginBottom: 8,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'center',
  },
  typeLabelSelected: {
    color: colors.primary,
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
