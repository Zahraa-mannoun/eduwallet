import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Chip,
  Dialog,
  HelperText,
  IconButton,
  Portal,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { TransactionCategory } from '../types/api';
import { BUDGET_CATEGORIES, LOCKABLE_BUDGET_CATEGORIES } from '../constants/budgetCategories';
import { colors } from '../theme/colors';
import { useThrottledFocusEffect } from '../hooks/useThrottledFocusEffect';
import * as parentalService from '../services/parentalService';
import type { LinkedStudent } from '../services/parentalService';
import { ApiError } from '../services/api';
import { getInitials } from '../utils/getInitials';
import type { ParentTabScreenProps } from '../navigation/types';

const CATEGORY_EXPLANATION =
  'Select which categories your student can spend locked funds in. They cannot spend in unselected categories.';

function categoryLabel(category: TransactionCategory): string {
  return (
    BUDGET_CATEGORIES.find((definition) => definition.key.toUpperCase() === category)?.label ??
    category
  );
}

function formatPermissionsSummary(link: LinkedStudent['link']): string {
  const categories =
    link.categories.length > 0 ? link.categories.map(categoryLabel).join(', ') : 'No categories';
  const threshold =
    Number(link.approvalThreshold) > 0
      ? `Free up to $${Number(link.approvalThreshold).toFixed(0)}`
      : 'No approval limit';
  return `${categories} · ${threshold}`;
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

type CategoryChipsSelectorProps = Readonly<{
  selected: Set<TransactionCategory>;
  onToggle: (category: TransactionCategory) => void;
}>;

function CategoryChipsSelector({ selected, onToggle }: CategoryChipsSelectorProps) {
  return (
    <View style={styles.categoryChipsRow}>
      {LOCKABLE_BUDGET_CATEGORIES.map((category) => {
        const txCategory = category.key.toUpperCase() as TransactionCategory;
        const isSelected = selected.has(txCategory);
        return (
          <Chip
            key={category.key}
            selected={isSelected}
            onPress={() => onToggle(txCategory)}
            style={styles.categoryChoiceChip}
          >
            {category.label}
          </Chip>
        );
      })}
    </View>
  );
}

export default function StudentsListScreen({ navigation }: ParentTabScreenProps<'Students'>) {
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
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Students
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
            return (
              <TouchableOpacity
                key={student.id}
                style={styles.studentRow}
                onPress={() => navigation.navigate('Home')}
              >
                <Avatar.Text
                  size={48}
                  label={getInitials(student.fullName)}
                  style={styles.avatar}
                  color={colors.onPrimary}
                />
                <View style={styles.studentMiddle}>
                  <Text style={styles.studentName}>{student.fullName}</Text>
                  <Text style={styles.studentUniversity}>{student.email}</Text>
                  <Text style={styles.studentPermissions} numberOfLines={1}>
                    {formatPermissionsSummary(item.link)}
                  </Text>
                </View>
                <View style={styles.studentRight}>
                  <Text style={styles.studentBalance}>
                    {wallets.length > 0 ? `$${Number(wallets[0].balance).toFixed(2)}` : '—'}
                  </Text>
                  <IconButton
                    icon="cog-outline"
                    size={18}
                    iconColor={colors.onPrimary}
                    style={styles.settingsButton}
                    onPress={() => openSettingsDialog(item)}
                  />
                </View>
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
        <Dialog visible={linkDialogVisible} onDismiss={closeLinkDialog}>
          <Dialog.Title>Link a Student</Dialog.Title>
          <Dialog.Content>
            {linkError ? (
              <View style={styles.errorBanner}>
                <MaterialCommunityIcons name="alert-circle" size={18} color={colors.danger} />
                <Text style={styles.errorBannerText}>{linkError}</Text>
              </View>
            ) : null}
            <TextInput
              mode="outlined"
              label="Student email"
              value={studentEmail}
              onChangeText={(text: string) => setStudentEmail(text)}
              keyboardType="email-address"
              autoCapitalize="none"
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              style={styles.dialogInput}
            />
            <TextInput
              mode="outlined"
              label="Approval threshold ($)"
              value={approvalThreshold}
              onChangeText={(text: string) => setApprovalThreshold(text.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              style={styles.dialogInput}
            />
            <HelperText type="info" visible style={styles.thresholdHelperText}>
              Leave empty for no approval limit. Only applies to general unlocked transfers.
            </HelperText>

            <Text style={styles.fieldLabel}>Allowed Spending Categories</Text>
            <CategoryChipsSelector
              selected={linkCategories}
              onToggle={(category) => setLinkCategories((prev) => toggleInSet(prev, category))}
            />
            <Text style={styles.categoryExplanation}>{CATEGORY_EXPLANATION}</Text>

            <View style={styles.thresholdInfoBox}>
              <Text style={styles.thresholdInfoTitle}>What is Approval Threshold?</Text>
              <Text style={styles.thresholdInfoText}>
                When your student sends money from their general balance above this amount, you
                will be asked to approve it first. Education-locked funds you send are
                automatically approved when spent correctly — no double approval needed.
              </Text>
              <Text style={styles.thresholdInfoExample}>
                Example: Set $100 → student sending $50 is automatic, sending $200 needs your
                approval
              </Text>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeLinkDialog} disabled={isLinking}>
              Cancel
            </Button>
            <Button onPress={handleLinkStudent} disabled={!canLink}>
              {isLinking ? <ActivityIndicator size={16} color={colors.primary} /> : 'Link'}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={settingsStudent !== null} onDismiss={closeSettingsDialog}>
          <Dialog.Title>
            {settingsStudent ? `${settingsStudent.student.fullName}'s Settings` : 'Student Settings'}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Approval threshold ($)"
              value={settingsThreshold}
              onChangeText={(text: string) => setSettingsThreshold(text.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              style={styles.dialogInputTight}
            />
            <HelperText type="info" visible style={styles.thresholdHelperText}>
              Leave empty for no approval limit. Only applies to general unlocked transfers.
              Education-locked funds are automatically approved when spent correctly.
            </HelperText>

            <Text style={styles.fieldLabel}>Allowed Spending Categories</Text>
            <CategoryChipsSelector
              selected={settingsCategories}
              onToggle={(category) => setSettingsCategories((prev) => toggleInSet(prev, category))}
            />
            <Text style={styles.categoryExplanation}>{CATEGORY_EXPLANATION}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeSettingsDialog} disabled={isSavingSettings}>
              Cancel
            </Button>
            <Button onPress={handleSaveSettings} disabled={!canSaveSettings}>
              {isSavingSettings ? <ActivityIndicator size={16} color={colors.primary} /> : 'Save'}
            </Button>
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
  loading: {
    marginTop: 24,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  avatar: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  studentMiddle: {
    flex: 1,
    marginLeft: 12,
  },
  studentName: {
    fontWeight: '700',
    color: colors.onPrimary,
  },
  studentUniversity: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  studentPermissions: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 3,
  },
  studentRight: {
    alignItems: 'flex-end',
  },
  studentBalance: {
    fontWeight: '700',
    color: colors.onPrimary,
    fontSize: 15,
  },
  settingsButton: {
    margin: 0,
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
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 16,
  },
  addRowText: {
    marginLeft: 8,
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  dialogInput: {
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
    marginBottom: 0,
  },
  thresholdHelperText: {
    marginBottom: 12,
    paddingHorizontal: 0,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.label,
    marginBottom: 8,
  },
  categoryChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChoiceChip: {
    marginRight: 4,
    marginBottom: 4,
  },
  categoryExplanation: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
    marginTop: 8,
  },
  thresholdInfoBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  thresholdInfoTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.heading,
    marginBottom: 4,
  },
  thresholdInfoText: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
  },
  thresholdInfoExample: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 8,
  },
});
