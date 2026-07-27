import { StyleSheet, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import SendMoneyScreen from '../screens/SendMoneyScreen';
import ReceiveMoneyScreen from '../screens/ReceiveMoneyScreen';
import QRPayScreen from '../screens/QRPayScreen';
import TransactionHistoryScreen from '../screens/TransactionHistoryScreen';
import TransactionDetailScreen from '../screens/TransactionDetailScreen';
import ApprovalRequestScreen from '../screens/ApprovalRequestScreen';
import KYCScreen from '../screens/KYCScreen';
import BlockchainVaultScreen from '../screens/BlockchainVaultScreen';
import AIAssistantScreen from '../screens/AIAssistantScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import AccountSettingsScreen from '../screens/AccountSettingsScreen';
import SupportMessageScreen from '../screens/SupportMessageScreen';
import StudentMainNavigator from './StudentMainNavigator';
import ParentMainNavigator from './ParentMainNavigator';
import InstitutionMainNavigator from './InstitutionMainNavigator';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated || !user ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="SupportMessage" component={SupportMessageScreen} />
        </>
      ) : (
        <>
          {user.userType === 'STUDENT' && (
            <Stack.Screen name="StudentMain" component={StudentMainNavigator} />
          )}
          {user.userType === 'PARENT' && (
            <Stack.Screen name="ParentMain" component={ParentMainNavigator} />
          )}
          {user.userType === 'INSTITUTION' && (
            <Stack.Screen name="InstitutionMain" component={InstitutionMainNavigator} />
          )}
          <Stack.Screen name="SendMoney" component={SendMoneyScreen} />
          <Stack.Screen name="ReceiveMoney" component={ReceiveMoneyScreen} />
          <Stack.Screen name="QRPay" component={QRPayScreen} />
          <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} />
          <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} />
          <Stack.Screen name="ApprovalRequest" component={ApprovalRequestScreen} />
          <Stack.Screen name="KYC" component={KYCScreen} />
          <Stack.Screen name="BlockchainVault" component={BlockchainVaultScreen} />
          <Stack.Screen name="AIAssistant" component={AIAssistantScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
