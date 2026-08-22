import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { IconButton, Text } from 'react-native-paper';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import IconBadge from '../components/IconBadge';
import CircularProgress from '../components/CircularProgress';
import { BUDGET_CATEGORIES } from '../constants/budgetCategories';
import type { BudgetCategoryKey } from '../constants/budgetCategories';
import { colors } from '../theme/colors';
import * as aiService from '../services/aiService';
import type { AIInsights } from '../services/aiService';
import { ApiError } from '../services/api';
import type { RootStackScreenProps } from '../navigation/types';

// This screen avoids react-native-paper's Card component for the same reason DashboardScreen.tsx
// does — confirmed via live screenshots to break on the web renderer — every "card" below is a
// plain View with its own shadow instead.

const ACCENT_PURPLE = '#8B5CF6';
const GRADIENT_START = '#6D28D9';
const GRADIENT_END = '#4F46E5';
const BG_GRADIENT_START = '#F8F7FF';
const BG_GRADIENT_END = '#EEF2FF';

type DisplayPrediction = {
  key: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  label: string;
  predictedAmount: number;
  progress: number;
};

const categoryLookup = new Map(BUDGET_CATEGORIES.map((category) => [category.key, category]));

function getHealthScoreMeta(label: AIInsights['healthLabel']) {
  if (label === 'Excellent' || label === 'Good') return { color: '#FFFFFF' };
  if (label === 'Fair') return { color: '#FFFFFF' };
  return { color: '#FFFFFF' };
}

// Purple shimmer placeholder shown in place of each card while insights are loading.
function ShimmerBlock({ style }: Readonly<{ style: object }>) {
  const shimmer = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  return <Animated.View style={[style, styles.shimmerBase, { opacity: shimmer }]} />;
}

export default function AIAssistantScreen({ navigation }: RootStackScreenProps<'AIAssistant'>) {
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await aiService.getAIInsights();
      setInsights(result);
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

  const predictions: DisplayPrediction[] = (() => {
    if (!insights || insights.predictions.length === 0) return [];
    const matched: Array<Omit<DisplayPrediction, 'progress'>> = [];
    for (const prediction of insights.predictions) {
      const category = categoryLookup.get(prediction.category.toLowerCase() as BudgetCategoryKey);
      if (!category) continue;
      matched.push({
        key: category.key,
        icon: category.icon,
        color: category.color,
        label: category.label,
        predictedAmount: prediction.predictedAmount,
      });
    }
    const maxPredicted = Math.max(1, ...matched.map((entry) => entry.predictedAmount));
    return matched.map((entry) => ({ ...entry, progress: entry.predictedAmount / maxPredicted }));
  })();

  const showSkeleton = isLoading && !insights;
  const scoreMeta = insights ? getHealthScoreMeta(insights.healthLabel) : { color: '#FFFFFF' };

  return (
    <LinearGradient colors={[BG_GRADIENT_START, BG_GRADIENT_END]} style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
          <View style={styles.headerTextGroup}>
            <Text variant="titleLarge" style={styles.headerTitle}>
              Financial Insights
            </Text>
            <Text style={styles.headerSubtitle}>Your personalized spending overview</Text>
          </View>
        </View>

        {showSkeleton ? (
          <ScrollView contentContainerStyle={styles.content}>
            <ShimmerBlock style={styles.skeletonScoreCard} />
            <ShimmerBlock style={styles.skeletonCard} />
            <ShimmerBlock style={styles.skeletonCard} />
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <LinearGradient
              colors={[GRADIENT_START, GRADIENT_END]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.scoreCard}
            >
              <View style={styles.scoreGaugeWrapper}>
                <CircularProgress
                  progress={(insights?.healthScore ?? 0) / 100}
                  color="#FFFFFF"
                  trackColor="rgba(255,255,255,0.25)"
                  size={140}
                  strokeWidth={14}
                />
                <View style={styles.scoreTextOverlay}>
                  <Text style={styles.scoreNumber}>{insights?.healthScore ?? 0}</Text>
                  <Text style={styles.scoreOutOf}>/ 100</Text>
                </View>
              </View>
              <Text style={[styles.scoreLabel, { color: scoreMeta.color }]}>{insights?.healthLabel ?? '—'}</Text>
              <Text style={styles.scoreCaption}>Financial Health Score</Text>
              <View style={styles.summaryDivider} />
              <Text style={styles.summaryTitle}>This Month&apos;s Summary</Text>
              <Text style={styles.summaryText}>{insights?.summary ?? ''}</Text>
            </LinearGradient>

            <Text style={styles.sectionLabel}>Recommendations</Text>
            <View style={styles.whiteCard}>
              {insights && insights.recommendations.length > 0 ? (
                insights.recommendations.map((text, index) => (
                  <View key={`${text}-${index}`}>
                    <View style={styles.recommendationRow}>
                      <IconBadge icon="lightbulb-on-outline" color={ACCENT_PURPLE} size={36} iconSize={18} />
                      <Text style={styles.recommendationText}>{text}</Text>
                    </View>
                    {index < insights.recommendations.length - 1 ? <View style={styles.divider} /> : null}
                  </View>
                ))
              ) : (
                <View style={styles.recommendationRow}>
                  <IconBadge icon="check-circle-outline" color={colors.accent} size={36} iconSize={18} />
                  <Text style={styles.recommendationText}>
                    You&apos;re within all your budgets this month.
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.sectionLabel}>Monthly Spending Prediction</Text>
            <View style={styles.whiteCard}>
              <Text style={styles.predictionSubtitle}>Predicted spend for this month</Text>
              {predictions.map((prediction, index) => (
                <View key={prediction.key}>
                  <View style={styles.predictionRow}>
                    <IconBadge icon={prediction.icon} color={prediction.color} size={36} iconSize={18} />
                    <Text style={styles.predictionLabel}>{prediction.label}</Text>
                    <Text style={styles.predictionAmount}>${prediction.predictedAmount.toFixed(2)}</Text>
                  </View>
                  {index < predictions.length - 1 ? <View style={styles.divider} /> : null}
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
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
  headerTextGroup: {
    marginLeft: 4,
  },
  headerTitle: {
    fontWeight: '700',
    color: colors.heading,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
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
  scoreCard: {
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
    shadowColor: GRADIENT_START,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
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
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scoreOutOf: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: -2,
  },
  scoreLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
  },
  scoreCaption: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  summaryDivider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: 20,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.85)',
    alignSelf: 'flex-start',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.label,
    marginBottom: 10,
  },
  whiteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 8,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  recommendationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  recommendationText: {
    flex: 1,
    marginLeft: 12,
    color: colors.heading,
    fontSize: 13,
    fontWeight: '600',
  },
  predictionSubtitle: {
    fontSize: 11,
    color: colors.muted,
    paddingHorizontal: 8,
    paddingTop: 8,
    marginBottom: 4,
  },
  predictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  predictionLabel: {
    flex: 1,
    marginLeft: 12,
    color: colors.heading,
    fontSize: 13,
    fontWeight: '600',
  },
  predictionAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: ACCENT_PURPLE,
  },
  divider: {
    height: 1,
    backgroundColor: colors.surface,
    marginHorizontal: 8,
  },
  shimmerBase: {
    backgroundColor: '#E9E3FF',
    borderRadius: 20,
  },
  skeletonScoreCard: {
    height: 260,
    borderRadius: 24,
    marginBottom: 20,
    marginTop: 8,
  },
  skeletonCard: {
    height: 140,
    borderRadius: 20,
    marginBottom: 20,
  },
});
