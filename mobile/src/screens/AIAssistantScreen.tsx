import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, IconButton, Text } from 'react-native-paper';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import CategorySpendBarRow from '../components/CategorySpendBarRow';
import CircularProgress from '../components/CircularProgress';
import IconBadge from '../components/IconBadge';
import { BUDGET_CATEGORIES } from '../constants/budgetCategories';
import { MOCK_TRANSACTIONS } from '../constants/mockTransactions';
import { categoryColors, colors } from '../theme/colors';
import { getCategorySpendTotals } from '../utils/getCategorySpendTotals';
import type { RootStackScreenProps } from '../navigation/types';

const PREDICTION_GROWTH_RATE = 1.1;

type Recommendation = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  text: string;
};

const RECOMMENDATIONS: Recommendation[] = [
  {
    icon: 'alert-circle-outline',
    color: categoryColors.food,
    text: 'You are close to your Food budget limit',
  },
  {
    icon: 'trending-up',
    color: categoryColors.transport,
    text: 'Your transport spending increased 40% this month',
  },
  {
    icon: 'piggy-bank-outline',
    color: categoryColors.software,
    text: 'You could save $50 by reducing Software spending',
  },
];

function getHealthScoreMeta(score: number) {
  if (score >= 75) return { label: 'Good', color: colors.accent };
  if (score >= 45) return { label: 'Needs Attention', color: '#F59E0B' };
  return { label: 'At Risk', color: colors.danger };
}

export default function AIAssistantScreen({ navigation }: RootStackScreenProps<'AIAssistant'>) {
  const sentTransactions = useMemo(
    () => MOCK_TRANSACTIONS.filter((tx) => tx.type === 'SENT'),
    []
  );
  const totalSpent = useMemo(
    () => sentTransactions.reduce((sum, tx) => sum + tx.amount, 0),
    [sentTransactions]
  );
  const spendTotals = useMemo(() => getCategorySpendTotals(MOCK_TRANSACTIONS), []);

  const healthScore = useMemo(() => {
    const rejectedCount = MOCK_TRANSACTIONS.filter((tx) => tx.status === 'REJECTED').length;
    const pendingCount = MOCK_TRANSACTIONS.filter((tx) => tx.status === 'PENDING').length;
    const topCategorySpend = Math.max(0, ...Array.from(spendTotals.values()));
    const topCategoryShare = totalSpent > 0 ? topCategorySpend / totalSpent : 0;

    let score = 100;
    score -= rejectedCount * 10;
    score -= pendingCount * 5;
    if (topCategoryShare > 0.4) score -= 15;
    return Math.max(0, Math.min(100, score));
  }, [spendTotals, totalSpent]);

  const scoreMeta = getHealthScoreMeta(healthScore);

  const predictedSpending = useMemo(() => {
    const withPredictions = BUDGET_CATEGORIES.map((category) => {
      const current = spendTotals.get(category.key) ?? 0;
      return { ...category, predicted: current * PREDICTION_GROWTH_RATE };
    });
    const maxPredicted = Math.max(1, ...withPredictions.map((c) => c.predicted));
    return withPredictions.map((c) => ({ ...c, progress: c.predicted / maxPredicted }));
  }, [spendTotals]);

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
        <Text variant="titleLarge" style={styles.headerTitle}>
          AI Assistant
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.introRow}>
          <IconBadge icon="robot-outline" color={colors.primary} size={36} iconSize={20} />
          <Text style={styles.introText}>Rule-based insights from your spending activity</Text>
        </View>

        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <Text variant="titleMedium" style={styles.cardTitle}>
              This Month&apos;s Summary
            </Text>
            <Text style={styles.totalSpent}>${totalSpent.toFixed(2)}</Text>
            <Text style={styles.totalSpentCaption}>
              across {sentTransactions.length} transaction{sentTransactions.length === 1 ? '' : 's'}
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.card} mode="elevated">
          <Card.Content style={styles.scoreContent}>
            <View style={styles.scoreGaugeWrapper}>
              <CircularProgress
                progress={healthScore / 100}
                color={scoreMeta.color}
                size={128}
                strokeWidth={12}
              />
              <View style={styles.scoreTextOverlay}>
                <Text style={styles.scoreNumber}>{healthScore}</Text>
                <Text style={styles.scoreOutOf}>/ 100</Text>
              </View>
            </View>
            <Text style={[styles.scoreLabel, { color: scoreMeta.color }]}>{scoreMeta.label}</Text>
            <Text style={styles.scoreCaption}>Financial Health Score</Text>
          </Card.Content>
        </Card>

        <Text style={styles.sectionLabel}>Recommendations</Text>
        {RECOMMENDATIONS.map((rec) => (
          <View key={rec.text} style={styles.recommendationRow}>
            <IconBadge icon={rec.icon} color={rec.color} size={40} />
            <Text style={styles.recommendationText}>{rec.text}</Text>
          </View>
        ))}

        <Text style={styles.sectionLabel}>Monthly Spending Prediction</Text>
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            {predictedSpending.map((category) => (
              <CategorySpendBarRow
                key={category.key}
                icon={category.icon}
                color={category.color}
                label={category.label}
                amount={category.predicted}
                progress={category.progress}
              />
            ))}
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
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
  introRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  introText: {
    flex: 1,
    marginLeft: 12,
    color: colors.muted,
    fontSize: 13,
  },
  card: {
    borderRadius: 16,
    marginBottom: 20,
  },
  cardTitle: {
    fontWeight: '700',
    color: colors.heading,
    marginBottom: 8,
  },
  totalSpent: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.heading,
  },
  totalSpentCaption: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  scoreContent: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  scoreGaugeWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreTextOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.heading,
  },
  scoreOutOf: {
    fontSize: 12,
    color: colors.muted,
    marginTop: -2,
  },
  scoreLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 14,
  },
  scoreCaption: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.label,
    marginBottom: 10,
  },
  recommendationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  recommendationText: {
    flex: 1,
    marginLeft: 12,
    color: colors.heading,
    fontSize: 13,
    fontWeight: '600',
  },
});
