import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Dialog,
  HelperText,
  IconButton,
  Portal,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { TransactionCategory } from '../types/api';
import { BUDGET_CATEGORIES, LOCKABLE_BUDGET_CATEGORIES } from '../constants/budgetCategories';
import { categoryColors, colors } from '../theme/colors';
import { useThrottledFocusEffect } from '../hooks/useThrottledFocusEffect';
import * as parentalService from '../services/parentalService';
import type { LinkedStudent } from '../services/parentalService';
import { ApiError } from '../services/api';
import { getInitials } from '../utils/getInitials';
import type { ParentTabScreenProps } from '../navigation/types';

const CATEGORY_EXPLANATION =
  'Select which categories your student can spend locked funds in. They cannot spend in unselected categories.';

const CATEGORY_PILL_COLORS: Record<TransactionCategory, string> = {
  TUITION: categoryColors.tuition,
  BOOKS: categoryColors.books,
  FOOD: categoryColors.food,
  TRANSPORT: categoryColors.transport,
  SOFTWARE: categoryColors.software,
  RENT: categoryColors.rent,
  LIFESTYLE: categoryColors.lifestyle,
  PERSONAL_SAVINGS: categoryColors.personalSavings,
  GENERAL: categoryColors.general,
};

function CategoryPill({ category }: Readonly<{ category: TransactionCategory }>) {
  const color = CATEGORY_PILL_COLORS[category];
  return (
    <View style={[styles.categoryPill, { backgroundColor: `${color}1F` }]}>
      <Text style={[styles.categoryPillText, { color }]}>{categoryLabel(category)}</Text>
    </View>
  );
}

function categoryLabel(category: TransactionCategory): string {
  return (
    BUDGET_CATEGORIES.find((definition) => definition.key.toUpperCase() === category)?.label ??
    category
  );
}

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

type CategoryToggleGridProps = Readonly<{
  selected: Set<TransactionCategory>;
  onToggle: (category: TransactionCategory) => void;
}>;

// Shared by both the Link-a-Student and Student Settings dialogs — a 3-column toggle-chip grid
// (blue+checkmark when selected, white+gray when not).
function CategoryToggleGrid({ selected, onToggle }: CategoryToggleGridProps) {
  return (
    <View style={styles.categoryToggleGrid}>
      {LOCKABLE_BUDGET_CATEGORIES.map((cat, index) => {
        const txCategory = cat.key.toUpperCase() as TransactionCategory;
        const isSelected = selected.has(txCategory);
        // A plain space-between 3-column grid pushes an 8-item list's ragged 2-item last row to
        // opposite edges — explicit per-item margins instead keep every row evenly spaced.
        const isLastInRow = (index + 1) % 3 === 0;
        return (
          <TouchableOpacity
            key={cat.key}
            onPress={() => onToggle(txCategory)}
            style={[
              styles.categoryToggleChip,
              !isLastInRow && styles.categoryToggleChipGap,
              isSelected && styles.categoryToggleChipSelected,
            ]}
          >
            <MaterialCommunityIcons
              name={isSelected ? 'check-circle' : cat.icon}
              size={16}
              color={isSelected ? '#FFFFFF' : colors.muted}
            />
            <Text
              style={[
                styles.categoryToggleChipText,
                isSelected && styles.categoryToggleChipTextSelected,
              ]}
              numberOfLines={1}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function StudentsListScreen(_props: ParentTabScreenProps<'Students'>) {
  const [students, setStudents] = useState<LinkedStudent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const [linkDialogVisible, setLinkDialogVisible] = useState(false);
  const [studentEmail, setStudentEmail] = useState('');
  const [approvalThreshold, setApprovalThreshold] = useState('');
  const [linkCategories, setLinkCategories] = useState<Set<TransactionCategory>>(new Set());
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [settingsStudent, setSettingsStudent] = useState<LinkedStudent | null>(null);
  const [settingsThreshold, setSettingsThreshold] = useState('');
  const [settingsCategories, setSettingsCategories] = useState<Set<TransactionCategory>>(new Set());
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await parentalService.getLinkedStudents();
      setStudents(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load your students.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useThrottledFocusEffect(load);

  const canLink = studentEmail.trim().length > 0 && linkCategories.size > 0 && !isLinking;

  const closeLinkDialog = () => {
    setLinkDialogVisible(false);
    setStudentEmail('');
    setApprovalThreshold('');
    setLinkCategories(new Set());
    setLinkError(null);
  };

  const openLinkDialog = () => {
    setLinkError(null);
    setLinkDialogVisible(true);
  };

  const handleLinkStudent = async () => {
    if (!canLink) return;
    setIsLinking(true);
    setLinkError(null);
    try {
      await parentalService.linkStudent({
        studentEmail: studentEmail.trim(),
        approvalThreshold: approvalThreshold.trim() === '' ? 0 : Number(approvalThreshold),
        categories: [...linkCategories],
      });
      closeLinkDialog();
      setSnackbarMessage('Student linked successfully.');
      await load();
    } catch (err) {
      setLinkError(err instanceof ApiError ? err.message : 'Could not link that student.');
    } finally {
      setIsLinking(false);
    }
  };

  const openSettingsDialog = (item: LinkedStudent) => {
    setSettingsStudent(item);
    setSettingsThreshold(
      Number(item.link.approvalThreshold) > 0 ? item.link.approvalThreshold : ''
    );
    setSettingsCategories(new Set(item.link.categories));
  };

  const closeSettingsDialog = () => {
    setSettingsStudent(null);
    setSettingsThreshold('');
    setSettingsCategories(new Set());
  };

  const canSaveSettings = settingsCategories.size > 0 && !isSavingSettings;

  const handleSaveSettings = async () => {
    if (!settingsStudent || !canSaveSettings) return;
    setIsSavingSettings(true);
    try {
      await parentalService.updateSettings(settingsStudent.student.id, {
        approvalThreshold: settingsThreshold.trim() === '' ? 0 : Number(settingsThreshold),
        categories: [...settingsCategories],
      });
      closeSettingsDialog();
      setSnackbarMessage('Student settings updated.');
      await load();
    } catch (err) {
      setSnackbarMessage(err instanceof ApiError ? err.message : 'Could not update settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="account-group-outline" size={22} color={colors.primary} />
        <Text variant="headlineSmall" style={styles.headerTitle}>
          My Students
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} />}
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {isLoading && students.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : students.length > 0 ? (
          students.map((item) => {
            const { student, wallets } = item;
            const thresholdText =
              Number(item.link.approvalThreshold) > 0
                ? `Free up to $${Number(item.link.approvalThreshold).toFixed(0)}`
                : 'No approval limit';
            return (
              <TouchableOpacity
                key={student.id}
                style={styles.studentCard}
                activeOpacity={0.8}
                onPress={() => openSettingsDialog(item)}
              >
                <View style={styles.studentTopRow}>
                  <Avatar.Text
                    size={52}
                    label={getInitials(student.fullName)}
                    style={styles.avatar}
                    color={colors.onPrimary}
                  />
                  <View style={styles.studentMiddle}>
                    <Text style={styles.studentName}>{student.fullName}</Text>
                    <Text style={styles.studentEmail}>{student.email}</Text>
                  </View>
                  <View style={styles.studentRight}>
                    <Text style={styles.studentBalance}>
                      {wallets.length > 0 ? `$${Number(wallets[0].balance).toFixed(2)}` : '—'}
                    </Text>
                    <TouchableOpacity
                      style={styles.settingsButton}
                      onPress={() => openSettingsDialog(item)}
                    >
                      <MaterialCommunityIcons name="cog-outline" size={17} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {item.link.categories.length > 0 ? (
                  <View style={styles.categoryPillsRow}>
                    {item.link.categories.map((category) => (
                      <CategoryPill key={category} category={category} />
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noCategoriesText}>No categories selected</Text>
                )}
                <Text style={styles.thresholdText}>{thresholdText}</Text>
              </TouchableOpacity>
            );
          })
        ) : (
          <Card style={styles.emptyCard} mode="elevated">
            <Card.Content style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No linked students yet</Text>
              <Text style={styles.emptySubtitle}>
                Students you link will show up here.
              </Text>
            </Card.Content>
          </Card>
        )}

        <TouchableOpacity style={styles.addRow} onPress={openLinkDialog}>
          <MaterialCommunityIcons name="plus-circle-outline" size={22} color={colors.primary} />
          <Text style={styles.addRowText}>Link Another Student</Text>
        </TouchableOpacity>
      </ScrollView>

      <Portal>
        <Dialog visible={linkDialogVisible} onDismiss={closeLinkDialog} style={styles.dialogContainer}>
          <View style={styles.dialogTitleRow}>
            <MaterialCommunityIcons name="account-plus-outline" size={20} color={colors.primary} />
            <Text style={styles.linkTitleText}>Link a Student</Text>
          </View>
          <Dialog.ScrollArea style={styles.linkScrollArea}>
            <ScrollView contentContainerStyle={styles.linkScrollContent}>
              {linkError ? (
                <View style={styles.errorBanner}>
                  <MaterialCommunityIcons name="alert-circle" size={18} color={colors.danger} />
                  <Text style={styles.errorBannerText}>{linkError}</Text>
                </View>
              ) : null}

              <Text style={styles.dialogFieldLabel}>Student Email</Text>
              <TextInput
                mode="outlined"
                placeholder="student@example.com"
                value={studentEmail}
                onChangeText={(text: string) => setStudentEmail(text)}
                keyboardType="email-address"
                autoCapitalize="none"
                left={<TextInput.Icon icon="email-outline" />}
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
                theme={{ roundness: 12 }}
                style={styles.dialogInput}
              />

              <Text style={styles.dialogFieldLabel}>Approval Threshold ($)</Text>
              <TextInput
                mode="outlined"
                placeholder="0"
                value={approvalThreshold}
                onChangeText={(text: string) => setApprovalThreshold(text.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                left={<TextInput.Icon icon="currency-usd" />}
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
                theme={{ roundness: 12 }}
                style={styles.dialogInputTight}
              />
              <Text style={styles.linkHelperText}>
                Leave empty for no approval limit. Only applies to general unlocked transfers.
              </Text>

              <Text style={styles.dialogSectionLabel}>Allowed Spending Categories</Text>
              <CategoryToggleGrid
                selected={linkCategories}
                onToggle={(category) => setLinkCategories((prev) => toggleInSet(prev, category))}
              />
              <Text style={styles.categoryExplanation}>{CATEGORY_EXPLANATION}</Text>

              <View style={styles.infoBox}>
                <View style={styles.infoBoxHeader}>
                  <Text style={styles.infoBoxIcon}>ℹ️</Text>
                  <Text style={styles.infoBoxTitle}>What is Approval Threshold?</Text>
                </View>
                <Text style={styles.infoBoxText}>
                  When your student sends money from their general balance above this amount, you
                  will be asked to approve it first. Education-locked funds you send are
                  automatically approved when spent correctly — no double approval needed.
                </Text>
                <Text style={styles.infoBoxExample}>
                  Example: Set $100 → student sending $50 is automatic, sending $200 needs your
                  approval
                </Text>
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions style={styles.dialogActions}>
            <Button
              mode="outlined"
              textColor={colors.muted}
              style={styles.dialogCancelButton}
              disabled={isLinking}
              onPress={closeLinkDialog}
            >
              Cancel
            </Button>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={!canLink}
              onPress={handleLinkStudent}
              style={styles.dialogPrimaryButtonWrapper}
            >
              <LinearGradient
                colors={canLink ? [colors.gradientStart, colors.gradientEnd] : [colors.border, colors.border]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.dialogPrimaryButton}
              >
                {isLinking ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[styles.dialogPrimaryButtonText, { color: canLink ? '#FFFFFF' : colors.muted }]}>
                    Link
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={settingsStudent !== null}
          onDismiss={closeSettingsDialog}
          style={styles.dialogContainer}
        >
          <View style={styles.dialogTitleRow}>
            <MaterialCommunityIcons name="cog-outline" size={20} color={colors.primary} />
            <Text style={styles.settingsTitleText}>
              {settingsStudent ? `${settingsStudent.student.fullName}'s Settings` : 'Student Settings'}
            </Text>
          </View>
          <Dialog.Content>
            <Text style={styles.dialogFieldLabel}>Approval Threshold ($)</Text>
            <TextInput
              mode="outlined"
              placeholder="0"
              value={settingsThreshold}
              onChangeText={(text: string) => setSettingsThreshold(text.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              left={<TextInput.Icon icon="currency-usd" />}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              theme={{ roundness: 12 }}
              style={styles.dialogInputTight}
            />
            <HelperText type="info" visible style={styles.thresholdHelperText}>
              Leave empty for no approval limit. Only applies to general unlocked transfers.
              Education-locked funds are automatically approved when spent correctly.
            </HelperText>

            <Text style={styles.dialogSectionLabel}>Allowed Spending Categories</Text>
            <CategoryToggleGrid
              selected={settingsCategories}
              onToggle={(category) => setSettingsCategories((prev) => toggleInSet(prev, category))}
            />
            <Text style={styles.categoryExplanation}>{CATEGORY_EXPLANATION}</Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button
              mode="outlined"
              textColor={colors.muted}
              style={styles.dialogCancelButton}
              disabled={isSavingSettings}
              onPress={closeSettingsDialog}
            >
              Cancel
            </Button>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={!canSaveSettings}
              onPress={handleSaveSettings}
              style={styles.dialogPrimaryButtonWrapper}
            >
              <LinearGradient
                colors={
                  canSaveSettings ? [colors.gradientStart, colors.gradientEnd] : [colors.border, colors.border]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.dialogPrimaryButton}
              >
                {isSavingSettings ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text
                    style={[
                      styles.dialogPrimaryButtonText,
                      { color: canSaveSettings ? '#FFFFFF' : colors.muted },
                    ]}
                  >
                    Save
                  </Text>
                )}
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
        {snackbarMessage ?? ''}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: {
    fontWeight: '700',
    color: colors.heading,
    marginLeft: 8,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  loading: {
    marginTop: 24,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  studentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  studentTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: colors.primary,
  },
  studentMiddle: {
    flex: 1,
    marginLeft: 12,
  },
  studentName: {
    fontWeight: '700',
    fontSize: 16,
    color: colors.heading,
  },
  studentEmail: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  studentRight: {
    alignItems: 'flex-end',
  },
  studentBalance: {
    fontWeight: '700',
    color: colors.primary,
    fontSize: 15,
  },
  settingsButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: `${colors.primary}1F`,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  categoryPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  categoryPill: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 6,
    marginBottom: 6,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  noCategoriesText: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 10,
  },
  thresholdText: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  emptyCard: {
    borderRadius: 16,
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyTitle: {
    fontWeight: '700',
    color: colors.heading,
    marginBottom: 6,
  },
  emptySubtitle: {
    color: colors.muted,
    textAlign: 'center',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 16,
  },
  addRowText: {
    marginLeft: 8,
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  dialogInput: {
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${colors.danger}1F`,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  dialogInputTight: {
    backgroundColor: '#FFFFFF',
    marginBottom: 0,
  },
  thresholdHelperText: {
    marginBottom: 12,
    paddingHorizontal: 0,
  },
  categoryExplanation: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
    marginTop: 8,
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
  settingsTitleText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: 8,
    flexShrink: 1,
  },
  linkTitleText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: 8,
    flexShrink: 1,
  },
  linkScrollArea: {
    paddingHorizontal: 0,
    maxHeight: 420,
  },
  linkScrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  linkHelperText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: colors.muted,
    marginTop: 6,
    marginBottom: 12,
  },
  dialogFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  dialogSectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 6,
    marginBottom: 10,
  },
  categoryToggleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  categoryToggleChip: {
    width: '31%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
    marginBottom: 10,
  },
  categoryToggleChipGap: {
    marginRight: '3.5%',
  },
  categoryToggleChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryToggleChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    marginLeft: 5,
    flexShrink: 1,
  },
  categoryToggleChipTextSelected: {
    color: '#FFFFFF',
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
    marginBottom: 8,
  },
  infoBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoBoxIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  infoBoxTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  infoBoxText: {
    fontSize: 12,
    color: colors.heading,
    lineHeight: 17,
  },
  infoBoxExample: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
    fontStyle: 'italic',
    marginTop: 8,
  },
  dialogActions: {
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
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
});
