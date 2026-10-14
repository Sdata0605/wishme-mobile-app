/**
 * Occasion alerts: loading them, working out when each one next falls, and telling the user.
 *
 * Like reminders, the phone schedules its own notifications, so they fire on the day at the chosen time
 * even offline and with the app closed. They are rebuilt every time the app starts or returns to the
 * foreground (Android drops them on reboot). Whatever is due while the app is open is shown as an
 * in-app message instead (see components/OccasionInApp.tsx).
 */

import * as Notifications from 'expo-notifications';
import { supabaseFetch } from '@/constants/supabase';
import type { IconName } from '@/components/Icon';
import { ensureNotificationPermission, REMINDER_CHANNEL, type NotificationPermission } from '@/services/hub/notifications';

export type OccasionType = 'birthday' | 'anniversary' | 'wedding' | 'festival' | 'other';

export const OCCASION_TYPES: { key: OccasionType; label: string; icon: IconName; color: string; emoji: string; recurring: boolean }[] = [
  { key: 'birthday', label: 'Birthday', icon: 'gift', color: '#7B5CFA', emoji: '🎂', recurring: true },
  { key: 'anniversary', label: 'Anniversary', icon: 'heart', color: '#D23FE0', emoji: '💞', recurring: true },
  { key: 'wedding', label: 'Wedding', icon: 'sparkles', color: '#1F7BFF', emoji: '💍', recurring: false },
  { key: 'festival', label: 'Festival', icon: 'zap', color: '#F5A524', emoji: '🪔', recurring: true },
  { key: 'other', label: 'Other', icon: 'calendar', color: '#3B82F6', emoji: '🎉', recurring: false },
];

export function normType(raw: string | null | undefined): OccasionType {
  const t = (raw ?? '').toLowerCase();
  return (OCCASION_TYPES.find(x => x.key === t)?.key) ?? 'other';
}

export const typeInfo = (raw: string | null | undefined) => OCCASION_TYPES.find(x => x.key === normType(raw))!;

export interface AlertRow {
  id: string;
  occasion_name: string;
  occasion_type: string;
  occasion_date: string;
  alert_enabled: boolean;
  auto_send_enabled: boolean;
  alert_days_before: number;
  reminder_time: string | null;
  loved_one_id: string | null;
  celebrity_id: string | null;
  loved_ones: { first_name: string; last_name: string | null } | null;
  celebrities: { name: string } | null;
}

export interface LovedOneLite {
  id: string;
  first_name: string;
  last_name: string | null;
  relationship: string | null;
  occasions: { id: string; name: string; date: string; type: string }[] | null;
}

export const REMINDER_TIMES = [
  { value: '08:00', label: '8 AM' },
  { value: '09:00', label: '9 AM' },
  { value: '12:00', label: '12 PM' },
  { value: '18:00', label: '6 PM' },
  { value: '21:00', label: '9 PM' },
];

export const DAYS_BEFORE = [
  { value: 0, label: 'On the day' },
  { value: 1, label: '1 day' },
  { value: 3, label: '3 days' },
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
];

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

export function personOf(a: Pick<AlertRow, 'loved_ones' | 'celebrities'>): string {
  if (a.loved_ones) return `${a.loved_ones.first_name} ${a.loved_ones.last_name ?? ''}`.trim();
  return a.celebrities?.name ?? 'Someone special';
}

/** Birthdays, anniversaries and festivals come back every year; other dates happen once. */
export function effectiveDate(a: Pick<AlertRow, 'occasion_date' | 'occasion_type'>): Date {
  const [y, m, d] = a.occasion_date.split('-').map(Number);
  const exact = new Date(y, m - 1, d);
  if (!typeInfo(a.occasion_type).recurring) return exact;
  const today = startOfToday();
  const thisYear = new Date(today.getFullYear(), m - 1, d);
  return thisYear >= today ? thisYear : new Date(today.getFullYear() + 1, m - 1, d);
}

export function daysUntilAlert(a: Pick<AlertRow, 'occasion_date' | 'occasion_type'>): number {
  return Math.round((effectiveDate(a).getTime() - startOfToday().getTime()) / 86400000);
}

function hm(time: string | null | undefined): { h: number; m: number } {
  const [h, m] = (time ?? '09:00').split(':').map(Number);
  return { h: Number.isFinite(h) ? h : 9, m: Number.isFinite(m) ? m : 0 };
}

/** The moment, on a given day, at the alert's chosen time. */
function atTime(day: Date, time: string | null | undefined): Date {
  const { h, m } = hm(time);
  const t = new Date(day);
  t.setHours(h, m, 0, 0);
  return t;
}

export function timeLabel(time: string | null | undefined): string {
  return REMINDER_TIMES.find(t => t.value === (time ?? '09:00').slice(0, 5))?.label ?? (time ?? '9 AM').slice(0, 5);
}

// ─── Data ────────────────────────────────────────────────────────────────────

export async function fetchAlerts(profileId: string, token: string): Promise<AlertRow[]> {
  const res = await supabaseFetch(
    `/rest/v1/occasion_alerts?select=*,loved_ones(first_name,last_name),celebrities!occasion_alerts_celebrity_id_fkey(name)&user_id=eq.${profileId}&order=occasion_date.asc`,
    {},
    token,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<AlertRow[]>;
}

export async function fetchLovedOnes(profileId: string, token: string): Promise<LovedOneLite[]> {
  const res = await supabaseFetch(
    `/rest/v1/loved_ones?select=id,first_name,last_name,relationship,occasions&user_id=eq.${profileId}&order=first_name.asc`,
    {},
    token,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<LovedOneLite[]>;
}

export async function patchAlert(id: string, body: Partial<AlertRow>, token: string): Promise<void> {
  const res = await supabaseFetch(`/rest/v1/occasion_alerts?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export interface NewOccasion {
  profileId: string;
  /** An existing person, or leave out and give newPerson to create one. */
  lovedOneId?: string;
  newPerson?: { firstName: string; relationship: string };
  type: OccasionType;
  name: string;
  date: string;
  notify: boolean;
  daysBefore: number;
  reminderTime: string;
}

/** Saves one occasion for a person (creating the person first if needed). */
export async function createOccasion(input: NewOccasion, token: string): Promise<void> {
  let lovedOneId = input.lovedOneId;
  let existing: LovedOneLite['occasions'] = [];

  if (!lovedOneId && input.newPerson) {
    const res = await supabaseFetch('/rest/v1/loved_ones', {
      method: 'POST',
      headers: { Prefer: 'return=representation' } as Record<string, string>,
      body: JSON.stringify({
        user_id: input.profileId,
        first_name: input.newPerson.firstName.trim(),
        relationship: input.newPerson.relationship,
        occasions: [],
      }),
    }, token);
    if (!res.ok) throw new Error('Could not add this person');
    lovedOneId = ((await res.json()) as { id: string }[])[0]?.id;
  } else if (lovedOneId) {
    const res = await supabaseFetch(`/rest/v1/loved_ones?id=eq.${lovedOneId}&select=occasions`, {}, token);
    if (res.ok) existing = ((await res.json()) as { occasions: LovedOneLite['occasions'] }[])[0]?.occasions ?? [];
  }
  if (!lovedOneId) throw new Error('Choose a person first');

  const alertRes = await supabaseFetch('/rest/v1/occasion_alerts?on_conflict=user_id,loved_one_id,occasion_name', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } as Record<string, string>,
    body: JSON.stringify({
      user_id: input.profileId,
      loved_one_id: lovedOneId,
      occasion_name: input.name.trim(),
      occasion_type: input.type,
      occasion_date: input.date,
      alert_enabled: input.notify,
      auto_send_enabled: false,
      alert_days_before: input.daysBefore,
      reminder_time: `${input.reminderTime}:00`,
    }),
  }, token);
  if (!alertRes.ok) throw new Error('Could not save this occasion');

  // Keep the Loved Ones screen in step: it shows occasions from the person's own list.
  const label = typeInfo(input.type).label;
  const list = (existing ?? []).filter(o => o.name !== input.name.trim());
  list.push({ id: `occ${Date.now()}`, name: input.name.trim(), date: input.date, type: label });
  await supabaseFetch(`/rest/v1/loved_ones?id=eq.${lovedOneId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' } as Record<string, string>,
    body: JSON.stringify({ occasions: list }),
  }, token).catch(() => {});
}

// ─── Phone notifications ─────────────────────────────────────────────────────

const PREFIX = 'occasion:';
/** Both platforms cap pending notifications (iOS: 64); reminders keep the rest. */
const MAX_PENDING = 20;
const HORIZON_DAYS = 60;

function whenWords(days: number): string {
  return days === 1 ? 'tomorrow' : `in ${days} days`;
}

function fmtLong(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
}

function noticeFor(a: AlertRow, kind: 'today' | 'ahead', daysAhead: number): { title: string; body: string } {
  const info = typeInfo(a.occasion_type);
  const who = personOf(a);
  const noun = info.key === 'birthday' ? 'birthday' : info.key === 'anniversary' ? 'anniversary' : 'special day';
  if (kind === 'today') {
    return { title: `${info.emoji} ${who}'s ${noun} is today`, body: `${a.occasion_name}. Tap to send a wish.` };
  }
  return {
    title: `${info.emoji} ${who}'s ${noun} is ${whenWords(daysAhead)}`,
    body: `${a.occasion_name} on ${fmtLong(effectiveDate(a))}. Tap to plan a wish.`,
  };
}

/** Clears the occasion notifications only; reminder notifications are left alone. */
async function clearOccasionNotifications() {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    pending.filter(n => n.identifier.startsWith(PREFIX)).map(n => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})),
  );
}

/**
 * Makes the phone's scheduled occasion notifications match the alerts. A heads-up goes out N days before
 * (when N > 0) and another on the day itself, both at the time the user chose. Never asks for permission:
 * that happens when the user turns "Notify me" on.
 */
export async function scheduleOccasionNotifications(rows: AlertRow[]): Promise<{ scheduled: number; permission: NotificationPermission }> {
  const permission = await ensureNotificationPermission(false);
  if (permission !== 'granted') return { scheduled: 0, permission };

  const now = Date.now();
  const horizon = now + HORIZON_DAYS * 86400000;
  const candidates: { id: string; at: Date; title: string; body: string; alertId: string }[] = [];

  for (const a of rows) {
    if (!a.alert_enabled) continue;
    const day = effectiveDate(a);
    const onDay = atTime(day, a.reminder_time);
    const push = (id: string, at: Date, n: { title: string; body: string }) => {
      if (at.getTime() > now && at.getTime() < horizon) candidates.push({ id, at, ...n, alertId: a.id });
    };
    push(`${PREFIX}${a.id}:today`, onDay, noticeFor(a, 'today', 0));
    if (a.alert_days_before > 0) {
      const ahead = new Date(day);
      ahead.setDate(ahead.getDate() - a.alert_days_before);
      push(`${PREFIX}${a.id}:ahead`, atTime(ahead, a.reminder_time), noticeFor(a, 'ahead', a.alert_days_before));
    }
  }

  candidates.sort((x, y) => x.at.getTime() - y.at.getTime());
  await clearOccasionNotifications();

  let scheduled = 0;
  for (const c of candidates.slice(0, MAX_PENDING)) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: c.id,
        content: { title: c.title, body: c.body, sound: 'default', data: { kind: 'occasion', alertId: c.alertId } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: c.at, channelId: REMINDER_CHANNEL },
      });
      scheduled++;
    } catch (e) {
      console.warn('[occasions] could not schedule', c.id, e instanceof Error ? e.message : e);
    }
  }
  console.log(`[occasions] ${scheduled} notifications scheduled`);
  return { scheduled, permission };
}

// ─── In-app messages ─────────────────────────────────────────────────────────

export interface InAppMessage {
  key: string;
  alertId: string;
  kind: 'today' | 'ahead';
  title: string;
  body: string;
  emoji: string;
  color: string;
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Messages that should be on screen right now: the occasion is today (or exactly N days away, for the
 * heads-up) and the chosen time has arrived. `msUntilNext` tells the caller when to look again today.
 */
export function dueInAppMessages(rows: AlertRow[], seen: Set<string>): { due: InAppMessage[]; msUntilNext: number | null } {
  const now = new Date();
  const due: InAppMessage[] = [];
  let msUntilNext: number | null = null;

  for (const a of rows) {
    if (!a.alert_enabled) continue;
    const days = daysUntilAlert(a);
    const kind: 'today' | 'ahead' | null = days === 0 ? 'today' : a.alert_days_before > 0 && days === a.alert_days_before ? 'ahead' : null;
    if (!kind) continue;
    const key = `${a.id}:${kind}:${ymd(now)}`;
    if (seen.has(key)) continue;

    const at = atTime(startOfToday(), a.reminder_time);
    if (at.getTime() > now.getTime()) {
      const wait = at.getTime() - now.getTime();
      msUntilNext = msUntilNext === null ? wait : Math.min(msUntilNext, wait);
      continue;
    }
    const info = typeInfo(a.occasion_type);
    const text = noticeFor(a, kind, days);
    due.push({ key, alertId: a.id, kind, title: text.title, body: text.body, emoji: info.emoji, color: info.color });
  }
  return { due, msUntilNext };
}
