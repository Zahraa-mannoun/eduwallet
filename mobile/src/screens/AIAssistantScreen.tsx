import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Card, IconButton, Text } from 'react-native-paper';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Transaction } from '../types/api';
import CategorySpendBarRow from '../components/CategorySpendBarRow';
import CircularProgress from '../components/CircularProgress';
import IconBadge from '../components/IconBadge';
import { BUDGET_CATEGORIES } from '../constants/budgetCategories';
import type { BudgetCategoryKey } from '../constants/budgetCategories';
import { useWallet } from '../context/WalletContext';
import { colors } from '../theme/colors';
import * as walletService from '../services/walletService';
import * as budgetService from '../services/budgetService';
import type { BudgetSummary } from '../services/budgetService';
import { ApiError } from '../services/api';
import type { RootStackScreenProps } from '../navigation/types';

const PREDICTION_GROWTH_RATE = 1.1;

type Recommendation = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  text: string;
};

const categoryLookup = new Map(BUDGET_CATEGORIES.map((category) => [category.key, category]));

function getHealthScoreMeta(score: number) {
  if (score >= 75) return { label: 'Good', color: colors.accent };
  if (score >= 45) return { label: 'Needs Attention', color: '#F59E0B' };
  return { label: 'At Risk', color: colors.danger };
}

export default function AIAssistantScreen({ navigation }: RootStackScreenProps<'AIAssistant'>) {
  const { wallet } = useWallet();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [transactionsResult, summary] = await Promise.all([
        walletService.getTransactions({ limit: 100 }),
        budgetService.getBudgetSummary(),
      ]);
      setTransactions(transactionsResult.transactions);
      setBudgetSummary(summary);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load your insights.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const sentTransactions = useMemo(
    () => (wallet ? transactions.filter((tx) => tx.fromWalletId === wallet.id) : []),
    [transactions, wallet]
  );
  const totalSpent = useMemo(
    () => sentTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0),
    [sentTransactions]
  );
  const spendTotals = useMemo(() => {
    const totals = new Map<BudgetCategoryKey, number>();
    sentTransactions.forEach((tx) => {
      const key = tx.category.toLowerCase() as BudgetCategoryKey;
      totals.set(key, (totals.get(key) ?? 0) + Number(tx.amount));
    });
    return totals;
  }, [sentTransactions]);

  const healthScore = useMemo(() => {
    const rejectedCount = transactions.filter((tx) => tx.status === 'REJECTED').length;
    const pendingCount = transactions.filter((tx) => tx.status === 'PENDING').length;
    const topCategorySpend = Math.max(0, ...Array.from(spendTotals.values()));
    const topCategoryShare = totalSpent > 0 ? topCategorySpend / totalSpent : 0;

    let score = 100;
    score -= rejectedCount * 10;
    score -= pendingCount * 5;
    if (topCategoryShare > 0.4) score -= 15;
    return Math.max(0, Math.min(100, score));
  }, [transactions, spendTotals, totalSpent]);

  const scoreMeta = getHealthScoreMeta(healthScore);

  const predictedSpending = useMemo(() => {
    const withPredictions = BUDGET_CATEGORIES.map((category) => {
      const current = spendTotals.get(category.key) ?? 0;
      return { ...category, predicted: current * PREDICTION_GROWTH_RATE };
    });
    const maxPredicted = Math.max(1, ...withPredictions.map((c) => c.predicted));
    return withPredictions.map((c) => ({ ...c, progress: c.predicted / maxPredicted }));
  }, [spendTotals]);

  const recommendations: Recommendation[] = useMemo(() => {
    if (!budgetSummary) return [];
    return budgetSummary.alerts.map((alert) => {
      const category = categoryLookup.get(alert.category.toLowerCase() as BudgetCategoryKey);
      return {
        icon: alert.severity === 'OVERSPENT' ? 'alert-circle-outline' : 'trending-up',
        color: alert.severity === 'OVERSPENT' ? colors.danger : category?.color ?? colors.primary,
        text: alert.message,
      };
    });
  }, [budgetSummary]);

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
        <Text variant="titleLarge" style={styles.headerTitle}>
          AI Assistant
        </Text>
      </View>

      {isLoading && transactions.length === 0 && !budgetSummary ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

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
          {recommendations.length > 0 ? (
            recommendations.map((rec, index) => (
              <View key={`${rec.text}-${index}`} style={styles.recommendationRow}>
                <IconBadge icon={rec.icon} color={rec.color} size={40} />
                <Text style={styles.recommendationText}>{rec.text}</Text>
              </View>
            ))
          ) : (
            <View style={styles.recommendationRow}>
              <IconBadge icon="check-circle-outline" color={colors.accent} size={40} />
              <Text style={styles.recommendationText}>
                You&apos;re within all your budgets this month.
              </Text>
            </View>
          )}

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
      )}
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
  loading: {
    marginTop: 40,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 12,
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
