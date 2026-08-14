import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';

// A small colored-dot-plus-label pill for funding/coverage status (Fully Funded / Partially
// Covered / No Coverage, ...) — shared across every Institution screen so the same status
// always reads the same way, regardless of which tab or screen shows it.
type StatusDotBadgeProps = Readonly<{
  label: string;
  color: string;
  style?: StyleProp<ViewStyle>;
}>;

export default function StatusDotBadge({ label, color, style }: StatusDotBadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}1A` }, style]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
  },
});
