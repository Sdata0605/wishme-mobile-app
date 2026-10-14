/**
 * Reminder notifications.
 *
 * The phone schedules its own notifications rather than waiting for the server to push one. That
 * way a reminder fires at the exact second, with no signal, and costs nothing. The server only
 * handles what a sleeping phone genuinely cannot do: placing a call, and escalating a reminder
 * nobody answered. Its push is a backstop for a device that has not checked in for days.
 *
 * Android drops scheduled alarms on reboot and when an app is force-stopped, so everything pending
 * is scheduled again each time the app starts.
 */

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabaseFetch } from '@/constants/supabase';
import { listReminders, type Reminder } from './reminders';

/** Far enough ahead to cover normal use; the rest are scheduled on a later app start. */
const HORIZON_DAYS = 30;
/** Both platforms cap how many notifications one app may have pending. */
const MAX_PENDING = 40;

export const ALARM_CHANNEL = 'alarms';
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
  // Two channels so the user can silence ordinary reminders without silencing an alarm — Android
  // only lets them make that choice per channel.
  await Notifications.setNotificationChannelAsync(ALARM_CHANNEL, {
    name: 'Alarms',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 400, 200, 400],
    bypassDnd: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
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
 * prompt could never appear and every reminder was silently skipped.
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

// ─── Scheduling ──────────────────────────────────────────────────────────────

const idFor = (reminder: Reminder) => `reminder:${reminder.id}`;

/** "10:30 AM" */
function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "5 minutes", "1 hour", "2 days" */
function leadLabel(minutes: number): string {
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (minutes >= 1440 && minutes % 1440 === 0) return unit(minutes / 1440, 'day');
  if (minutes >= 60 && minutes % 60 === 0) return unit(minutes / 60, 'hour');
  return unit(minutes, 'minute');
}

/**
 * What the notification says. It is read on a lock screen, long after it was scheduled, so the
 * wording describes the moment it fires: "due now" when it goes off on time, "in 15 minutes" when
 * the user asked for a heads-up, never a date that could be stale by then.
 */
function messageFor(reminder: Reminder): { title: string; body: string } {
  const icon = reminder.style === 'alarm' ? '⏰' : reminder.style === 'quiet' ? '' : '🔔';
  const title = `${icon ? `${icon} ` : ''}${reminder.title}`;

  const lines: string[] = [];
  if (reminder.due_at) {
    const time = clockTime(reminder.due_at);
    const lead = reminder.lead_minutes ?? 0;
    lines.push(lead > 0 ? `Coming up in ${leadLabel(lead)}, at ${time}.` : `It's ${time}. Time for this reminder!`);
  } else {
    lines.push('A reminder you set for yourself.');
  }
  const notes = reminder.notes?.trim();
  if (notes) lines.push(notes);
  lines.push('Tap to open.');
  return { title, body: lines.join('\n') };
}

/** When the user should actually be told, which is `lead_minutes` before the reminder is due. */
function fireAt(reminder: Reminder): Date | null {
  if (!reminder.due_at) return null;
  const at = new Date(new Date(reminder.due_at).getTime() - (reminder.lead_minutes ?? 0) * 60_000);
  return Number.isNaN(at.getTime()) ? null : at;
}

async function scheduleOne(reminder: Reminder) {
  const at = fireAt(reminder);
  if (!at || at.getTime() <= Date.now()) return false;

  const quiet = reminder.style === 'quiet';
  const { title, body } = messageFor(reminder);

  await Notifications.scheduleNotificationAsync({
    identifier: idFor(reminder),
    content: {
      title,
      body,
      sound: quiet ? undefined : 'default',
      // A "quiet" reminder waits silently; an alarm should be hard to miss.
      priority: reminder.style === 'alarm'
        ? Notifications.AndroidNotificationPriority.MAX
        : quiet
          ? Notifications.AndroidNotificationPriority.LOW
          : Notifications.AndroidNotificationPriority.HIGH,
      data: { kind: 'reminder', reminderId: reminder.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: at,
      channelId: reminder.style === 'alarm' ? ALARM_CHANNEL : REMINDER_CHANNEL,
    },
  });
  return true;
}

export interface SyncResult {
  scheduled: number;
  permission: NotificationPermission;
}

/**
 * Brings the phone's scheduled notifications in line with the reminders on the server. Safe to run
 * often: everything is cleared and rebuilt, so a reminder can never be scheduled twice.
 *
 * With `ask`, an app that is not yet allowed to show notifications asks the user for permission.
 */
export async function syncScheduledReminders(
  accessToken: string,
  opts: { ask?: boolean } = {},
): Promise<SyncResult> {
  let permission: NotificationPermission = 'denied';
  try {
    permission = await ensureNotificationPermission(!!opts.ask);
    if (permission !== 'granted') {
      console.warn(`[reminders] notifications are ${permission}; nothing scheduled`);
      return { scheduled: 0, permission };
    }

    const reminders = await listReminders(accessToken);
    const horizon = Date.now() + HORIZON_DAYS * 86_400_000;
    const due = reminders
      .filter((r) => r.status === 'pending' && r.delivery === 'notification')
      .map((r) => ({ r, at: fireAt(r) }))
      .filter((x): x is { r: Reminder; at: Date } => x.at !== null && x.at.getTime() > Date.now() && x.at.getTime() < horizon)
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .slice(0, MAX_PENDING);

    // Only reminder notifications are rebuilt here; occasion alerts keep their own (see services/occasionAlerts.ts).
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      pending
        .filter((n) => n.identifier.startsWith('reminder:'))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})),
    );
    let scheduled = 0;
    for (const { r, at } of due) {
      try {
        if (await scheduleOne(r)) {
          scheduled++;
          console.log(`[reminders] scheduled "${r.title}" for ${at.toLocaleString()}`);
        }
      } catch (ex) {
        console.warn(`[reminders] could not schedule "${r.title}":`, ex instanceof Error ? ex.message : ex);
      }
    }
    console.log(`[reminders] ${scheduled} scheduled of ${reminders.length} reminders`);
    return { scheduled, permission };
  } catch (ex) {
    console.warn('[reminders] sync failed:', ex instanceof Error ? ex.message : ex);
    return { scheduled: 0, permission };
  }
}

/** Drops one reminder's notification, for when it is ticked off or deleted. */
export async function cancelReminderNotification(reminderId: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(`reminder:${reminderId}`);
  } catch {
    /* it may already have fired */
  }
}

/** The reminder a notification refers to, so tapping one can open it. */
export function reminderIdFrom(response: Notifications.NotificationResponse): string | null {
  const data = response.notification.request.content.data as { kind?: string; reminderId?: string } | undefined;
  return data?.kind === 'reminder' && data.reminderId ? data.reminderId : null;
}
