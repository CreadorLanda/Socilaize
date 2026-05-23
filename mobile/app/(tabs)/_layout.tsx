import { Ionicons } from '@expo/vector-icons';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Image } from 'expo-image';
import { router, withLayoutContext } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Radii, Spacing, Typography } from '@/constants/theme';
import { useProfile } from '@/data/profile-store';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

const { Navigator } = createMaterialTopTabNavigator();
const MaterialTopTabs = withLayoutContext(Navigator);

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const profile = useProfile();

  // Light mode keeps the confident royal-blue header. Dark mode drops it for a
  // calm charcoal bar — a bright blue band at night is the loud part.
  const headerBg = isDark ? colors.surface : colors.primary;
  const headerFg = isDark ? colors.text : colors.onPrimary;
  const headerMuted = isDark ? colors.textMuted : 'rgba(255,255,255,0.65)';
  const indicatorColor = isDark ? colors.primary : colors.onPrimary;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: headerBg }]} edges={['top']}>
      <StatusBar style="light" />

      <View
        style={[
          styles.header,
          { backgroundColor: headerBg },
          isDark && { borderBottomWidth: 1, borderBottomColor: colors.divider },
        ]}
      >
        <View style={styles.brandRow}>
          <Pressable
            onPress={() => router.push('/profile')}
            hitSlop={8}
            accessibilityLabel={t('profile.title')}
          >
            <Image
              source={{ uri: profile.avatarUri }}
              style={[
                styles.headerAvatar,
                { borderColor: isDark ? colors.border : 'rgba(255,255,255,0.35)' },
              ]}
              contentFit="cover"
            />
          </Pressable>
          <Text style={[styles.brand, { color: headerFg }]}>Socialize</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable hitSlop={8} style={styles.iconBtn} accessibilityLabel={t('common.search')}>
            <Ionicons name="search" size={22} color={headerFg} />
          </Pressable>
          <Pressable
            hitSlop={8}
            style={styles.iconBtn}
            onPress={() => router.push('/calls')}
            accessibilityLabel={t('calls.title')}
          >
            <Ionicons name="call-outline" size={22} color={headerFg} />
          </Pressable>
          <Pressable
            hitSlop={8}
            style={styles.iconBtn}
            onPress={() => router.push('/settings')}
            accessibilityLabel={t('settings.title')}
          >
            <Ionicons name="settings-outline" size={21} color={headerFg} />
          </Pressable>
        </View>
      </View>

      <MaterialTopTabs
        screenOptions={{
          sceneStyle: { backgroundColor: colors.background },
          tabBarStyle: [
            styles.tabBar,
            { backgroundColor: headerBg },
            isDark && { borderBottomWidth: 1, borderBottomColor: colors.divider },
          ],
          tabBarIndicatorStyle: [styles.indicator, { backgroundColor: indicatorColor }],
          tabBarLabelStyle: styles.tabLabel,
          tabBarActiveTintColor: headerFg,
          tabBarInactiveTintColor: headerMuted,
          tabBarPressColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)',
          swipeEnabled: true,
          animationEnabled: true,
          lazy: false,
          lazyPreloadDistance: 2,
        }}
      >
        <MaterialTopTabs.Screen name="index" options={{ title: t('tabs.chats') }} />
        <MaterialTopTabs.Screen name="stories" options={{ title: t('tabs.stories') }} />
        <MaterialTopTabs.Screen name="explore" options={{ title: t('tabs.discover') }} />
      </MaterialTopTabs>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: Radii.pill,
    borderWidth: 1,
  },
  brand: {
    ...Typography.h2,
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 0,
  },
  indicator: {
    height: 3,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  tabLabel: {
    ...Typography.bodyStrong,
    textTransform: 'none',
    fontSize: 14,
  },
});
