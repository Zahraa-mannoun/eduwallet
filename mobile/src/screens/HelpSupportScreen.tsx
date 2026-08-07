import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Button, HelperText, IconButton, Text, TextInput } from 'react-native-paper';
import IconBadge from '../components/IconBadge';
import { colors } from '../theme/colors';
import * as supportService from '../services/supportService';
import { ApiError } from '../services/api';
import type { RootStackScreenProps } from '../navigation/types';

export default function HelpSupportScreen({
  navigation,
}: Readonly<RootStackScreenProps<'HelpSupport'>>) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

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

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
          <Text variant="titleLarge" style={styles.headerTitle}>
            Help &amp; Support
          </Text>
        </View>

        {sent ? (
          <ScrollView contentContainerStyle={styles.successContent}>
            <IconBadge icon="check-circle-outline" color={colors.accent} size={88} iconSize={48} />
            <Text variant="headlineSmall" style={styles.successTitle}>
              Message Sent
            </Text>
            <Text style={styles.successText}>
              Your message has been sent. We will get back to you shortly.
            </Text>
            <Button
              mode="contained"
              buttonColor={colors.primary}
              style={styles.doneButton}
              contentStyle={styles.doneButtonContent}
              onPress={() => navigation.goBack()}
            >
              Back to Profile
            </Button>
            <Button mode="text" style={styles.newMessageButton} onPress={resetForm}>
              Send Another Message
            </Button>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.instructions}>
              Have a question or ran into an issue? Send us a message and our team will get back
              to you.
            </Text>

            <TextInput
              mode="outlined"
              label="Subject"
              placeholder="What's this about?"
              value={subject}
              onChangeText={setSubject}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              style={styles.input}
            />

            <TextInput
              mode="outlined"
              label="Message"
              placeholder="Describe your question or issue…"
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={6}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              style={styles.messageInput}
            />
            <HelperText type="error" visible={Boolean(error)}>
              {error}
            </HelperText>

            <Button
              mode="contained"
              buttonColor={colors.primary}
              style={styles.sendButton}
              contentStyle={styles.sendButtonContent}
              disabled={!canSend}
              onPress={handleSend}
            >
              {isSending ? <ActivityIndicator size={18} color={colors.onPrimary} /> : 'Send Message'}
            </Button>
          </ScrollView>
        )}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
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
  headerTitle: {
    fontWeight: '700',
    color: colors.heading,
    marginLeft: 4,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  instructions: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 19,
    marginBottom: 20,
  },
  input: {
    backgroundColor: colors.inputBackground,
    marginBottom: 16,
  },
  messageInput: {
    backgroundColor: colors.inputBackground,
    minHeight: 140,
  },
  sendButton: {
    borderRadius: 10,
    marginTop: 8,
  },
  sendButtonContent: {
    paddingVertical: 6,
  },
  successContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  successTitle: {
    fontWeight: '700',
    color: colors.heading,
    marginTop: 16,
  },
  successText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  doneButton: {
    width: '100%',
    borderRadius: 10,
    marginTop: 28,
  },
  doneButtonContent: {
    paddingVertical: 6,
  },
  newMessageButton: {
    marginTop: 4,
  },
});
