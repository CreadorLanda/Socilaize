import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';
import { RegistrationProvider } from '@/store/registration';

export default function AuthLayout() {
  const { colors } = useTheme();
  return (
    <RegistrationProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="phone" />
        <Stack.Screen name="verify" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="username" />
        <Stack.Screen name="permissions" />
        <Stack.Screen name="whatsapp" />
      </Stack>
    </RegistrationProvider>
  );
}
