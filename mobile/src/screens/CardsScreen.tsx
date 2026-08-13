import { useCallback, useState } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import {
  ActivityIndicator,
  Button,
  Dialog,
  IconButton,
  Portal,
  Snackbar,
  Text,
} from 'react-native-paper';
import type { TransactionCategory, VirtualCard } from '../types/api';
import KYCGate from '../components/KYCGate';
import { BUDGET_CATEGORIES, LOCKABLE_BUDGET_CATEGORIES } from '../constants/budgetCategories';
import type { BudgetCategoryDefinition, BudgetCategoryKey } from '../constants/budgetCategories';
import { colors } from '../theme/colors';
import * as cardService from '../services/cardService';
import * as parentalService from '../services/parentalService';
import { ApiError } from '../services/api';
import type { StudentTabScreenProps } from '../navigation/types';

const SCREEN_BACKGROUND = '#F8FAFC';

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

function lockBadgeColor(categoryLock: TransactionCategory | null): string {
  if (!categoryLock) return 'rgba(255,255,255,0.3)';
  const category = categoryLookup.get(categoryLock.toLowerCase() as BudgetCategoryKey);
  return category ? `${category.color}CC` : 'rgba(255,255,255,0.3)';
}

function categoryPillColor(categoryLock: TransactionCategory | null): string {
  if (!categoryLock) return colors.primary;
  const category = categoryLookup.get(categoryLock.toLowerCase() as BudgetCategoryKey);
  return category?.color ?? colors.primary;
}

// Demo prototype: the CVV/full number are always included on VirtualCard itself (never hidden
// after creation, see CLAUDE.md — no real money or PCI scope here), so the same "reveal" dialog
// serves both a just-created card and re-viewing an existing one via "Use Card".
function maskCardNumber(cardNumber: string): string {
  const digitsOnly = cardNumber.replace(/\s+/g, '');
  const last4 = digitsOnly.slice(-4) || digitsOnly;
  return `•••• •••• •••• ${last4}`;
}

function groupCardNumber(cardNumber: string): string {
  const digitsOnly = cardNumber.replace(/\s+/g, '');
  return digitsOnly.replace(/(.{4})/g, '$1 ').trim();
}

export default function CardsScreen(_props: Readonly<StudentTabScreenProps<'Cards'>>) {
  const [cards, setCards] = useState<VirtualCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [viewingCard, setViewingCard] = useState<VirtualCard | null>(null);
  const [viewingCardIsNew, setViewingCardIsNew] = useState(false);
  const [cvvRevealed, setCvvRevealed] = useState(false);
  const [createDialogVisible, setCreateDialogVisible] = useState(false);
  // undefined = nothing tapped yet (Create stays disabled); null = explicitly "No Lock".
  const [selectedLock, setSelectedLock] = useState<BudgetCategoryDefinition | null | undefined>(undefined);
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
    setSelectedLock(undefined);
    setCreateDialogVisible(true);
  };

  const canCreate = selectedLock !== undefined && !isCreating;

  const handleGenerate = async () => {
    if (!canCreate) return;
    setIsCreating(true);
    try {
      const created = await cardService.createCard({
        expiryDays: 365,
        categoryLock: selectedLock
          ? (selectedLock.key.toUpperCase() as TransactionCategory)
          : undefined,
      });
      setCreateDialogVisible(false);
      setViewingCard(created);
      setViewingCardIsNew(true);
      setCvvRevealed(false);
      await loadCards();
    } catch (err) {
      setSnackbarMessage(err instanceof ApiError ? err.message : 'Could not create a card.');
    } finally {
      setIsCreating(false);
    }
  };

  const openUseCard = (card: VirtualCard) => {
    setViewingCard(card);
    setViewingCardIsNew(false);
    setCvvRevealed(false);
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
              style={styles.card}
            >
              <View style={[styles.decorCircle, styles.decorCircleLarge]} />
              <View style={[styles.decorCircle, styles.decorCircleSmall]} />

              <View style={styles.cardTopRow}>
                <View style={styles.chip} />
                <View style={[styles.categoryBadge, { backgroundColor: lockBadgeColor(card.categoryLock) }]}>
                  <Text style={styles.categoryBadgeText}>{lockBadgeText(card.categoryLock)}</Text>
                </View>
              </View>

              <Text style={styles.maskedCardNumber}>{maskCardNumber(card.cardNumber)}</Text>

              <View style={styles.cardBottomRow}>
                <Text style={styles.cardBrandBottom}>EduWallet Virtual</Text>
                <View style={styles.expiryColumn}>
                  <Text style={styles.fieldLabel}>EXPIRES</Text>
                  <Text style={styles.fieldValue}>{formatExpiry(card.expiry)}</Text>
                </View>
              </View>

              {card.frozen ? (
                <View style={styles.frozenOverlay} pointerEvents="none">
                  <View style={styles.frozenBadge}>
                    <MaterialCommunityIcons name="snowflake" size={15} color="#FFFFFF" />
                    <Text style={styles.frozenBadgeText}>FROZEN</Text>
                  </View>
                </View>
              ) : null}
            </LinearGradient>

            <View style={styles.cardActions}>
              <Button
                mode="outlined"
                compact
                icon="credit-card-check-outline"
                onPress={() => openUseCard(card)}
                style={styles.cardActionButton}
              >
                Use Card
              </Button>
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
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons name="credit-card-outline" size={40} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No Cards Yet</Text>
            <Text style={styles.emptySubtitle}>Create a virtual card to start making payments</Text>
          </View>
        ) : null}

        <TouchableOpacity activeOpacity={0.85} style={styles.generateButtonWrapper} onPress={openCreateDialog}>
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.generateButton}
          >
            <MaterialCommunityIcons name="plus-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.generateButtonText}>Create New Card</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      <Portal>
        <Dialog
          visible={createDialogVisible}
          onDismiss={() => setCreateDialogVisible(false)}
          style={styles.dialogContainer}
        >
          <View style={styles.dialogTitleRow}>
            <MaterialCommunityIcons name="lock-outline" size={20} color={colors.primary} />
            <Text style={styles.dialogTitleText}>Category Lock</Text>
          </View>
          <Dialog.Content>
            <Text style={styles.lockDialogSubtitle}>
              Lock this card to one spending category, or leave it unlocked for general use.
            </Text>
            <View style={styles.lockGrid}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setSelectedLock(null)}
                style={[styles.lockItem, selectedLock === null && styles.lockItemSelected]}
              >
                <MaterialCommunityIcons
                  name="lock-open-variant-outline"
                  size={22}
                  color={selectedLock === null ? '#FFFFFF' : colors.muted}
                />
                <Text
                  style={[styles.lockItemLabel, selectedLock === null && styles.lockItemLabelSelected]}
                  numberOfLines={2}
                >
                  No Lock
                </Text>
              </TouchableOpacity>
              {availableLockCategories.map((category) => {
                const selected = selectedLock?.key === category.key;
                return (
                  <TouchableOpacity
                    key={category.key}
                    activeOpacity={0.8}
                    onPress={() => setSelectedLock(category)}
                    style={[styles.lockItem, selected && styles.lockItemSelected]}
                  >
                    <MaterialCommunityIcons
                      name={category.icon}
                      size={22}
                      color={selected ? '#FFFFFF' : category.color}
                    />
                    <Text
                      style={[styles.lockItemLabel, selected && styles.lockItemLabelSelected]}
                      numberOfLines={2}
                    >
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button
              mode="outlined"
              textColor={colors.muted}
              style={styles.dialogCancelButton}
              disabled={isCreating}
              onPress={() => setCreateDialogVisible(false)}
            >
              Cancel
            </Button>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={!canCreate}
              onPress={handleGenerate}
              style={styles.dialogPrimaryButtonWrapper}
            >
              <LinearGradient
                colors={canCreate ? [colors.gradientStart, colors.gradientEnd] : [colors.border, colors.border]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.dialogPrimaryButton}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[styles.dialogPrimaryButtonText, { color: canCreate ? '#FFFFFF' : colors.muted }]}>
                    Create
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={viewingCard !== null}
          onDismiss={() => setViewingCard(null)}
          style={styles.dialogContainer}
        >
          <View style={styles.detailsHeaderRow}>
            <View style={styles.detailsHeaderIconCircle}>
              <MaterialCommunityIcons name="credit-card-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.detailsHeaderTextColumn}>
              <Text style={styles.dialogTitleText}>{viewingCardIsNew ? 'Card Created' : 'Card Details'}</Text>
              <Text style={styles.detailsHeaderSubtitle}>Keep this information secure</Text>
            </View>
          </View>
          <Dialog.Content>
            {viewingCard ? (
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.detailsCardPreview}
              >
                <Text style={styles.detailsCardPreviewNumber}>{maskCardNumber(viewingCard.cardNumber)}</Text>
                <View style={styles.detailsCardPreviewBottomRow}>
                  <Text style={styles.detailsCardPreviewMeta}>EXPIRES {formatExpiry(viewingCard.expiry)}</Text>
                  <Text style={styles.detailsCardPreviewMeta}>{lockBadgeText(viewingCard.categoryLock)}</Text>
                </View>
              </LinearGradient>
            ) : null}

            <View style={styles.dialogRow}>
              <Text style={styles.dialogLabel}>Card Number</Text>
              <View style={styles.dialogValueRow}>
                <Text style={styles.dialogValueMono}>
                  {viewingCard ? groupCardNumber(viewingCard.cardNumber) : ''}
                </Text>
                <IconButton
                  icon="content-copy"
                  size={16}
                  iconColor={colors.primary}
                  style={styles.copyIconButtonDialog}
                  onPress={() => viewingCard && handleCopy(viewingCard.cardNumber, 'Card number')}
                />
              </View>
            </View>
            <View style={styles.dialogDivider} />

            <View style={styles.dialogRow}>
              <Text style={styles.dialogLabel}>CVV</Text>
              <View style={styles.dialogValueRow}>
                <Text style={styles.dialogValueMono}>
                  {cvvRevealed ? viewingCard?.cvv : '•••'}
                </Text>
                <IconButton
                  icon={cvvRevealed ? 'eye-off-outline' : 'eye-outline'}
                  size={16}
                  iconColor={colors.muted}
                  style={styles.copyIconButtonDialog}
                  onPress={() => setCvvRevealed((prev) => !prev)}
                />
                <IconButton
                  icon="content-copy"
                  size={16}
                  iconColor={colors.primary}
                  style={styles.copyIconButtonDialog}
                  onPress={() => viewingCard && handleCopy(viewingCard.cvv, 'CVV')}
                />
              </View>
            </View>
            <View style={styles.dialogDivider} />

            <View style={styles.dialogRow}>
              <Text style={styles.dialogLabel}>Expires</Text>
              <Text style={styles.dialogValue}>{viewingCard ? formatExpiry(viewingCard.expiry) : ''}</Text>
            </View>
            <View style={styles.dialogDivider} />

            <View style={styles.dialogRow}>
              <Text style={styles.dialogLabel}>Category Lock</Text>
              <View
                style={[
                  styles.categoryLockPill,
                  { backgroundColor: `${categoryPillColor(viewingCard?.categoryLock ?? null)}1F` },
                ]}
              >
                <Text
                  style={[
                    styles.categoryLockPillText,
                    { color: categoryPillColor(viewingCard?.categoryLock ?? null) },
                  ]}
                >
                  {lockBadgeText(viewingCard?.categoryLock ?? null)}
                </Text>
              </View>
            </View>

            <View style={styles.securityNoteCard}>
              <Text style={styles.securityNoteIcon}>🔒</Text>
              <Text style={styles.securityNoteText}>Never share your card details with anyone</Text>
            </View>
          </Dialog.Content>
          <Dialog.Actions style={styles.detailsDialogActions}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setViewingCard(null)}
              style={styles.dialogPrimaryButtonWrapper}
            >
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.dialogPrimaryButton}
              >
                <Text style={[styles.dialogPrimaryButtonText, { color: '#FFFFFF' }]}>Done</Text>
              </LinearGradient>
            </TouchableOpacity>
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
    backgroundColor: SCREEN_BACKGROUND,
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
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${colors.primary}1A`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.heading,
    marginBottom: 6,
  },
  emptySubtitle: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
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
  chip: {
    width: 36,
    height: 26,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  categoryBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: 160,
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  maskedCardNumber: {
    color: colors.onPrimary,
    fontSize: 19,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cardBrandBottom: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '700',
  },
  expiryColumn: {
    alignItems: 'flex-end',
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
  frozenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    backgroundColor: 'rgba(220,38,38,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frozenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(127,29,29,0.85)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  frozenBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    marginLeft: 6,
  },
  copyIconButtonDialog: {
    margin: 0,
    marginLeft: 4,
  },
  dialogValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  cardActionButton: {
    flex: 1,
    marginRight: 6,
    borderRadius: 8,
  },
  generateButtonWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 16,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
  dialogContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  dialogTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 4,
  },
  dialogTitleText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: 8,
  },
  lockDialogSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 8,
    marginBottom: 14,
  },
  lockGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  lockItem: {
    width: 80,
    height: 80,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  lockItemSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  lockItemLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.muted,
    marginTop: 6,
    textAlign: 'center',
  },
  lockItemLabelSelected: {
    color: '#FFFFFF',
  },
  dialogActions: {
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
  },
  dialogCancelButton: {
    flex: 1,
    marginRight: 10,
    borderRadius: 12,
    borderColor: colors.border,
  },
  dialogPrimaryButtonWrapper: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  dialogPrimaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 12,
  },
  dialogPrimaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
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
  dialogValueMono: {
    fontWeight: '700',
    color: colors.heading,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  dialogDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  detailsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 4,
  },
  detailsHeaderIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${colors.primary}1A`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsHeaderTextColumn: {
    flex: 1,
  },
  detailsHeaderSubtitle: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 2,
    marginLeft: 8,
  },
  detailsCardPreview: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  detailsCardPreviewNumber: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 1,
  },
  detailsCardPreviewBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  detailsCardPreviewMeta: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  categoryLockPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  categoryLockPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  securityNoteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  securityNoteIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  securityNoteText: {
    flex: 1,
    fontSize: 12,
    color: '#991B1B',
    lineHeight: 18,
    fontWeight: '600',
  },
  detailsDialogActions: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
  },
});
