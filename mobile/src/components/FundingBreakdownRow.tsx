import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { colors } from '../theme/colors';

// The Total Cost / Parent / Institution / Gap breakdown shared by every screen that shows a
// student's funding state (UniversityStudentsTab, InstitutionStudentsScreen) — same four
// numbers, same order, everywhere. Laid out as a 2x2 grid rather than 4 columns in one row so
// labels like "Institution" have room to breathe instead of wrapping/truncating.
type FundingBreakdownRowProps = Readonly<{
  totalCost: number;
  parentSent: number;
  institutionSent: number;
  gap: number;
}>;

export default function FundingBreakdownRow({
  totalCost,
  parentSent,
  institutionSent,
  gap,
}: FundingBreakdownRowProps) {
  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        <View style={styles.cell}>
          <Text style={styles.label}>Total Cost</Text>
          <Text style={styles.value}>${totalCost.toFixed(2)}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>Parent</Text>
          <Text style={styles.value}>${parentSent.toFixed(2)}</Text>
        </View>
      </View>
      <View style={[styles.row, styles.rowLast]}>
        <View style={styles.cell}>
          <Text style={styles.label}>Institution</Text>
          <Text style={styles.value}>${institutionSent.toFixed(2)}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>Gap</Text>
          <Text style={[styles.value, styles.gapValue]}>${gap.toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 12,
  },
  rowLast: {
    marginBottom: 0,
  },
  cell: {
    flex: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  value: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.heading,
    marginTop: 4,
  },
  gapValue: {
    color: colors.primary,
  },
});
