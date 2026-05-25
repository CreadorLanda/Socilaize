import { DarkTheme, DefaultTheme, ThemeProvider, type Theme } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: 'onboarding',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const palette = Colors[isDark ? 'dark' : 'light'];

  // Bind the navigation theme to the app palette so every scene's container is
  // an opaque app colour. The default RN themes paint scenes white/black, which
  // is exactly the flash that shows between screens during a transition.
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
            <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: false }} />
          </Stack>
        </View>
        <StatusBar style="auto" />
      </ThemeProvider>
    </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
