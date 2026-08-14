import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, TouchableRipple } from 'react-native-paper';
import IconBadge from './IconBadge';
import { VISIBLE_BUDGET_CATEGORIES } from '../constants/budgetCategories';
import type { BudgetCategoryDefinition } from '../constants/budgetCategories';
import { colors } from '../theme/colors';

type CategorySelectorGridProps = Readonly<{
  value: BudgetCategoryDefinition | null;
  onChange: (category: BudgetCategoryDefinition) => void;
  categories?: BudgetCategoryDefinition[];
  // 'category' (default): each pill tints itself with the category's own color when selected —
  // used everywhere budget categories are informational (Budget, Send Money). 'primary': every
  // pill uses the same blue fill/outline regardless of category — used where the categories are
  // just a required field on a funding action (Institution's Individual Funding tab), so the
  // color isn't trying to carry category identity.
  variant?: 'category' | 'primary';
}>;

export default function CategorySelectorGrid({
  value,
  onChange,
  categories = VISIBLE_BUDGET_CATEGORIES,
  variant = 'category',
}: CategorySelectorGridProps) {
  return (
    <View style={styles.grid}>
      {categories.map((category) => {
        const selected = value?.key === category.key;

        if (variant === 'primary') {
          const contentColor = selected ? colors.onPrimary : colors.primary;
          return (
            <TouchableRipple
              key={category.key}
              onPress={() => onChange(category)}
              style={[
                styles.item,
                styles.itemPrimary,
                selected ? styles.itemPrimarySelected : styles.itemPrimaryUnselected,
              ]}
              borderless
            >
              <View style={styles.itemContent}>
                <MaterialCommunityIcons name={category.icon} size={22} color={contentColor} />
                <Text style={[styles.itemLabel, styles.itemLabelPrimary, { color: contentColor }]}>
                  {category.label}
                </Text>
              </View>
            </TouchableRipple>
          );
        }

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
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
  },
  itemPrimary: {
    borderWidth: 1.5,
  },
  itemPrimarySelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  itemPrimaryUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.primary,
  },
  itemContent: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  itemLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    marginTop: 6,
  },
  itemLabelPrimary: {
    fontWeight: '700',
  },
});
