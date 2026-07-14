import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import IconBadge from './IconBadge';
import { colors } from '../theme/colors';

type CategorySpendBarRowProps = Readonly<{
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  label: string;
  amount: number;
  progress: number;
}>;

export default function CategorySpendBarRow({
  icon,
  color,
  label,
  amount,
  progress,
}: CategorySpendBarRowProps) {
  return (
    <View style={styles.row}>
      <IconBadge icon={icon} color={color} size={36} iconSize={20} />
      <View style={styles.middle}>
        <View style={styles.headerRow}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.amount}>${amount.toFixed(2)}</Text>
        </View>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`, backgroundColor: color },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  middle: {
    flex: 1,
    marginLeft: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.heading,
  },
  amount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
});
