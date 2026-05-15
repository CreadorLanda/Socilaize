import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Palette, Radii, Spacing, Typography } from '@/constants/theme';
import { t } from '@/i18n';

export default function DiscoverScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.empty}>
        <View style={styles.iconWrap}>
          <Ionicons name="compass" size={40} color={Colors.light.primary} />
        </View>
        <Text style={styles.title}>{t('discover.title')}</Text>
        <Text style={styles.subtitle}>{t('discover.subtitle')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: Radii.pill,
    backgroundColor: Palette.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: { ...Typography.h2, color: Colors.light.text },
  subtitle: {
    ...Typography.body,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
});
