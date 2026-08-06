import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import SendMoneyScreen from '../screens/SendMoneyScreen';
import ReceiveMoneyScreen from '../screens/ReceiveMoneyScreen';
import QRPayScreen from '../screens/QRPayScreen';
import WithdrawalScreen from '../screens/WithdrawalScreen';
import TransactionHistoryScreen from '../screens/TransactionHistoryScreen';
import TransactionDetailScreen from '../screens/TransactionDetailScreen';
import ApprovalRequestScreen from '../screens/ApprovalRequestScreen';
import KYCScreen from '../screens/KYCScreen';
import PersonalSavingsScreen from '../screens/PersonalSavingsScreen';
import BlockchainVaultScreen from '../screens/BlockchainVaultScreen';
import AIAssistantScreen from '../screens/AIAssistantScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import AccountSettingsScreen from '../screens/AccountSettingsScreen';
import SplashScreen from '../screens/SplashScreen';
import SupportMessageScreen from '../screens/SupportMessageScreen';
import StudentMainNavigator from './StudentMainNavigator';
import ParentMainNavigator from './ParentMainNavigator';
import InstitutionMainNavigator from './InstitutionMainNavigator';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { isAuthenticated, isLoading, isOffline, retryConnection, user } = useAuth();

  // Both branches gate ALL navigation decisions on the cold-start session check having
  // actually finished — isLoading while it's in flight, isOffline if it gave up purely on
  // connectivity. Neither renders the Login screen, so a slow/flaky network on startup can
  // never look like a logout; only a confirmed-invalid token falls through to Login below.
  if (isLoading) {
    return <SplashScreen />;
  }
  if (isOffline) {
    return <SplashScreen isOffline onRetry={retryConnection} />;
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
          <Stack.Screen name="Withdrawal" component={WithdrawalScreen} />
          <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} />
          <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} />
          <Stack.Screen name="ApprovalRequest" component={ApprovalRequestScreen} />
          <Stack.Screen name="KYC" component={KYCScreen} />
          <Stack.Screen name="PersonalSavings" component={PersonalSavingsScreen} />
          <Stack.Screen name="BlockchainVault" component={BlockchainVaultScreen} />
          <Stack.Screen name="AIAssistant" component={AIAssistantScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
