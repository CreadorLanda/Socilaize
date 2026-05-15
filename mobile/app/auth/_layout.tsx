import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';
import { RegistrationProvider } from '@/store/registration';

export default function AuthLayout() {
  return (
    <RegistrationProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.light.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="phone" />
        <Stack.Screen name="verify" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="username" />
        <Stack.Screen name="permissions" />
      </Stack>
    </RegistrationProvider>
  );
}
