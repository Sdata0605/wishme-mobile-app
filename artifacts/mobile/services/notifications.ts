/**
 * Notifications: the Android channel, the permission prompt and the push token.
 *
 * Occasion alerts (birthdays and anniversaries of loved ones) schedule their notifications on the
 * phone through the `reminders` channel, which is also the default channel in app.json.
 */

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabaseFetch } from '@/constants/supabase';

export const REMINDER_CHANNEL = 'reminders';

/** A notification arriving while the app is open should still be seen and heard. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250],
  });
}

// ─── Permission ──────────────────────────────────────────────────────────────

/**
 * - `granted`: notifications will show
 * - `denied`: not allowed yet but can still be asked
 * - `blocked`: the user said no and Android/iOS will not let us ask again; only Settings can fix it
 */
export type NotificationPermission = 'granted' | 'denied' | 'blocked';

/**
 * Makes sure the app is allowed to show notifications, asking if `ask` is set.
 *
 * Nothing used to ask at all. Android 13+ shows the permission prompt only once a notification
 * channel exists, and the channels were only created after the permission check had passed, so the
 * prompt could never appear and every occasion reminder was silently skipped.
 */
export async function ensureNotificationPermission(ask: boolean): Promise<NotificationPermission> {
  await ensureChannels(); // must exist first: creating a channel is what lets Android 13+ show the prompt
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted && ask && perm.canAskAgain) {
    perm = await Notifications.requestPermissionsAsync();
  }
  if (perm.granted) return 'granted';
  return perm.canAskAgain ? 'denied' : 'blocked';
}

// ─── Push token ──────────────────────────────────────────────────────────────

/**
 * Registers this device so the server can reach it when the app is closed. Only used as a
 * backstop, so a failure here is not worth bothering the user about.
 */
export async function registerPushToken(accessToken: string, projectId?: string) {
  if (!Device.isDevice) return; // simulators cannot receive push
  try {
    const { granted } = await Notifications.getPermissionsAsync();
    if (!granted) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (!token) return;
    await supabaseFetch(
      '/rest/v1/push_tokens',
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ token, platform: Platform.OS, last_seen_at: new Date().toISOString() }),
      },
      accessToken,
    );
  } catch {
    /* the device simply misses the backstop */
  }
}
