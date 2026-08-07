import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, IconButton, Text, TouchableRipple } from 'react-native-paper';
import { colors } from '../theme/colors';
import { useNotifications } from '../context/NotificationsContext';
import UniversityStudentsTab from './UniversityStudentsTab';
import ScholarshipPortalTab from './ScholarshipPortalTab';
import IndividualFundingTab from './IndividualFundingTab';
import type { InstitutionTabScreenProps } from '../navigation/types';

type DashboardTab = 'students' | 'portal' | 'individual';

const TABS: ReadonlyArray<{ key: DashboardTab; label: string }> = [
  { key: 'students', label: 'University Students' },
  { key: 'portal', label: 'Scholarship Portal' },
  { key: 'individual', label: 'Individual Funding' },
];

// The Institution dashboard's single bottom tab ("Portal"), split into 3 internal tabs. Each
// tab is a plain child component (not a separate navigator route) so switching between them
// is just local state — conditionally rendering only the active one also means it remounts
// fresh every time it becomes active, which is what keeps each tab's own useFocusEffect-driven
// data load correct without any extra cross-tab refresh wiring.
export default function ScholarshipPortalScreen({
  navigation,
}: Readonly<InstitutionTabScreenProps<'Portal'>>) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('students');
  const { unreadCount } = useNotifications();

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Institution Dashboard
        </Text>
        <View style={styles.bellWrapper}>
          <IconButton
            icon="bell-outline"
            iconColor={colors.heading}
            size={22}
            onPress={() => navigation.navigate('Notifications')}
            style={styles.bellButton}
          />
          {unreadCount > 0 && <Badge style={styles.bellDot} size={10} />}
        </View>
      </View>

      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableRipple
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tabItem, active && styles.tabItemActive]}
            >
              <Text
                style={[styles.tabLabel, active && styles.tabLabelActive]}
                numberOfLines={2}
              >
                {tab.label}
              </Text>
            </TouchableRipple>
          );
        })}
      </View>

      {activeTab === 'students' && (
        <UniversityStudentsTab onProceedToPortal={() => setActiveTab('portal')} />
      )}
      {activeTab === 'portal' && <ScholarshipPortalTab />}
      {activeTab === 'individual' && <IndividualFundingTab />}
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerTitle: {
    fontWeight: '700',
    color: colors.heading,
    flexShrink: 1,
  },
  bellWrapper: {
    marginLeft: 8,
  },
  bellButton: {
    margin: 0,
  },
  bellDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: colors.danger,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
  },
  tabItem: {
    flex: 1,
    borderRadius: 9,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: {
    backgroundColor: colors.primary,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: colors.onPrimary,
  },
});
