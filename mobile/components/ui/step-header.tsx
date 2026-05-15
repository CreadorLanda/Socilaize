import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Palette, Radii, Spacing, Typography } from '@/constants/theme';
import { t } from '@/i18n';

type Props = {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  onBack?: () => void;
};

export function StepHeader({ step, total, title, subtitle, onBack }: Props) {
  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
    }
  };

  const progress = step / total;

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel={t('auth.back')}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.counter}>{t('auth.step_counter', { step, total })}</Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(Math.max(progress, 0), 1) * 100}%` }]} />
      </View>

      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    backgroundColor: Colors.light.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  backButtonPressed: {
    opacity: 0.7,
    backgroundColor: Palette.neutral[100],
  },
  counter: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  track: {
    height: 4,
    backgroundColor: Palette.neutral[200],
    borderRadius: Radii.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: Colors.light.primary,
    borderRadius: Radii.pill,
  },
  title: {
    ...Typography.h1,
    color: Palette.brand[900],
    marginTop: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.light.textSecondary,
  },
});
