import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Snackbar, Text } from 'react-native-paper';
import { colors } from '../theme/colors';
import { generateMockCard } from '../utils/generateMockCard';
import type { StudentTabScreenProps } from '../navigation/types';

export default function CardsScreen(_props: StudentTabScreenProps<'Cards'>) {
  const [card, setCard] = useState(() => generateMockCard('Zahraa Student'));
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const handleGenerate = () => {
    setCard(generateMockCard('Zahraa Student'));
    setSnackbarVisible(true);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Cards
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <View style={[styles.decorCircle, styles.decorCircleLarge]} />
          <View style={[styles.decorCircle, styles.decorCircleSmall]} />

          <View style={styles.cardTopRow}>
            <Text style={styles.cardBrand}>EduWallet</Text>
            <View style={styles.chip} />
          </View>

          <Text style={styles.cardNumber}>{card.number}</Text>

          <View style={styles.cardBottomRow}>
            <View>
              <Text style={styles.fieldLabel}>CARD HOLDER</Text>
              <Text style={styles.fieldValue}>{card.holder.toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.fieldLabel}>EXPIRES</Text>
              <Text style={styles.fieldValue}>
                {card.expiryMonth}/{card.expiryYear}
              </Text>
            </View>
            <View>
              <Text style={styles.fieldLabel}>CVV</Text>
              <Text style={styles.fieldValue}>{card.cvv}</Text>
            </View>
          </View>
        </LinearGradient>

        <Button
          mode="contained"
          buttonColor={colors.primary}
          icon="refresh"
          style={styles.generateButton}
          contentStyle={styles.generateButtonContent}
          onPress={handleGenerate}
        >
          Generate New Card
        </Button>
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={2000}
      >
        New virtual card generated.
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: {
    fontWeight: '700',
    color: colors.heading,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  card: {
    borderRadius: 20,
    padding: 22,
    height: 200,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  decorCircleLarge: {
    width: 160,
    height: 160,
    top: -60,
    right: -40,
  },
  decorCircleSmall: {
    width: 90,
    height: 90,
    bottom: -30,
    right: 60,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardBrand: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  chip: {
    width: 36,
    height: 26,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  cardNumber: {
    color: colors.onPrimary,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 2,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  fieldValue: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  generateButton: {
    borderRadius: 10,
    marginTop: 24,
  },
  generateButtonContent: {
    paddingVertical: 6,
  },
});
