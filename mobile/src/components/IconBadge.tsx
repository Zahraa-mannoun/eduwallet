import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type IconBadgeProps = Readonly<{
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  size?: number;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
}>;

export default function IconBadge({ icon, color, size = 44, iconSize, style }: IconBadgeProps) {
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: `${color}1F` },
        style,
      ]}
    >
      <MaterialCommunityIcons name={icon} size={iconSize ?? Math.round(size * 0.52)} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
