import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Button,
  Dialog,
  IconButton,
  Portal,
  Snackbar,
  Text,
} from 'react-native-paper';
import type { NewVirtualCard, VirtualCard } from '../types/api';
import { colors } from '../theme/colors';
import { useThrottledFocusEffect } from '../hooks/useThrottledFocusEffect';
import * as cardService from '../services/cardService';
import { ApiError } from '../services/api';
import type { StudentTabScreenProps } from '../navigation/types';

function formatExpiry(iso: string): string {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear() % 100).padStart(2, '0');
  return `${month}/${year}`;
}

export default function CardsScreen(_props: StudentTabScreenProps<'Cards'>) {
  const [cards, setCards] = useState<VirtualCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [newCard, setNewCard] = useState<NewVirtualCard | null>(null);

  const loadCards = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await cardService.getCards();
      setCards(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load your cards.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useThrottledFocusEffect(loadCards);

  const handleGenerate = async () => {
    setIsCreating(true);
    try {
      const created = await cardService.createCard({ expiryDays: 365 });
      setNewCard(created);
      await loadCards();
    } catch (err) {
      setSnackbarMessage(err instanceof ApiError ? err.message : 'Could not create a card.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleFreeze = async (card: VirtualCard) => {
    try {
      await cardService.freezeCard(card.id);
      await loadCards();
      setSnackbarMessage(card.frozen ? 'Card unfrozen.' : 'Card frozen.');
    } catch (err) {
      setSnackbarMessage(err instanceof ApiError ? err.message : 'Could not update the card.');
    }
  };

  const handleDelete = async (card: VirtualCard) => {
    try {
      await cardService.deleteCard(card.id);
      await loadCards();
      setSnackbarMessage('Card deleted.');
    } catch (err) {
      setSnackbarMessage(err instanceof ApiError ? err.message : 'Could not delete the card.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Cards
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadCards} />}
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {cards.map((card) => (
          <View key={card.id} style={styles.cardWrapper}>
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.card, card.frozen && styles.cardFrozen]}
            >
              <View style={[styles.decorCircle, styles.decorCircleLarge]} />
              <View style={[styles.decorCircle, styles.decorCircleSmall]} />

              <View style={styles.cardTopRow}>
                <Text style={styles.cardBrand}>EduWallet</Text>
                <View style={styles.chip} />
              </View>

              <Text style={styles.cardNumber}>{card.cardNumber}</Text>

              <View style={styles.cardBottomRow}>
                <View>
                  <Text style={styles.fieldLabel}>STATUS</Text>
                  <Text style={styles.fieldValue}>{card.frozen ? 'FROZEN' : card.used ? 'USED' : 'ACTIVE'}</Text>
                </View>
                <View>
                  <Text style={styles.fieldLabel}>EXPIRES</Text>
                  <Text style={styles.fieldValue}>{formatExpiry(card.expiry)}</Text>
                </View>
              </View>
            </LinearGradient>

            <View style={styles.cardActions}>
              <Button
                mode="outlined"
                compact
                icon={card.frozen ? 'snowflake-off' : 'snowflake'}
                onPress={() => handleToggleFreeze(card)}
                style={styles.cardActionButton}
              >
                {card.frozen ? 'Unfreeze' : 'Freeze'}
              </Button>
              <IconButton icon="delete-outline" iconColor={colors.danger} onPress={() => handleDelete(card)} />
            </View>
          </View>
        ))}

        {cards.length === 0 && !isLoading ? (
          <Text style={styles.emptyText}>You don&apos;t have any virtual cards yet.</Text>
        ) : null}

        <Button
          mode="contained"
          buttonColor={colors.primary}
          icon="plus-circle-outline"
          style={styles.generateButton}
          contentStyle={styles.generateButtonContent}
          onPress={handleGenerate}
          disabled={isCreating}
        >
          {isCreating ? <ActivityIndicator size={18} color={colors.onPrimary} /> : 'Create New Card'}
        </Button>
      </ScrollView>

      <Portal>
        <Dialog visible={newCard !== null} onDismiss={() => setNewCard(null)}>
          <Dialog.Title>Card Created</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogWarning}>
              This is the only time your CVV will be shown. Save it now.
            </Text>
            <View style={styles.dialogRow}>
              <Text style={styles.dialogLabel}>Card Number</Text>
              <Text style={styles.dialogValue}>{newCard?.cardNumber}</Text>
            </View>
            <View style={styles.dialogRow}>
              <Text style={styles.dialogLabel}>CVV</Text>
              <Text style={styles.dialogValue}>{newCard?.cvv}</Text>
            </View>
            <View style={styles.dialogRow}>
              <Text style={styles.dialogLabel}>Expires</Text>
              <Text style={styles.dialogValue}>{newCard?.expiryFormatted}</Text>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setNewCard(null)}>Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={snackbarMessage !== null}
        onDismiss={() => setSnackbarMessage(null)}
        duration={2500}
      >
        {snackbarMessage}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: {
    fontWeight: '700',
    color: colors.heading,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyText: {
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: 24,
  },
  cardWrapper: {
    marginBottom: 20,
  },
  card: {
    borderRadius: 20,
    padding: 22,
    height: 180,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  cardFrozen: {
    opacity: 0.55,
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  decorCircleLarge: {
    width: 160,
    height: 160,
    top: -60,
    right: -40,
  },
  decorCircleSmall: {
    width: 90,
    height: 90,
    bottom: -30,
    right: 60,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardBrand: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  chip: {
    width: 36,
    height: 26,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  cardNumber: {
    color: colors.onPrimary,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 1,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  fieldValue: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  cardActionButton: {
    marginRight: 4,
    borderRadius: 8,
  },
  generateButton: {
    borderRadius: 10,
    marginTop: 8,
  },
  generateButtonContent: {
    paddingVertical: 6,
  },
  dialogWarning: {
    color: colors.danger,
    fontSize: 12,
    marginBottom: 12,
  },
  dialogRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  dialogLabel: {
    color: colors.muted,
  },
  dialogValue: {
    fontWeight: '700',
    color: colors.heading,
  },
});
