import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, IconButton, Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import IconBadge from './IconBadge';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';

type KYCGateProps = Readonly<{
  children: ReactNode;
}>;

export default function KYCGate({ children }: KYCGateProps) {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  if (user?.kycStatus === 'VERIFIED') {
    return <>{children}</>;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
      </View>
      <View style={styles.container}>
        <IconBadge icon="lock-outline" color={colors.primary} size={72} iconSize={36} />
        <Text variant="titleMedium" style={styles.title}>
          Verification Required
        </Text>
        <Text style={styles.message}>
          Complete your university KYC verification to unlock this feature. Upload your Student ID
          and Enrollment Certificate.
        </Text>
        <Button
          mode="contained"
          buttonColor={colors.primary}
          style={styles.button}
          contentStyle={styles.buttonContent}
          onPress={() => navigation.navigate('KYC')}
        >
          Verify Now
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  backButton: {
    margin: 0,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontWeight: '700',
    color: colors.heading,
    marginTop: 20,
    marginBottom: 10,
  },
  message: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
  },
  button: {
    borderRadius: 10,
    minWidth: 160,
  },
  buttonContent: {
    paddingVertical: 6,
  },
});
