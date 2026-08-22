import { useEffect, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, HelperText, IconButton, Text, TextInput, TouchableRipple } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import IconBadge from '../components/IconBadge';
import { colors } from '../theme/colors';
import * as supportService from '../services/supportService';
import { ApiError } from '../services/api';
import type { RootStackScreenProps } from '../navigation/types';

const BG_GRADIENT_START = '#F8F7FF';
const BG_GRADIENT_END = '#EEF2FF';
const SUPPORT_ICON_COLOR = '#F97316';
const BUTTON_GRADIENT = [colors.gradientStart, '#4F46E5'] as const;
const SUCCESS_GRADIENT = ['#22C55E', '#16A34A'] as const;
const BUTTON_DISABLED_COLOR = '#CBD5E1';
const FIELD_BORDER = '#E2E8F0';
const READONLY_BACKGROUND = '#F8FAFC';

// Scales in from half-size on mount — a plain spring on Animated.Value, not a real Lottie/SVG
// animation, but enough to make the success state feel like a deliberate moment rather than a
// static icon swap.
function AnimatedSuccessIcon() {
  const scale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 50, useNativeDriver: true }).start();
  }, [scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <LinearGradient colors={SUCCESS_GRADIENT} style={styles.successIconCircle}>
        <MaterialCommunityIcons name="check-bold" size={36} color="#FFFFFF" />
      </LinearGradient>
    </Animated.View>
  );
}

// Reachable with no session at all (a suspended user has no token) — lives in
// AppNavigator's unauthenticated branch alongside Login/Register, not KYCGate'd or
// otherwise dependent on being logged in.
export default function SupportMessageScreen({
  navigation,
  route,
}: RootStackScreenProps<'SupportMessage'>) {
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const canSend = email.trim().length > 0 && message.trim().length > 0 && !isSending;

  const handleSend = async () => {
    if (!canSend) return;
    setIsSending(true);
    setError(null);
    try {
      await supportService.sendSupportMessage(email.trim(), message.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send your message. Try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <LinearGradient colors={[BG_GRADIENT_START, BG_GRADIENT_END]} style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView style={styles.flex} edges={['top']}>
          <View style={styles.header}>
            <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
          </View>

          {sent ? (
            <ScrollView contentContainerStyle={styles.successContent}>
              <AnimatedSuccessIcon />
              <Text style={styles.successTitle}>Message Sent!</Text>
              <Text style={styles.successText}>
                Your message has been received. Our team will review your case and get back to
                you within 24 hours.
              </Text>

              <View style={styles.infoCard}>
                <IconBadge icon="clock-outline" color={colors.primary} size={36} iconSize={18} />
                <Text style={styles.infoCardText}>Typical response time: 24 hours</Text>
              </View>

              <TouchableRipple
                style={styles.doneButtonTouchable}
                borderless
                onPress={() => navigation.goBack()}
              >
                <LinearGradient
                  colors={BUTTON_GRADIENT}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.doneButton}
                >
                  <MaterialCommunityIcons name="login" size={18} color={colors.onPrimary} />
                  <Text style={styles.doneButtonText}>Back to Login</Text>
                </LinearGradient>
              </TouchableRipple>
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <View style={styles.heroSection}>
                <IconBadge icon="headset" color={SUPPORT_ICON_COLOR} size={88} iconSize={40} />
                <Text style={styles.heroTitle}>Contact Support</Text>
                <Text style={styles.heroSubtitle}>
                  Tell us what&apos;s going on and our team will review your account as soon as
                  possible.
                </Text>
              </View>

              <Text style={styles.fieldLabel}>Your Email</Text>
              <TextInput
                mode="outlined"
                placeholder="you@university.edu.lb"
                value={email}
                onChangeText={setEmail}
                editable={false}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                outlineColor={FIELD_BORDER}
                activeOutlineColor={colors.primary}
                outlineStyle={styles.inputOutline}
                left={<TextInput.Icon icon="email-outline" color={colors.muted} />}
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>Your Message</Text>
              <TextInput
                mode="outlined"
                placeholder="Describe your situation..."
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={6}
                outlineColor={FIELD_BORDER}
                activeOutlineColor={colors.primary}
                outlineStyle={styles.inputOutline}
                left={<TextInput.Icon icon="message-text-outline" color={colors.muted} />}
                style={styles.messageInput}
              />
              <HelperText type="error" visible={Boolean(error)}>
                {error}
              </HelperText>

              <TouchableRipple
                disabled={!canSend}
                onPress={handleSend}
                borderless
                style={styles.sendButtonTouchable}
              >
                {canSend ? (
                  <LinearGradient
                    colors={BUTTON_GRADIENT}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.sendButton}
                  >
                    {isSending ? (
                      <ActivityIndicator size={18} color={colors.onPrimary} />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="send" size={18} color={colors.onPrimary} />
                        <Text style={styles.sendButtonText}>Send Message</Text>
                      </>
                    )}
                  </LinearGradient>
                ) : (
                  <View style={[styles.sendButton, styles.sendButtonDisabled]}>
                    <MaterialCommunityIcons name="send" size={18} color={colors.onPrimary} />
                    <Text style={styles.sendButtonText}>Send Message</Text>
                  </View>
                )}
              </TouchableRipple>

              <Text style={styles.responseNote}>We typically respond within 24 hours</Text>
            </ScrollView>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
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
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    paddingBottom: 28,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.heading,
    marginTop: 16,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 8,
    paddingHorizontal: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: 6,
    marginLeft: 4,
  },
  inputOutline: {
    borderRadius: 12,
  },
  input: {
    backgroundColor: READONLY_BACKGROUND,
    marginBottom: 16,
  },
  messageInput: {
    backgroundColor: '#FFFFFF',
    minHeight: 140,
    marginBottom: 4,
  },
  sendButtonTouchable: {
    borderRadius: 14,
    marginTop: 12,
    overflow: 'hidden',
  },
  sendButton: {
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sendButtonDisabled: {
    backgroundColor: BUTTON_DISABLED_COLOR,
  },
  sendButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  responseNote: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 16,
  },
  successContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.heading,
    marginTop: 20,
    textAlign: 'center',
  },
  successText: {
    fontSize: 15,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 21,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  infoCardText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.heading,
  },
  doneButtonTouchable: {
    width: '100%',
    borderRadius: 14,
    marginTop: 28,
    overflow: 'hidden',
  },
  doneButton: {
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});
