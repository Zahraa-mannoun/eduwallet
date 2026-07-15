import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import type { RouteProp } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ParentDashboardScreen from '../screens/ParentDashboardScreen';
import ParentSendMoneyScreen from '../screens/ParentSendMoneyScreen';
import ApprovalsListScreen from '../screens/ApprovalsListScreen';
import StudentsListScreen from '../screens/StudentsListScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { colors } from '../theme/colors';
import type { ParentTabParamList } from './types';

const Tab = createBottomTabNavigator<ParentTabParamList>();

const TAB_ICONS: Record<keyof ParentTabParamList, keyof typeof MaterialCommunityIcons.glyphMap> = {
  Home: 'view-dashboard-outline',
  Send: 'send-outline',
  Approvals: 'clipboard-check-outline',
  Students: 'account-group-outline',
  Profile: 'account-circle-outline',
};

export default function ParentMainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({
        route,
      }: {
        route: RouteProp<ParentTabParamList, keyof ParentTabParamList>;
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
      <Tab.Screen name="Home" component={ParentDashboardScreen} />
      <Tab.Screen name="Send" component={ParentSendMoneyScreen} />
      <Tab.Screen name="Approvals" component={ApprovalsListScreen} />
      <Tab.Screen name="Students" component={StudentsListScreen} />
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
