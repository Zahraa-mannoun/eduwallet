import { ScrollView, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Button, Chip, Divider, List, Text } from 'react-native-paper';
import { colors } from '../theme/colors';
import type { MainTabScreenProps } from '../navigation/types';

type ListIconRenderProps = Readonly<{ color: string; style?: StyleProp<ViewStyle> }>;

const renderChevron = (props: ListIconRenderProps) => <List.Icon {...props} icon="chevron-right" />;

const renderLeftIcon = (icon: string) => (props: ListIconRenderProps) =>
  <List.Icon {...props} icon={icon} />;

const PROFILE_MENU_ITEMS = [
  { title: 'Account Settings', icon: 'account-cog-outline' },
  { title: 'Security & 2FA', icon: 'shield-check-outline' },
  { title: 'Notifications', icon: 'bell-outline' },
  { title: 'Help & Support', icon: 'help-circle-outline' },
] as const;

export default function ProfileScreen({ navigation }: MainTabScreenProps<'Profile'>) {
  const handleLogout = () => {
    navigation.getParent()?.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Avatar.Text size={72} label="ZS" style={styles.avatar} color={colors.onPrimary} />
          <Text variant="titleLarge" style={styles.name}>
            Zahraa Student
          </Text>
          <Text style={styles.email}>student@university.edu.lb</Text>
          <Chip
            icon="school-outline"
            style={styles.typeBadge}
            textStyle={styles.typeBadgeText}
            compact
          >
            Student
          </Chip>
        </View>

        <List.Section style={styles.section}>
          {PROFILE_MENU_ITEMS.map((item, index) => (
            <View key={item.title}>
              <List.Item
                title={item.title}
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
