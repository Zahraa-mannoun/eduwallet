import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import type { RouteProp } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ScholarshipPortalScreen from '../screens/ScholarshipPortalScreen';
import InstitutionStudentsScreen from '../screens/InstitutionStudentsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { colors } from '../theme/colors';
import type { InstitutionTabParamList } from './types';

const Tab = createBottomTabNavigator<InstitutionTabParamList>();

const TAB_ICONS: Record<keyof InstitutionTabParamList, keyof typeof MaterialCommunityIcons.glyphMap> = {
  Portal: 'school-outline',
  Students: 'account-school-outline',
  Profile: 'account-circle-outline',
};

export default function InstitutionMainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({
        route,
      }: {
        route: RouteProp<InstitutionTabParamList, keyof InstitutionTabParamList>;
      }): BottomTabNavigationOptions => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarIcon: ({ color, size }) => (
          <MaterialCommunityIcons name={TAB_ICONS[route.name]} color={color} size={size} />
        ),
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
      })}
    >
      <Tab.Screen name="Portal" component={ScholarshipPortalScreen} />
      <Tab.Screen name="Students" component={InstitutionStudentsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 64,
    paddingBottom: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
