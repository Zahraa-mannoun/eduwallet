import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { Transaction } from '../types/api';

export type StudentTabParamList = {
  Home: undefined;
  Cards: undefined;
  Budget: undefined;
  Profile: undefined;
};

export type ParentTabParamList = {
  Home: undefined;
  Send: undefined;
  Approvals: undefined;
  Students: undefined;
  Profile: undefined;
};

export type InstitutionTabParamList = {
  Overview: undefined;
  // initialTab lets other screens deep-link straight into one of Portal's 3 internal tabs
  // (e.g. Overview's "Fund a Student" / "Bulk Scholarship" quick actions) instead of always
  // landing on the default "University Students" internal tab.
  Portal: { initialTab?: 'students' | 'portal' | 'individual' } | undefined;
  Students: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  // Reachable from the login-time suspension screen — no session exists at that point, so
  // this lives in the unauthenticated branch of AppNavigator alongside Login/Register.
  SupportMessage: { email?: string } | undefined;
  StudentMain: NavigatorScreenParams<StudentTabParamList> | undefined;
  ParentMain: NavigatorScreenParams<ParentTabParamList> | undefined;
  InstitutionMain: NavigatorScreenParams<InstitutionTabParamList> | undefined;
  SendMoney: undefined;
  ReceiveMoney: undefined;
  QRPay: undefined;
  Withdrawal: undefined;
  TransactionHistory: undefined;
  TransactionDetail: { transactionId: string };
  ApprovalRequest: { transaction: Transaction; studentName: string };
  ParentStudentDetail: { studentId: string; studentName: string; studentEmail: string };
  NoLinkedStudents: undefined;
  KYC: undefined;
  PersonalSavings: undefined;
  ReportRequest: undefined;
  ReportHistory: undefined;
  EmailChangeRequest: undefined;
  BlockchainVault: undefined;
  AIAssistant: undefined;
  Notifications: undefined;
  AccountSettings: undefined;
  HelpSupport: undefined;
  InstitutionWallet: undefined;
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

export type InstitutionTabScreenProps<Screen extends keyof InstitutionTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<InstitutionTabParamList, Screen>,
    NativeStackScreenProps<RootStackParamList>
  >;
