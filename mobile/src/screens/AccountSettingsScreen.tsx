import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconButton, Snackbar, Switch, Text } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import * as cardService from '../services/cardService';
import { ApiError } from '../services/api';
import { colors } from '../theme/colors';
import type { RootStackScreenProps } from '../navigation/types';

export default function AccountSettingsScreen({
  navigation,
}: Readonly<RootStackScreenProps<'AccountSettings'>>) {
  const { user, refreshUser } = useAuth();
  const [cardAutoRenew, setCardAutoRenew] = useState(user?.cardAutoRenew ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const handleToggleCardAutoRenew = async (next: boolean) => {
    setCardAutoRenew(next);
    setIsSaving(true);
    try {
      await cardService.updateCardAutoRenew(next);
      await refreshUser();
      setSnackbarMessage(next ? 'Auto-renew turned on.' : 'Auto-renew turned off.');
    } catch (err) {
      setCardAutoRenew(!next);
      setSnackbarMessage(err instanceof ApiError ? err.message : 'Could not update this setting.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
        <Text variant="titleLarge" style={styles.headerTitle}>
          Account Settings
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {user?.userType === 'STUDENT' ? (
          <>
            <Text style={styles.sectionLabel}>Card Settings</Text>
            <View style={styles.settingCard}>
              <View style={styles.settingRow}>
                <View style={styles.settingTextColumn}>
                  <Text style={styles.settingTitle}>Auto-renew cards</Text>
                  <Text style={styles.settingDescription}>
                    {cardAutoRenew
                      ? 'On — a new card is issued automatically in the same category right after a card is used.'
                      : 'Off — a card freezes after it is used. Unfreeze it manually to get a new one.'}
                  </Text>
                </View>
                <Switch
                  value={cardAutoRenew}
                  onValueChange={handleToggleCardAutoRenew}
                  disabled={isSaving}
                />
              </View>
            </View>
          </>
        ) : (
          <Text style={styles.settingDescription}>No account settings available yet.</Text>
        )}
      </ScrollView>

      <Snackbar
        visible={snackbarMessage !== null}
        onDismiss={() => setSnackbarMessage(null)}
        duration={2500}
      >
        {snackbarMessage ?? ''}
      </Snackbar>
    </SafeAreaView>
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
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.label,
    marginBottom: 10,
  },
  settingCard: {
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingTextColumn: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontWeight: '700',
    color: colors.heading,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
  },
});
