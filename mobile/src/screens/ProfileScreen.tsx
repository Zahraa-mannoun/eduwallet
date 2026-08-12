import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Button, Chip, Dialog, Portal, Text } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { USER_TYPES } from '../constants/userTypes';
import { useAuth } from '../context/AuthContext';
import * as kycService from '../services/kycService';
import * as parentalService from '../services/parentalService';
import type { LinkedStudent } from '../services/parentalService';
import { colors } from '../theme/colors';
import { getInitials } from '../utils/getInitials';
import { getEffectiveKYCStatus } from '../utils/kycStatus';
import type { EffectiveKYCStatus } from '../utils/kycStatus';
import type { RootStackParamList } from '../navigation/types';

const KYC_BADGES: Record<EffectiveKYCStatus, { label: string; color: string }> = {
  UNVERIFIED: { label: 'Not submitted', color: colors.muted },
  PENDING: { label: 'Pending', color: '#F59E0B' },
  VERIFIED: { label: 'Verified', color: '#3DDC97' },
  REJECTED: { label: 'Rejected', color: '#DC2626' },
};

type MenuItemDef = {
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  badge?: { label: string; color: string };
  // Security & 2FA has no destination screen yet — omitted rather than pointed at a route
  // that doesn't exist, same as it was before this redesign (a non-interactive placeholder).
  onPress?: () => void;
};

type ProfileScreenProps = Readonly<{
  navigation: NavigationProp<RootStackParamList>;
}>;

function MenuRow({ item, isLast }: Readonly<{ item: MenuItemDef; isLast: boolean }>) {
  return (
    <View>
      <TouchableOpacity activeOpacity={0.65} onPress={item.onPress} style={styles.menuRow}>
        <View style={[styles.menuIconCircle, { backgroundColor: `${item.color}1F` }]}>
          <MaterialCommunityIcons name={item.icon} size={19} color={item.color} />
        </View>
        <Text style={styles.menuLabel} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={styles.menuRight}>
          {item.badge ? (
            <Chip
              compact
              style={[styles.menuBadge, { backgroundColor: `${item.badge.color}1F` }]}
              textStyle={[styles.menuBadgeText, { color: item.badge.color }]}
            >
              {item.badge.label}
            </Chip>
          ) : null}
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
        </View>
      </TouchableOpacity>
      {!isLast && <View style={styles.menuDivider} />}
    </View>
  );
}

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { user, logout, refreshUser } = useAuth();
  const displayName = user?.fullName || 'there';
  const typeDefinition = USER_TYPES.find((type) => type.key === user?.userType) ?? USER_TYPES[0];
  const [hasKycDocuments, setHasKycDocuments] = useState(false);
  // Populated only while the multi-student picker dialog is open — empty/closed otherwise.
  const [studentPickerOptions, setStudentPickerOptions] = useState<LinkedStudent[]>([]);

  const loadKycDocuments = useCallback(async () => {
    if (user?.userType !== 'STUDENT') return;
    try {
      const result = await kycService.getMyDocuments();
      setHasKycDocuments(result.length > 0);
    } catch {
      // Verification badge falls back to treating the student as unverified on failure.
    }
  }, [user?.userType]);

  // Unthrottled: KYC status must update immediately when the student returns here after an
  // admin approves/rejects their documents, not up to 30s later — same reasoning as
  // BudgetScreen/CardsScreen. refreshUser() re-fetches GET /auth/me so user.kycStatus (the
  // badge above reads it via getEffectiveKYCStatus) reflects the latest admin decision, not
  // just whatever was current when the app first loaded.
  useFocusEffect(
    useCallback(() => {
      void refreshUser();
      void loadKycDocuments();
    }, [refreshUser, loadKycDocuments])
  );

  const effectiveKycStatus = user ? getEffectiveKYCStatus(user.kycStatus, hasKycDocuments) : 'UNVERIFIED';
  const kycBadge = user ? KYC_BADGES[effectiveKycStatus] : undefined;

  const handleLogout = async () => {
    await logout();
    // AppNavigator reacts to the resulting auth state and switches back to Login on its own.
  };

  const goToStudentReceipts = (studentId: string, studentName: string, studentEmail: string) => {
    navigation.navigate('ParentStudentDetail', { studentId, studentName, studentEmail });
  };

  const handleStudentReceiptsPress = async () => {
    try {
      const students = await parentalService.getLinkedStudents();
      if (students.length === 0) {
        navigation.navigate('NoLinkedStudents');
        return;
      }
      if (students.length === 1) {
        goToStudentReceipts(
          students[0].student.id,
          students[0].student.fullName,
          students[0].student.email
        );
        return;
      }
      // More than a couple of options here would overflow Alert.alert's button list (it's only
      // reliable for ~3 buttons across iOS/Android), so a real in-app picker is used instead —
      // also works on web, where Alert.alert itself is a no-op.
      setStudentPickerOptions(students);
    } catch {
      navigation.navigate('NoLinkedStudents');
    }
  };

  const closeStudentPicker = () => setStudentPickerOptions([]);

  const handlePickStudent = (item: LinkedStudent) => {
    closeStudentPicker();
    goToStudentReceipts(item.student.id, item.student.fullName, item.student.email);
  };

  const FINANCIAL_ITEMS: MenuItemDef[] = [
    ...(user?.userType === 'INSTITUTION'
      ? [
          {
            title: 'My Wallet',
            icon: 'wallet-outline' as const,
            color: colors.primary,
            onPress: () => navigation.navigate('InstitutionWallet'),
          },
        ]
      : []),
    {
      title: 'Transaction History',
      icon: 'history',
      color: '#6366F1',
      onPress: () => navigation.navigate('TransactionHistory'),
    },
    ...(user?.userType === 'PARENT'
      ? [
          {
            title: 'Student Receipts',
            icon: 'receipt-text-outline' as const,
            color: '#F59E0B',
            onPress: () => void handleStudentReceiptsPress(),
          },
          {
            title: 'Request History Report',
            icon: 'file-chart-outline' as const,
            color: '#8B5CF6',
            onPress: () => navigation.navigate('ReportRequest'),
          },
          {
            title: 'My Reports',
            icon: 'file-document-multiple-outline' as const,
            color: '#0EA5E9',
            onPress: () => navigation.navigate('ReportHistory'),
          },
        ]
      : []),
    ...(user?.userType === 'STUDENT'
      ? [
          {
            title: 'University Verification',
            icon: 'card-account-details-outline' as const,
            color: colors.primary,
            badge: kycBadge,
            onPress: () => navigation.navigate('KYC'),
          },
          {
            title: 'Personal Savings',
            icon: 'piggy-bank-outline' as const,
            color: '#EAB308',
            onPress: () => navigation.navigate('PersonalSavings'),
          },
          {
            title: 'Blockchain Vault',
            icon: 'cube-outline' as const,
            color: '#4338CA',
            onPress: () => navigation.navigate('BlockchainVault'),
          },
          {
            title: 'AI Assistant',
            icon: 'robot-outline' as const,
            color: '#14B8A6',
            onPress: () => navigation.navigate('AIAssistant'),
          },
        ]
      : []),
  ];

  const ACCOUNT_SETTINGS_ITEMS: MenuItemDef[] = [
    {
      title: 'Account Settings',
      icon: 'account-cog-outline',
      color: '#64748B',
      onPress: () => navigation.navigate('AccountSettings'),
    },
    {
      title: 'Security & 2FA',
      icon: 'shield-check-outline',
      color: '#10B981',
    },
    {
      title: 'Help & Support',
      icon: 'help-circle-outline',
      color: '#F97316',
      onPress: () => navigation.navigate('HelpSupport'),
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Avatar.Text
            size={80}
            label={getInitials(displayName)}
            style={styles.avatar}
            color={colors.onPrimary}
          />
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{user?.email ?? ''}</Text>
          <Chip
            icon={typeDefinition.icon}
            style={styles.typeBadge}
            textStyle={styles.typeBadgeText}
            compact
          >
            {typeDefinition.label}
          </Chip>
        </View>

        <Text style={styles.sectionLabel}>Financial</Text>
        <View style={styles.section}>
          {FINANCIAL_ITEMS.map((item, index) => (
            <MenuRow key={item.title} item={item} isLast={index === FINANCIAL_ITEMS.length - 1} />
          ))}
        </View>

        <Text style={styles.sectionLabel}>Account Settings</Text>
        <View style={styles.section}>
          {ACCOUNT_SETTINGS_ITEMS.map((item, index) => (
            <MenuRow key={item.title} item={item} isLast={index === ACCOUNT_SETTINGS_ITEMS.length - 1} />
          ))}
        </View>

        <Button
          mode="outlined"
          icon="logout"
          textColor={colors.danger}
          style={styles.logoutButton}
          contentStyle={styles.logoutButtonContent}
          onPress={handleLogout}
        >
          Log Out
        </Button>
      </ScrollView>

      <Portal>
        <Dialog visible={studentPickerOptions.length > 0} onDismiss={closeStudentPicker} style={styles.pickerDialog}>
          <View style={styles.pickerTitleRow}>
            <MaterialCommunityIcons name="receipt-text-outline" size={22} color={colors.primary} />
            <Text style={styles.pickerTitleText}>Select Student</Text>
          </View>
          <Dialog.ScrollArea style={styles.pickerScrollArea}>
            <ScrollView contentContainerStyle={styles.pickerList}>
              {studentPickerOptions.map((item, index) => (
                <View key={item.student.id}>
                  <Pressable
                    onPress={() => handlePickStudent(item)}
                    style={({ pressed }) => [styles.pickerRow, pressed && styles.pickerRowPressed]}
                  >
                    <Avatar.Text
                      size={40}
                      label={getInitials(item.student.fullName)}
                      style={styles.pickerAvatar}
                      color={colors.onPrimary}
                    />
                    <View style={styles.pickerInfo}>
                      <Text style={styles.pickerName}>{item.student.fullName}</Text>
                      <Text style={styles.pickerEmail}>{item.student.email}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
                  </Pressable>
                  {index < studentPickerOptions.length - 1 && <View style={styles.pickerDivider} />}
                </View>
              ))}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions style={styles.pickerActions}>
            <Button
              mode="outlined"
              textColor={colors.danger}
              style={styles.pickerCancelButton}
              contentStyle={styles.pickerCancelButtonContent}
              onPress={closeStudentPicker}
            >
              Cancel
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  avatar: {
    backgroundColor: colors.primary,
    marginBottom: 14,
  },
  name: {
    fontWeight: '700',
    fontSize: 20,
    color: colors.heading,
  },
  email: {
    color: colors.muted,
    marginTop: 2,
  },
  typeBadge: {
    backgroundColor: '#EAF0FA',
    marginTop: 12,
  },
  typeBadgeText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginHorizontal: 24,
    marginBottom: 8,
    marginTop: 18,
  },
  section: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  menuIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.heading,
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuBadge: {
    height: 26,
    marginRight: 2,
  },
  menuBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 60,
  },
  logoutButton: {
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 12,
    borderColor: colors.danger,
  },
  logoutButtonContent: {
    paddingVertical: 4,
  },
  pickerDialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  pickerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 24,
    paddingBottom: 8,
    paddingHorizontal: 20,
  },
  pickerTitleText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.heading,
    marginLeft: 8,
    textAlign: 'center',
  },
  pickerScrollArea: {
    paddingHorizontal: 0,
    maxHeight: 320,
  },
  pickerList: {
    paddingBottom: 8,
    paddingTop: 4,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  pickerRowPressed: {
    backgroundColor: colors.surface,
  },
  pickerAvatar: {
    backgroundColor: colors.primary,
    marginRight: 12,
  },
  pickerInfo: {
    flex: 1,
  },
  pickerName: {
    fontWeight: '700',
    color: colors.heading,
    fontSize: 14,
  },
  pickerEmail: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  pickerDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 20,
  },
  pickerActions: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 8,
  },
  pickerCancelButton: {
    flex: 1,
    borderRadius: 12,
    borderColor: colors.danger,
  },
  pickerCancelButtonContent: {
    paddingVertical: 4,
  },
});
