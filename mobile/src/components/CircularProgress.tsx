import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../theme/colors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type CircularProgressProps = Readonly<{
  progress: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  trackColor?: string;
}>;

export default function CircularProgress({
  progress,
  size = 120,
  strokeWidth = 12,
  color,
  trackColor = colors.surface,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));
  const center = size / 2;
  // SVG stroke-dashoffset isn't supported by the native driver, so this stays JS-driven —
  // fine at this size/frequency (animates once per score change, not a continuous loop).
  const animatedProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: clamped,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [clamped, animatedProgress]);

  const strokeDashoffset = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <Svg width={size} height={size}>
      <Circle cx={center} cy={center} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
      <AnimatedCircle
        cx={center}
        cy={center}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
      />
    </Svg>
  );
}
