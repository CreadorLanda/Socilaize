import { Platform } from 'react-native';

export const Palette = {
  brand: {
    50: '#EEF2FF',
    100: '#E0E7FF',
    200: '#C7D2FE',
    300: '#A5B4FC',
    400: '#6F8BFF',
    500: '#2D5BFF',
    600: '#1E40FF',
    700: '#1E3AE0',
    800: '#1E3A8A',
    900: '#1E2C6E',
  },
  neutral: {
    0: '#FFFFFF',
    50: '#F7F9FC',
    100: '#EEF1F6',
    200: '#E5E9F0',
    300: '#D1D7E0',
    400: '#9AA3B2',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
    1000: '#0B1020',
  },
  accent: {
    yellow: '#FFD93D',
    red: '#FF5A5F',
    green: '#4ADE80',
    pink: '#FF6FB5',
    teal: '#22D3EE',
    purple: '#A78BFA',
  },
  semantic: {
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',
  },
} as const;

const tintColorLight = Palette.brand[500];
const tintColorDark = '#6F8BFF';

export const Colors = {
  light: {
    text: Palette.neutral[900],
    textSecondary: Palette.neutral[500],
    textMuted: Palette.neutral[400],
    background: Palette.neutral[50],
    surface: Palette.neutral[0],
    surfaceElevated: Palette.neutral[0],
    surfaceMuted: Palette.neutral[100],
    border: Palette.neutral[200],
    divider: Palette.neutral[100],
    tint: tintColorLight,
    primary: Palette.brand[500],
    onPrimary: Palette.neutral[0],
    icon: Palette.neutral[500],
    tabIconDefault: Palette.neutral[400],
    tabIconSelected: tintColorLight,
    success: Palette.semantic.success,
    warning: Palette.semantic.warning,
    danger: Palette.semantic.danger,
    info: Palette.semantic.info,
  },
  dark: {
    // Cool-neutral charcoal ramp — only a whisper of the brand hue (low chroma)
    // so the royal-blue primary reads as the one confident color, not as
    // competing navy. Ordered by elevation: background < muted < surface < elevated.
    text: '#ECEDF2',
    textSecondary: '#9A9CA8',
    textMuted: '#6C6E7A',
    background: '#0E0F13',
    surface: '#191A21',
    surfaceElevated: '#23242D',
    surfaceMuted: '#131419',
    border: '#2C2E38',
    divider: '#202129',
    tint: tintColorDark,
    primary: tintColorDark,
    onPrimary: Palette.neutral[0],
    icon: '#9A9CA8',
    tabIconDefault: '#6C6E7A',
    tabIconSelected: tintColorDark,
    success: Palette.semantic.success,
    warning: Palette.semantic.warning,
    danger: Palette.semantic.danger,
    info: Palette.semantic.info,
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const Radii = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

export const Typography = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: '700' as const },
  h1: { fontSize: 26, lineHeight: 34, fontWeight: '700' as const },
  h2: { fontSize: 22, lineHeight: 30, fontWeight: '600' as const },
  h3: { fontSize: 18, lineHeight: 26, fontWeight: '600' as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '500' as const },
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
