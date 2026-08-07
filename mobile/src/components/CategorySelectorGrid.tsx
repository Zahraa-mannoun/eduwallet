import { StyleSheet, View } from 'react-native';
import { Text, TouchableRipple } from 'react-native-paper';
import IconBadge from './IconBadge';
import { VISIBLE_BUDGET_CATEGORIES } from '../constants/budgetCategories';
import type { BudgetCategoryDefinition } from '../constants/budgetCategories';
import { colors } from '../theme/colors';

type CategorySelectorGridProps = Readonly<{
  value: BudgetCategoryDefinition | null;
  onChange: (category: BudgetCategoryDefinition) => void;
  categories?: BudgetCategoryDefinition[];
}>;

export default function CategorySelectorGrid({
  value,
  onChange,
  categories = VISIBLE_BUDGET_CATEGORIES,
}: CategorySelectorGridProps) {
  return (
    <View style={styles.grid}>
      {categories.map((category) => {
        const selected = value?.key === category.key;
        return (
          <TouchableRipple
            key={category.key}
            onPress={() => onChange(category)}
            style={[
              styles.item,
              selected && { borderColor: category.color, backgroundColor: `${category.color}14` },
            ]}
            borderless
          >
            <View style={styles.itemContent}>
              <IconBadge icon={category.icon} color={category.color} size={36} iconSize={20} />
              <Text style={[styles.itemLabel, selected && { color: category.color }]}>
                {category.label}
              </Text>
            </View>
          </TouchableRipple>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  item: {
    width: '31%',
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
  },
  itemContent: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  itemLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    marginTop: 6,
  },
});
