import { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Button, Card, IconButton, Snackbar, Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import KYCGate from '../components/KYCGate';
import { colors } from '../theme/colors';
import type { RootStackScreenProps } from '../navigation/types';

const VIEWFINDER_HEIGHT = 260;

export default function QRPayScreen({ navigation }: RootStackScreenProps<'QRPay'>) {
  const [merchantCode, setMerchantCode] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scanLineAnim]);

  const scanLineTranslateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, VIEWFINDER_HEIGHT - 20],
  });

  const handleManualSubmit = () => {
    const code = merchantCode.trim();
    if (!code) return;
    setSnackbarMessage(`Simulated payment to merchant code ${code.toUpperCase()}.`);
    setMerchantCode('');
  };

  return (
    <KYCGate>
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
        <Text variant="titleLarge" style={styles.headerTitle}>
          QR Pay
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.viewfinder}>
          <View style={[styles.corner, styles.cornerTopLeft]} />
          <View style={[styles.corner, styles.cornerTopRight]} />
          <View style={[styles.corner, styles.cornerBottomLeft]} />
          <View style={[styles.corner, styles.cornerBottomRight]} />
          <Animated.View
            style={[styles.scanLine, { transform: [{ translateY: scanLineTranslateY }] }]}
          />
          <MaterialCommunityIcons name="qrcode-scan" size={56} color="rgba(255,255,255,0.35)" />
          <Text style={styles.viewfinderText}>Point your camera at a merchant QR code</Text>
        </View>
        <Text style={styles.cameraNote}>
          Camera preview isn&apos;t available on web — this is a preview of the scan experience.
        </Text>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR ENTER CODE MANUALLY</Text>
          <View style={styles.dividerLine} />
        </View>

        <TextInput
          mode="outlined"
          label="Merchant Code"
          placeholder="e.g. CAMPUSCAFE01"
          value={merchantCode}
          onChangeText={setMerchantCode}
          autoCapitalize="characters"
          left={<TextInput.Icon icon="store-outline" />}
          outlineColor={colors.border}
          activeOutlineColor={colors.primary}
          style={styles.codeInput}
        />
        <Button
          mode="contained"
          buttonColor={colors.primary}
          disabled={!merchantCode.trim()}
          style={styles.submitButton}
          contentStyle={styles.submitButtonContent}
          onPress={handleManualSubmit}
        >
          Submit Code
        </Button>

        <Text style={styles.sectionLabel}>Recent QR Payments</Text>
        <Card style={styles.emptyCard} mode="elevated">
          <Card.Content style={styles.emptyState}>
            <Avatar.Icon icon="qrcode-scan" size={56} style={styles.emptyIcon} color={colors.primary} />
            <Text style={styles.emptyTitle}>No QR payments yet</Text>
            <Text style={styles.emptySubtitle}>
              Payments you make by scanning a merchant QR code will show up here.
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>

      <Snackbar
        visible={snackbarMessage !== null}
        onDismiss={() => setSnackbarMessage(null)}
        duration={2500}
      >
        {snackbarMessage ?? ''}
      </Snackbar>
    </SafeAreaView>
    </KYCGate>
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
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  backButton: {
    margin: 0,
  },
  headerTitle: {
    fontWeight: '700',
    color: colors.heading,
    marginLeft: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  viewfinder: {
    height: VIEWFINDER_HEIGHT,
    borderRadius: 24,
    backgroundColor: '#0B1526',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 8,
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: colors.accent,
  },
  cornerTopLeft: {
    top: 16,
    left: 16,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  cornerTopRight: {
    top: 16,
    right: 16,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  cornerBottomLeft: {
    bottom: 16,
    left: 16,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  cornerBottomRight: {
    bottom: 16,
    right: 16,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  scanLine: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 2,
    backgroundColor: colors.accent,
    opacity: 0.85,
  },
  viewfinderText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  cameraNote: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 24,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    marginHorizontal: 10,
  },
  codeInput: {
    backgroundColor: colors.inputBackground,
    marginBottom: 16,
  },
  submitButton: {
    borderRadius: 10,
    marginBottom: 32,
  },
  submitButtonContent: {
    paddingVertical: 6,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.label,
    marginBottom: 10,
  },
  emptyCard: {
    borderRadius: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIcon: {
    backgroundColor: colors.surface,
    marginBottom: 14,
  },
  emptyTitle: {
    fontWeight: '700',
    color: colors.heading,
    marginBottom: 6,
  },
  emptySubtitle: {
    color: colors.muted,
    textAlign: 'center',
  },
});
