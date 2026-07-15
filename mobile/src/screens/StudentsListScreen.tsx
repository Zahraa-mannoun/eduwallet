import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Dialog,
  Portal,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useThrottledFocusEffect } from '../hooks/useThrottledFocusEffect';
import * as parentalService from '../services/parentalService';
import type { LinkedStudent } from '../services/parentalService';
import { ApiError } from '../services/api';
import { getInitials } from '../utils/getInitials';
import type { ParentTabScreenProps } from '../navigation/types';

export default function StudentsListScreen({ navigation }: ParentTabScreenProps<'Students'>) {
  const [students, setStudents] = useState<LinkedStudent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const [linkDialogVisible, setLinkDialogVisible] = useState(false);
  const [studentEmail, setStudentEmail] = useState('');
  const [approvalThreshold, setApprovalThreshold] = useState('');
  const [isLinking, setIsLinking] = useState(false);

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

  const canLink = studentEmail.trim().length > 0 && Number(approvalThreshold) > 0 && !isLinking;

  const closeLinkDialog = () => {
    setLinkDialogVisible(false);
    setStudentEmail('');
    setApprovalThreshold('');
  };

  const handleLinkStudent = async () => {
    if (!canLink) return;
    setIsLinking(true);
    try {
      await parentalService.linkStudent({
        studentEmail: studentEmail.trim(),
        approvalThreshold: Number(approvalThreshold),
      });
      closeLinkDialog();
      setSnackbarMessage('Student linked successfully.');
      await load();
    } catch (err) {
      setSnackbarMessage(err instanceof ApiError ? err.message : 'Could not link that student.');
    } finally {
      setIsLinking(false);
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
          students.map(({ student, wallets }) => (
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
              </View>
              <Text style={styles.studentBalance}>
                {wallets.length > 0
                  ? `$${Number(wallets[0].balance).toFixed(2)}`
                  : '—'}
              </Text>
            </TouchableOpacity>
          ))
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

        <TouchableOpacity style={styles.addRow} onPress={() => setLinkDialogVisible(true)}>
          <MaterialCommunityIcons name="plus-circle-outline" size={22} color={colors.primary} />
          <Text style={styles.addRowText}>Link Another Student</Text>
        </TouchableOpacity>
      </ScrollView>

      <Portal>
        <Dialog visible={linkDialogVisible} onDismiss={closeLinkDialog}>
          <Dialog.Title>Link a Student</Dialog.Title>
          <Dialog.Content>
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
            />

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
  studentBalance: {
    fontWeight: '700',
    color: colors.onPrimary,
    fontSize: 15,
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
