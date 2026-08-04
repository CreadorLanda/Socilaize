import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  registerPushDevice,
  unregisterPushDevice,
  type NotifPlatform,
} from '@/data/api/notifications';

/**
 * Foreground presentation — show banner/sound when the app is open.
 * Must run once at module load (before any notification is received).
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function platformForDevice(): NotifPlatform {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'web') return 'web';
  return 'unknown';
}

/**
 * Ensure the Android default channel exists (required for Android 8+).
 */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#25D366',
  });
}

/**
 * Request permission and return an Expo push token when available.
 * Falls back to null on web / simulators without push support.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  // Physical device is required for real push on iOS; Android emulators can
  // still return Expo tokens in some setups — we try either way.
  if (!Device.isDevice && Platform.OS === 'ios') {
    return null;
  }

  await ensureAndroidChannel();

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') {
    return null;
  }

  // EAS projectId improves reliability; optional for Expo Go.
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string } }
    | undefined;
  const projectId =
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId ??
    extra?.eas?.projectId;

  try {
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return token.data ?? null;
  } catch {
    // Dev client without projectId / Expo Go edge cases.
    return null;
  }
}

/**
 * Obtain a push token and register it with the Socialize API.
 * Safe to call multiple times (upsert on the server).
 */
export async function registerPushWithServer(): Promise<string | null> {
  const token = await getExpoPushToken();
  if (!token) return null;
  await registerPushDevice(token, platformForDevice());
  return token;
}

/**
 * Drop this device's push token on sign-out.
 *
 * Without it the server keeps a token for a device where nobody is signed
 * in, and the next person to use that phone gets notifications for an
 * account that is not theirs.
 */
export async function unregisterPushWithServer(): Promise<void> {
  try {
    // The server identifies the device from the session, not from a token we
    // hand it: it deletes the row for this user_id + device_id pair.
    //
    // Bounded, because this runs before the session is torn down and a
    // request with no deadline would leave someone stuck on a screen they
    // asked to leave. Three seconds is long enough for a real network and
    // short enough not to be felt.
    await Promise.race([
      unregisterPushDevice(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);
  } catch {
    // Offline, revoked, slow — sign-out continues regardless. The cost of
    // failing here is a stale token, which the server drops on its first
    // `Unregistered` response from FCM anyway.
  }
}
