import Svg, { Circle } from 'react-native-svg';
import { colors } from '../theme/colors';

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
  const strokeDashoffset = circumference * (1 - clamped);
  const center = size / 2;

  return (
    <Svg width={size} height={size}>
      <Circle cx={center} cy={center} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
      <Circle
        cx={center}
        cy={center}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        rotation="-90"
        originX={center}
        originY={center}
      />
    </Svg>
  );
}
