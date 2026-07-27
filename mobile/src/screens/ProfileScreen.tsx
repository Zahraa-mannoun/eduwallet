import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Button, Chip, Divider, List, Text } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { USER_TYPES } from '../constants/userTypes';
import { useAuth } from '../context/AuthContext';
import * as kycService from '../services/kycService';
import { colors } from '../theme/colors';
import { getInitials } from '../utils/getInitials';
import { getEffectiveKYCStatus } from '../utils/kycStatus';
import type { EffectiveKYCStatus } from '../utils/kycStatus';
import type { RootStackParamList } from '../navigation/types';

type ListIconRenderProps = Readonly<{ color: string; style?: StyleProp<ViewStyle> }>;

const renderChevron = (props: ListIconRenderProps) => <List.Icon {...props} icon="chevron-right" />;

const renderLeftIcon = (icon: string) => (props: ListIconRenderProps) =>
  <List.Icon {...props} icon={icon} />;

const renderRightWithBadge = (badge?: { label: string; color: string }) => (props: ListIconRenderProps) => (
  <View style={styles.menuItemRight}>
    {badge ? (
      <Chip
        compact
        style={[styles.menuBadge, { backgroundColor: `${badge.color}1F` }]}
        textStyle={[styles.menuBadgeText, { color: badge.color }]}
      >
        {badge.label}
      </Chip>
    ) : null}
    <List.Icon {...props} icon="chevron-right" />
  </View>
);

const STATIC_PROFILE_MENU_ITEMS = [
  { title: 'Security & 2FA', icon: 'shield-check-outline' },
  { title: 'Notifications', icon: 'bell-outline' },
  { title: 'Help & Support', icon: 'help-circle-outline' },
] as const;

const KYC_BADGES: Record<EffectiveKYCStatus, { label: string; color: string }> = {
  UNVERIFIED: { label: 'Not submitted', color: colors.muted },
  PENDING: { label: 'Pending', color: '#F59E0B' },
  VERIFIED: { label: 'Verified', color: '#3DDC97' },
  REJECTED: { label: 'Rejected', color: '#DC2626' },
};

type ProfileScreenProps = Readonly<{
  navigation: NavigationProp<RootStackParamList>;
}>;

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { user, logout } = useAuth();
  const displayName = user?.fullName || 'there';
  const typeDefinition = USER_TYPES.find((type) => type.key === user?.userType) ?? USER_TYPES[0];
  const [hasKycDocuments, setHasKycDocuments] = useState(false);

  const loadKycDocuments = useCallback(async () => {
    if (user?.userType !== 'STUDENT') return;
    try {
      const result = await kycService.getMyDocuments();
      setHasKycDocuments(result.length > 0);
    } catch {
      // Verification badge falls back to treating the student as unverified on failure.
    }
  }, [user?.userType]);

  // Unthrottled: KYC status must update immediately when the student returns here after
  // submitting documents, not up to 30s later — same reasoning as BudgetScreen/CardsScreen.
  useFocusEffect(
    useCallback(() => {
      void loadKycDocuments();
    }, [loadKycDocuments])
  );

  const effectiveKycStatus = user ? getEffectiveKYCStatus(user.kycStatus, hasKycDocuments) : 'UNVERIFIED';
  const kycBadge = user ? KYC_BADGES[effectiveKycStatus] : undefined;

  const handleLogout = async () => {
    await logout();
    // AppNavigator reacts to the resulting auth state and switches back to Login on its own.
  };

  const ACCOUNT_LINKS = [
    {
      title: 'Transaction History',
      icon: 'history',
      onPress: () => navigation.navigate('TransactionHistory'),
    },
    ...(user?.userType === 'STUDENT'
      ? [
          {
            title: 'University Verification',
            icon: 'card-account-details-outline',
            badge: kycBadge,
            onPress: () => navigation.navigate('KYC'),
          },
          {
            title: 'Blockchain Vault',
            icon: 'cube-outline',
            onPress: () => navigation.navigate('BlockchainVault'),
          },
          {
            title: 'AI Assistant',
            icon: 'robot-outline',
            onPress: () => navigation.navigate('AIAssistant'),
          },
        ]
      : []),
  ] as const;

  const PROFILE_MENU_ITEMS = [
    {
      title: 'Account Settings',
      icon: 'account-cog-outline',
      onPress: () => navigation.navigate('AccountSettings'),
    },
    ...STATIC_PROFILE_MENU_ITEMS,
  ] as const;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Avatar.Text
            size={72}
            label={getInitials(displayName)}
            style={styles.avatar}
            color={colors.onPrimary}
          />
          <Text variant="titleLarge" style={styles.name}>
            {displayName}
          </Text>
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

        <List.Section style={styles.section}>
          {ACCOUNT_LINKS.map((item, index) => (
            <View key={item.title}>
              <List.Item
                title={item.title}
                onPress={item.onPress}
                left={renderLeftIcon(item.icon)}
                right={renderRightWithBadge('badge' in item ? item.badge : undefined)}
              />
              {index < ACCOUNT_LINKS.length - 1 && <Divider />}
            </View>
          ))}
        </List.Section>

        <List.Section style={[styles.section, styles.secondSection]}>
          {PROFILE_MENU_ITEMS.map((item, index) => (
            <View key={item.title}>
              <List.Item
                title={item.title}
                onPress={'onPress' in item ? item.onPress : undefined}
                left={renderLeftIcon(item.icon)}
                right={renderChevron}
              />
              {index < PROFILE_MENU_ITEMS.length - 1 && <Divider />}
            </View>
          ))}
        </List.Section>

        <Button
          mode="outlined"
          textColor={colors.danger}
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          Log Out
        </Button>
      </ScrollView>
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
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuBadge: {
    height: 26,
  },
  menuBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  secondSection: {
    marginTop: 16,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  avatar: {
    backgroundColor: colors.primary,
    marginBottom: 12,
  },
  name: {
    fontWeight: '700',
    color: colors.heading,
  },
  email: {
    color: colors.muted,
    marginTop: 2,
  },
  typeBadge: {
    backgroundColor: '#EAF0FA',
    marginTop: 10,
  },
  typeBadgeText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  section: {
    marginHorizontal: 20,
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  logoutButton: {
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 10,
    borderColor: colors.danger,
  },
});
