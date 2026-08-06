import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import {
  ActivityIndicator,
  Button,
  Dialog,
  IconButton,
  Portal,
  Snackbar,
  Text,
  TouchableRipple,
} from 'react-native-paper';
import type { NewVirtualCard, TransactionCategory, VirtualCard } from '../types/api';
import IconBadge from '../components/IconBadge';
import KYCGate from '../components/KYCGate';
import { BUDGET_CATEGORIES, LOCKABLE_BUDGET_CATEGORIES } from '../constants/budgetCategories';
import type { BudgetCategoryDefinition, BudgetCategoryKey } from '../constants/budgetCategories';
import { colors } from '../theme/colors';
import * as cardService from '../services/cardService';
import * as parentalService from '../services/parentalService';
import { ApiError } from '../services/api';
import type { StudentTabScreenProps } from '../navigation/types';

const LOCK_CATEGORIES = LOCKABLE_BUDGET_CATEGORIES.filter((category) => category.key !== 'general');
const categoryLookup = new Map(BUDGET_CATEGORIES.map((category) => [category.key, category]));

function formatExpiry(iso: string): string {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear() % 100).padStart(2, '0');
  return `${month}/${year}`;
}

function lockBadgeText(categoryLock: TransactionCategory | null): string {
  if (!categoryLock) return 'GENERAL USE';
  const category = categoryLookup.get(categoryLock.toLowerCase() as BudgetCategoryKey);
  return `${(category?.label ?? categoryLock).toUpperCase()} ONLY`;
}

export default function CardsScreen(_props: Readonly<StudentTabScreenProps<'Cards'>>) {
  const [cards, setCards] = useState<VirtualCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [newCard, setNewCard] = useState<NewVirtualCard | null>(null);
  const [createDialogVisible, setCreateDialogVisible] = useState(false);
  const [selectedLock, setSelectedLock] = useState<BudgetCategoryDefinition | null>(null);
  const [allowedCategories, setAllowedCategories] = useState<TransactionCategory[] | null>(null);

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

  const loadAllowedCategories = useCallback(async () => {
    try {
      const permissions = await parentalService.getMyPermissions();
      setAllowedCategories(permissions?.allowedCategories ?? null);
    } catch {
      // Category-lock options fall back to the full list on failure.
    }
  }, []);

  const refreshCards = useCallback(() => {
    void loadCards();
    void loadAllowedCategories();
  }, [loadCards, loadAllowedCategories]);

  // Unthrottled (unlike most screens' useThrottledFocusEffect): a card payment made
  // externally at EduMart must be reflected the instant the student returns to this tab,
  // not up to 30s later — same reasoning as BudgetScreen's focus effect.
  useFocusEffect(
    useCallback(() => {
      refreshCards();
    }, [refreshCards])
  );

  // The backend deletes an auto-renewed card outright on use (see cards.service.ts useCard()),
  // so used-and-unfrozen should never actually come back from the API — this filter is just a
  // defensive backstop. A used card that's frozen (auto-renew off at time of use) stays visible
  // so the student can unfreeze it to reactivate the same card.
  const visibleCards = cards.filter((card) => !card.used || card.frozen);

  // A student with no parent linked has nothing restricting them, so every category
  // stays selectable — the filter only kicks in once parent settings actually exist.
  const availableLockCategories = allowedCategories
    ? LOCK_CATEGORIES.filter((category) =>
        allowedCategories.includes(category.key.toUpperCase() as TransactionCategory)
      )
    : LOCK_CATEGORIES;

  const openCreateDialog = () => {
    setSelectedLock(null);
    setCreateDialogVisible(true);
  };

  const handleGenerate = async () => {
    setIsCreating(true);
    try {
      const created = await cardService.createCard({
        expiryDays: 365,
        categoryLock: selectedLock
          ? (selectedLock.key.toUpperCase() as TransactionCategory)
          : undefined,
      });
      setCreateDialogVisible(false);
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
      const wasUsedAndFrozen = card.used && card.frozen;
      await cardService.freezeCard(card.id);
      await loadCards();
      setSnackbarMessage(
        wasUsedAndFrozen
          ? 'Card reactivated — ready to use again.'
          : card.frozen
            ? 'Card unfrozen.'
            : 'Card frozen.'
      );
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

  const handleCopy = async (value: string, label: string) => {
    await Clipboard.setStringAsync(value);
    setSnackbarMessage(`${label} copied!`);
  };

  return (
    <KYCGate>
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

        {visibleCards.map((card) => (
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

              <View style={styles.cardNumberRow}>
                <Text style={styles.cardNumber}>{card.cardNumber}</Text>
                <IconButton
                  icon="content-copy"
                  size={16}
                  iconColor={colors.onPrimary}
                  style={styles.copyIconButton}
                  onPress={() => handleCopy(card.cardNumber, 'Card number')}
                />
              </View>

              <View style={styles.lockBadge}>
                <Text style={styles.lockBadgeText}>{lockBadgeText(card.categoryLock)}</Text>
              </View>

              <View style={styles.cardBottomRow}>
                <View>
                  <Text style={styles.fieldLabel}>STATUS</Text>
                  <Text style={styles.fieldValue}>{card.frozen ? 'FROZEN' : card.used ? 'USED' : 'ACTIVE'}</Text>
                </View>
                <View>
                  <Text style={styles.fieldLabel}>EXPIRES</Text>
                  <Text style={styles.fieldValue}>{formatExpiry(card.expiry)}</Text>
                </View>
                <View>
                  <Text style={styles.fieldLabel}>CVV</Text>
                  <View style={styles.cvvRow}>
                    <Text style={styles.fieldValue}>{card.cvv}</Text>
                    <IconButton
                      icon="content-copy"
                      size={14}
                      iconColor={colors.onPrimary}
                      style={styles.copyIconButtonSmall}
                      onPress={() => handleCopy(card.cvv, 'CVV')}
                    />
                  </View>
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

        {visibleCards.length === 0 && !isLoading ? (
          <Text style={styles.emptyText}>You don&apos;t have any virtual cards yet.</Text>
        ) : null}

        <Button
          mode="contained"
          buttonColor={colors.primary}
          icon="plus-circle-outline"
          style={styles.generateButton}
          contentStyle={styles.generateButtonContent}
          onPress={openCreateDialog}
        >
          Create New Card
        </Button>
      </ScrollView>

      <Portal>
        <Dialog visible={createDialogVisible} onDismiss={() => setCreateDialogVisible(false)}>
          <Dialog.Title>Category Lock</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.lockDialogSubtitle}>
              Lock this card to one spending category, or leave it unlocked for general use.
            </Text>
            <View style={styles.lockGrid}>
              <TouchableRipple
                onPress={() => setSelectedLock(null)}
                style={[styles.lockItem, selectedLock === null && styles.lockItemSelected]}
                borderless
              >
                <View style={styles.lockItemContent}>
                  <IconBadge icon="lock-open-variant-outline" color={colors.muted} size={36} iconSize={20} />
                  <Text style={[styles.lockItemLabel, selectedLock === null && styles.lockItemLabelSelected]}>
                    No Lock
                  </Text>
                </View>
              </TouchableRipple>
              {availableLockCategories.map((category) => {
                const selected = selectedLock?.key === category.key;
                return (
                  <TouchableRipple
                    key={category.key}
                    onPress={() => setSelectedLock(category)}
                    style={[
                      styles.lockItem,
                      selected && { borderColor: category.color, backgroundColor: `${category.color}14` },
                    ]}
                    borderless
                  >
                    <View style={styles.lockItemContent}>
                      <IconBadge icon={category.icon} color={category.color} size={36} iconSize={20} />
                      <Text style={[styles.lockItemLabel, selected && { color: category.color }]}>
                        {category.label}
                      </Text>
                    </View>
                  </TouchableRipple>
                );
              })}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCreateDialogVisible(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button onPress={handleGenerate} disabled={isCreating}>
              {isCreating ? <ActivityIndicator size={16} color={colors.primary} /> : 'Create'}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={newCard !== null} onDismiss={() => setNewCard(null)}>
          <Dialog.Title>Card Created</Dialog.Title>
          <Dialog.Content>
            <View style={styles.dialogRow}>
              <Text style={styles.dialogLabel}>Card Number</Text>
              <View style={styles.dialogValueRow}>
                <Text style={styles.dialogValue}>{newCard?.cardNumber}</Text>
                <IconButton
                  icon="content-copy"
                  size={16}
                  iconColor={colors.primary}
                  style={styles.copyIconButtonDialog}
                  onPress={() => newCard && handleCopy(newCard.cardNumber, 'Card number')}
                />
              </View>
            </View>
            <View style={styles.dialogRow}>
              <Text style={styles.dialogLabel}>CVV</Text>
              <View style={styles.dialogValueRow}>
                <Text style={styles.dialogValue}>{newCard?.cvv}</Text>
                <IconButton
                  icon="content-copy"
                  size={16}
                  iconColor={colors.primary}
                  style={styles.copyIconButtonDialog}
                  onPress={() => newCard && handleCopy(newCard.cvv, 'CVV')}
                />
              </View>
            </View>
            <View style={styles.dialogRow}>
              <Text style={styles.dialogLabel}>Expires</Text>
              <Text style={styles.dialogValue}>{newCard?.expiryFormatted}</Text>
            </View>
            <View style={styles.dialogRow}>
              <Text style={styles.dialogLabel}>Category Lock</Text>
              <Text style={styles.dialogValue}>{lockBadgeText(newCard?.categoryLock ?? null)}</Text>
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
    </KYCGate>
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
  cardNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardNumber: {
    color: colors.onPrimary,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 1,
  },
  copyIconButton: {
    margin: 0,
    marginLeft: 2,
  },
  copyIconButtonSmall: {
    margin: 0,
    marginLeft: -4,
    width: 20,
    height: 20,
  },
  copyIconButtonDialog: {
    margin: 0,
    marginLeft: 4,
  },
  cvvRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dialogValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  lockBadgeText: {
    color: colors.onPrimary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
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
  lockDialogSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 14,
  },
  lockGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  lockItem: {
    width: '31%',
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
  },
  lockItemSelected: {
    borderColor: colors.muted,
    backgroundColor: colors.surface,
  },
  lockItemContent: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  lockItemLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    marginTop: 6,
  },
  lockItemLabelSelected: {
    color: colors.heading,
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
