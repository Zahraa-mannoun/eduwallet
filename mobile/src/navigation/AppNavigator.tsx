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
import ScholarshipPortalScreen from '../screens/ScholarshipPortalScreen';
import StudentMainNavigator from './StudentMainNavigator';
import ParentMainNavigator from './ParentMainNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="StudentMain" component={StudentMainNavigator} />
      <Stack.Screen name="ParentMain" component={ParentMainNavigator} />
      <Stack.Screen name="InstitutionMain" component={ScholarshipPortalScreen} />
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
    </Stack.Navigator>
  );
}
