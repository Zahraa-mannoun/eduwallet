import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';

export type StudentTabParamList = {
  Home: undefined;
  Cards: undefined;
  Budget: undefined;
  Profile: undefined;
};

export type ParentTabParamList = {
  Home: undefined;
  Approvals: undefined;
  Students: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  StudentMain: NavigatorScreenParams<StudentTabParamList> | undefined;
  ParentMain: NavigatorScreenParams<ParentTabParamList> | undefined;
  InstitutionMain: undefined;
  SendMoney: undefined;
  ReceiveMoney: undefined;
  QRPay: undefined;
  TransactionHistory: undefined;
  TransactionDetail: { transactionId: string };
  ApprovalRequest: { transactionId: string };
  KYC: undefined;
  BlockchainVault: undefined;
  AIAssistant: undefined;
  Notifications: undefined;
};

export type RootStackScreenProps<Screen extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, Screen>;

export type StudentTabScreenProps<Screen extends keyof StudentTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<StudentTabParamList, Screen>,
  NativeStackScreenProps<RootStackParamList>
>;

export type ParentTabScreenProps<Screen extends keyof ParentTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<ParentTabParamList, Screen>,
  NativeStackScreenProps<RootStackParamList>
>;
