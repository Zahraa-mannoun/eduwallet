import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, ProgressBar, Snackbar, Text } from 'react-native-paper';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import IconBadge from '../components/IconBadge';
import { categoryColors, colors } from '../theme/colors';
import type { MainTabScreenProps } from '../navigation/types';

type BudgetCategory = {
  key: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  label: string;
  spent: number;
  limit: number;
};

const BUDGET_CATEGORIES: BudgetCategory[] = [
  { key: 'tuition', icon: 'school-outline', color: categoryColors.tuition, label: 'Tuition', spent: 0, limit: 0 },
  { key: 'books', icon: 'book-open-outline', color: categoryColors.books, label: 'Books', spent: 0, limit: 0 },
  { key: 'food', icon: 'food-outline', color: categoryColors.food, label: 'Food', spent: 0, limit: 0 },
  { key: 'transport', icon: 'bus', color: categoryColors.transport, label: 'Transport', spent: 0, limit: 0 },
  { key: 'software', icon: 'laptop', color: categoryColors.software, label: 'Software', spent: 0, limit: 0 },
  { key: 'rent', icon: 'home-outline', color: categoryColors.rent, label: 'Rent', spent: 0, limit: 0 },
];

export default function BudgetScreen(_props: MainTabScreenProps<'Budget'>) {
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Budget
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {BUDGET_CATEGORIES.map((category) => {
          const progress = category.limit > 0 ? category.spent / category.limit : 0;

          return (
            <Card key={category.key} style={styles.categoryCard} mode="elevated">
              <Card.Content>
                <View style={styles.categoryHeaderRow}>
                  <View style={styles.categoryTitleRow}>
                    <IconBadge icon={category.icon} color={category.color} size={40} />
                    <Text variant="titleMedium" style={styles.categoryLabel}>
                      {category.label}
                    </Text>
                  </View>
                  <Text style={styles.categoryAmount}>
                    ${category.spent.toFixed(0)} / ${category.limit.toFixed(0)}
                  </Text>
                </View>

                <ProgressBar
                  progress={progress}
                  color={category.color}
                  style={styles.progressBar}
                />

                <Text style={styles.categoryUsed}>{Math.round(progress * 100)}% used</Text>
              </Card.Content>
            </Card>
          );
        })}

        <Button
          mode="contained"
          buttonColor={colors.primary}
          icon="wallet-plus-outline"
          style={styles.setBudgetButton}
          contentStyle={styles.setBudgetButtonContent}
          onPress={() => setSnackbarVisible(true)}
        >
          Set Budget
        </Button>
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={2000}
      >
        Budget management is coming soon.
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
  categoryCard: {
    borderRadius: 16,
    marginBottom: 14,
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryLabel: {
    fontWeight: '700',
    color: colors.heading,
    marginLeft: 12,
  },
  categoryAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surface,
  },
  categoryUsed: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 8,
  },
  setBudgetButton: {
    borderRadius: 10,
    marginTop: 8,
  },
  setBudgetButtonContent: {
    paddingVertical: 6,
  },
});
