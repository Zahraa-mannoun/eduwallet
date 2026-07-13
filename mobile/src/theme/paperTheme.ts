import { MD3LightTheme } from 'react-native-paper';
import { colors } from './colors';

export const paperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    secondary: colors.accent,
    background: colors.background,
    surface: colors.background,
    surfaceVariant: colors.surface,
    onPrimary: colors.onPrimary,
    error: colors.danger,
  },
};
