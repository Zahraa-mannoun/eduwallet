import { Image, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { colors } from '../theme/colors';

type SplashScreenProps = Readonly<{
  // Shown once the cold-start session check gives up retrying purely on connectivity —
  // never on a confirmed-invalid token (see AuthContext's isInconclusiveError). Offers a
  // manual retry instead of silently dumping the user onto the Login screen.
  isOffline?: boolean;
  onRetry?: () => void;
}>;

export default function SplashScreen({ isOffline = false, onRetry }: SplashScreenProps) {
  return (
    <View style={styles.container}>
      <Image source={require('../../assets/splash-icon.png')} style={styles.logo} resizeMode="contain" />
      <Text variant="headlineSmall" style={styles.appName}>
        EduWallet
      </Text>

      {isOffline ? (
        <View style={styles.offlineBlock}>
          <Text style={styles.offlineText}>
            Can&apos;t reach the server right now. Your session is still saved — check your
            connection and try again.
          </Text>
          <Button mode="contained" buttonColor={colors.primary} style={styles.retryButton} onPress={onRetry}>
            Retry
          </Button>
        </View>
      ) : (
        <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 32,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 20,
    marginBottom: 12,
  },
  appName: {
    fontWeight: '700',
    color: colors.heading,
  },
  spinner: {
    marginTop: 28,
  },
  offlineBlock: {
    marginTop: 24,
    width: '100%',
    alignItems: 'center',
  },
  offlineText: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  retryButton: {
    width: '100%',
    borderRadius: 10,
  },
});
