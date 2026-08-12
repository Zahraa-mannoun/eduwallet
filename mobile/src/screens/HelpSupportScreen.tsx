import { useState } from 'react';
import {
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, IconButton, Text, TextInput } from 'react-native-paper';
import { colors } from '../theme/colors';
import * as supportService from '../services/supportService';
import { ApiError } from '../services/api';
import type { RootStackScreenProps } from '../navigation/types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MESSAGE_MAX_LENGTH = 2000;

const FAQ_ITEMS: Array<{ question: string; answer: string }> = [
  {
    question: 'How do I add funds to my wallet?',
    answer:
      "You can't deposit cash directly. Funds are sent to your wallet by a linked parent, or disbursed by your university or an NGO through a scholarship program.",
  },
  {
    question: 'How do I link a student as a parent?',
    answer:
      "From your Students tab, tap \"Link a Student\" and enter your child's account email along with an approval threshold. They'll need an existing EduWallet student account.",
  },
  {
    question: 'What happens if my card is frozen?',
    answer:
      "A frozen card keeps its category lock and balance but can't be charged until unfrozen. With auto-renew off you can reuse it for the same category; with auto-renew on, a new card is issued automatically instead.",
  },
];

function FaqItem({
  item,
  expanded,
  onToggle,
}: Readonly<{ item: { question: string; answer: string }; expanded: boolean; onToggle: () => void }>) {
  return (
    <View>
      <TouchableOpacity activeOpacity={0.7} onPress={onToggle} style={styles.faqRow}>
        <Text style={styles.faqQuestion}>{item.question}</Text>
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.muted}
        />
      </TouchableOpacity>
      {expanded ? (
        <View style={styles.faqAnswerBox}>
          <Text style={styles.faqAnswerText}>{item.answer}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function HelpSupportScreen({
  navigation,
}: Readonly<RootStackScreenProps<'HelpSupport'>>) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [expandedFaqs, setExpandedFaqs] = useState<Set<number>>(new Set());

  const canSend = subject.trim().length > 0 && message.trim().length > 0 && !isSending;

  const handleSend = async () => {
    if (!canSend) return;
    setIsSending(true);
    setError(null);
    try {
      await supportService.sendGeneralSupportMessage(subject.trim(), message.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send your message. Try again.');
    } finally {
      setIsSending(false);
    }
  };

  const resetForm = () => {
    setSubject('');
    setMessage('');
    setError(null);
    setSent(false);
  };

  const toggleFaq = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedFaqs((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.heroIconCircle}>
              <MaterialCommunityIcons name="headset" size={32} color={colors.primary} />
            </View>
            <Text style={styles.heroTitle}>Help &amp; Support</Text>
            <Text style={styles.heroSubtitle}>Have a question? We&apos;re here to help.</Text>
          </View>

          <View style={styles.infoCardsRow}>
            <View style={styles.infoCard}>
              <View style={[styles.infoIconCircle, { backgroundColor: `${colors.primary}1F` }]}>
                <MaterialCommunityIcons name="email-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.infoCardLabel}>Email Us</Text>
              <Text style={styles.infoCardValue}>support@eduwallet.com</Text>
            </View>
            <View style={styles.infoCard}>
              <View style={[styles.infoIconCircle, { backgroundColor: `${colors.accent}1F` }]}>
                <MaterialCommunityIcons name="timer-outline" size={20} color={colors.accent} />
              </View>
              <Text style={styles.infoCardLabel}>Response Time</Text>
              <Text style={styles.infoCardValue}>Within 24 hours</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Send us a message</Text>
          <View style={styles.formCard}>
            {sent ? (
              <View style={styles.successCard}>
                <Text style={styles.successText}>
                  ✅ Message sent! We&apos;ll get back to you within 24 hours.
                </Text>
                <TouchableOpacity onPress={resetForm}>
                  <Text style={styles.sendAnotherLink}>Send another message</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.inputLabel}>Subject</Text>
                <TextInput
                  mode="outlined"
                  placeholder="What's this about?"
                  value={subject}
                  onChangeText={setSubject}
                  outlineColor={colors.border}
                  activeOutlineColor={colors.primary}
                  theme={{ roundness: 12 }}
                  style={styles.input}
                />

                <Text style={styles.inputLabel}>Message</Text>
                <TextInput
                  mode="outlined"
                  placeholder="Describe your question or issue…"
                  value={message}
                  onChangeText={(text) => setMessage(text.slice(0, MESSAGE_MAX_LENGTH))}
                  multiline
                  numberOfLines={6}
                  maxLength={MESSAGE_MAX_LENGTH}
                  outlineColor={colors.border}
                  activeOutlineColor={colors.primary}
                  theme={{ roundness: 12 }}
                  style={styles.messageInput}
                />
                <Text style={styles.charCounter}>
                  {message.length} / {MESSAGE_MAX_LENGTH}
                </Text>

                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={!canSend}
                  onPress={handleSend}
                  style={styles.sendButtonWrapper}
                >
                  <LinearGradient
                    colors={canSend ? [colors.gradientStart, colors.gradientEnd] : [colors.border, colors.border]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.sendButton}
                  >
                    {isSending ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <MaterialCommunityIcons
                          name="send-outline"
                          size={18}
                          color={canSend ? '#FFFFFF' : colors.muted}
                        />
                        <Text style={[styles.sendButtonText, { color: canSend ? '#FFFFFF' : colors.muted }]}>
                          Send Message
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {error ? (
                  <View style={styles.errorBanner}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={16} color={colors.danger} />
                    <Text style={styles.errorBannerText}>{error}</Text>
                  </View>
                ) : null}
              </>
            )}
          </View>

          <Text style={styles.sectionLabel}>Frequently Asked Questions</Text>
          <View style={styles.faqCard}>
            {FAQ_ITEMS.map((item, index) => (
              <View key={item.question}>
                <FaqItem item={item} expanded={expandedFaqs.has(index)} onToggle={() => toggleFaq(index)} />
                {index < FAQ_ITEMS.length - 1 && <View style={styles.faqDivider} />}
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.surface,
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
    marginTop: 4,
  },
  infoCardsRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  infoIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  infoCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
  },
  infoCardValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.heading,
    textAlign: 'center',
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 10,
  },
  formCard: {
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
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.inputBackground,
    marginBottom: 14,
  },
  messageInput: {
    backgroundColor: colors.inputBackground,
    minHeight: 140,
  },
  charCounter: {
    fontSize: 11,
    color: colors.muted,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 4,
  },
  sendButtonWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 10,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 16,
  },
  sendButtonText: {
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
  successCard: {
    backgroundColor: `${colors.accent}1A`,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  successText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#065F46',
    textAlign: 'center',
    lineHeight: 19,
  },
  sendAnotherLink: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 12,
  },
  faqCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.heading,
    marginRight: 12,
  },
  faqAnswerBox: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  faqAnswerText: {
    fontSize: 12.5,
    color: colors.muted,
    lineHeight: 18,
  },
  faqDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
});
