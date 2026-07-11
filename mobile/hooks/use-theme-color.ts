/**
 * Semantic color helper that respects the active marketplace pack + scheme pref.
 */

import { useTheme } from '@/hooks/use-theme';
import type { ThemeTokens } from '@/data/theme-store';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof ThemeTokens,
) {
  const { colors, isDark } = useTheme();
  const colorFromProps = props[isDark ? 'dark' : 'light'];

  if (colorFromProps) {
    return colorFromProps;
  }
  return colors[colorName];
}
