import { Ionicons } from '@expo/vector-icons';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { withLayoutContext } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Palette, Radii, Spacing, Typography } from '@/constants/theme';
import { t } from '@/i18n';

const { Navigator } = createMaterialTopTabNavigator();
const MaterialTopTabs = withLayoutContext(Navigator);

export default function TabLayout() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.brand}>Socialize</Text>
        <View style={styles.headerActions}>
          <Pressable hitSlop={8} style={styles.iconBtn} accessibilityLabel="Camera">
            <Ionicons name="camera-outline" size={22} color={Colors.light.onPrimary} />
          </Pressable>
          <Pressable hitSlop={8} style={styles.iconBtn} accessibilityLabel="Search">
            <Ionicons name="search" size={22} color={Colors.light.onPrimary} />
          </Pressable>
          <Pressable hitSlop={8} style={styles.iconBtn} accessibilityLabel="More">
            <Ionicons name="ellipsis-vertical" size={20} color={Colors.light.onPrimary} />
          </Pressable>
        </View>
      </View>

      <MaterialTopTabs
        screenOptions={{
          tabBarStyle: styles.tabBar,
          tabBarIndicatorStyle: styles.indicator,
          tabBarLabelStyle: styles.tabLabel,
          tabBarActiveTintColor: Colors.light.onPrimary,
          tabBarInactiveTintColor: 'rgba(255,255,255,0.65)',
          tabBarPressColor: 'rgba(255,255,255,0.12)',
          swipeEnabled: true,
          animationEnabled: true,
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
    backgroundColor: Palette.brand[600],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Palette.brand[600],
  },
  brand: {
    ...Typography.h2,
    color: Colors.light.onPrimary,
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
    backgroundColor: Palette.brand[600],
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 0,
  },
  indicator: {
    backgroundColor: Colors.light.onPrimary,
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
