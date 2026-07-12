import { DarkTheme, DefaultTheme, ThemeProvider, type Theme } from '@react-navigation/native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import 'react-native-reanimated';

import { AppToast } from '@/components/ui/app-toast';
import { bootstrapAuth } from '@/data/auth-store';
import { ensureKeysPublished } from '@/data/crypto';
import { registerPushWithServer } from '@/data/push';
import { useTheme } from '@/hooks/use-theme';

export const unstable_settings = {
  anchor: 'onboarding',
};

export default function RootLayout() {
  const { colors: palette, isDark } = useTheme();
  // Restore the persisted session before the first navigation. We always
  // render the Stack (so the navigator is mounted and router.replace works),
  // but cover it with a splash backstop until boot resolves — this hides the
  // brief onboarding flash that returning users would otherwise see.
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    let mounted = true;
    bootstrapAuth().then((user) => {
      if (!mounted) return;
      if (user) {
        router.replace('/(tabs)');
        // Register Expo/FCM token once a session is restored.
        registerPushWithServer().catch(() => {});
        // Generate / publish Signal-style pre-key material for E2EE.
        ensureKeysPublished().catch(() => {});
      }
      setBooted(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Bind the navigation theme to the app palette so every scene's container is
  // an opaque app colour. The default RN themes paint scenes white/black, which
  // is exactly the flash that shows between screens during a transition.
  // Marketplace packs flow through useTheme so transitions stay on-pack.
  const base = isDark ? DarkTheme : DefaultTheme;
  const navTheme: Theme = {
    ...base,
    colors: {
      ...base.colors,
      background: palette.background,
      card: palette.surface,
      border: palette.border,
      text: palette.text,
      primary: palette.primary,
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <KeyboardProvider>
      <ThemeProvider value={navTheme}>
        {/* Opaque app-coloured backstop behind every native screen — if a
            transition ever exposes a gap, this shows, never the white window. */}
        <View style={{ flex: 1, backgroundColor: palette.background }}>
          <Stack
            screenOptions={{
              contentStyle: { backgroundColor: palette.background },
              // Slides keep both screens adjacent and opaque, so neither push
              // nor pop ever reveals the window. Fades would expose it.
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="chat-info/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="channel/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="channel-info/[id]" options={{ headerShown: false }} />
            <Stack.Screen
              name="channel/create"
              options={{
                headerShown: false,
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
            <Stack.Screen name="channel/settings/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="search" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="profile" options={{ headerShown: false }} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
            <Stack.Screen name="calls" options={{ headerShown: false }} />
            <Stack.Screen
              name="story/[id]"
              options={{
                headerShown: false,
                animation: 'slide_from_bottom',
                contentStyle: { backgroundColor: '#050609' },
              }}
            />
            <Stack.Screen
              name="story/create"
              options={{
                headerShown: false,
                presentation: 'fullScreenModal',
                animation: 'slide_from_bottom',
                contentStyle: { backgroundColor: '#050609' },
              }}
            />
            <Stack.Screen
              name="call/[id]"
              options={{
                headerShown: false,
                presentation: 'fullScreenModal',
                contentStyle: { backgroundColor: '#050609' },
              }}
            />
            <Stack.Screen
              name="hangout/[id]"
              options={{
                headerShown: false,
                presentation: 'fullScreenModal',
                animation: 'slide_from_bottom',
                contentStyle: { backgroundColor: '#0B0C10' },
              }}
            />
            <Stack.Screen name="themes/index" options={{ headerShown: false }} />
            <Stack.Screen
              name="themes/create"
              options={{
                headerShown: false,
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
            <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: false }} />
          </Stack>
          {!booted ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: palette.background,
              }}
            />
          ) : null}
          {/* Global toast for background story publish, etc. */}
          <AppToast />
        </View>
        <StatusBar style="auto" />
      </ThemeProvider>
    </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
