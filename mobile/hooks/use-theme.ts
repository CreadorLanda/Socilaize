import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  return {
    scheme,
    colors,
    isDark: scheme === 'dark',
  };
}
