/**
 * Reminders in the Hub.
 *
 * A reminder is a nudge at a moment; unlike an event it does not occupy time, and it may have no
 * date at all ("Someday"), which is why `due_at` is nullable. This file only reads and writes the
 * rows — the server decides when one fires and whether it rings the user.
 */

import { supabaseFetch } from '@/constants/supabase';
import { deviceTimezone, type Recurrence } from '@/services/hub/calendar';

/** How the reminder reaches the user. */
export type ReminderDelivery = 'notification' | 'call';

/** How insistent it is. Separate from delivery: a call can be gentle, a notification can be loud. */
export type ReminderStyle = 'alarm' | 'reminder' | 'quiet';

export type ReminderStatus = 'pending' | 'done' | 'missed' | 'cancelled';

export interface Reminder {
  id: string;
  title: string;
  notes: string | null;
  due_at: string | null;
  timezone: string;
  pin_to_timezone: boolean;
  lead_minutes: number;
  delivery: ReminderDelivery;
  style: ReminderStyle;
  recurrence: Recurrence;
  recurrence_until: string | null;
  escalate: boolean;
  escalate_after_minutes: number;
  escalate_phone: string | null;
  status: ReminderStatus;
  completed_at: string | null;
  event_id: string | null;
  call_id: string | null;
  created_at: string;
  updated_at: string;
}

/** What the edit screen hands back. `user_id` and `timezone` are filled in here. */
export interface ReminderDraft {
  title: string;
  notes: string | null;
  due_at: string | null;
  pin_to_timezone: boolean;
  lead_minutes: number;
  delivery: ReminderDelivery;
  style: ReminderStyle;
  recurrence: Recurrence;
  recurrence_until: string | null;
  escalate: boolean;
  escalate_after_minutes: number;
  escalate_phone: string | null;
}

const TABLE = '/rest/v1/reminders';
const COLUMNS =
  'id,title,notes,due_at,timezone,pin_to_timezone,lead_minutes,delivery,style,recurrence,recurrence_until,' +
  'escalate,escalate_after_minutes,escalate_phone,status,completed_at,event_id,call_id,created_at,updated_at';

/** One line each, so nobody has to guess what "quiet" means. */
export const STYLE_HELP: Record<ReminderStyle, { label: string; help: string }> = {
  alarm: { label: 'Alarm', help: 'Rings loudly and keeps going until you dismiss it.' },
  reminder: { label: 'Reminder', help: 'A normal notification, using your usual sound settings.' },
  quiet: { label: 'Quiet', help: 'No sound or buzz — it just waits in your notifications.' },
};

export const DELIVERY_HELP: Record<ReminderDelivery, { label: string; help: string }> = {
  notification: { label: 'Notification', help: 'Appears on your phone at the time you chose.' },
  call: { label: 'Phone call', help: 'The assistant rings you and tells you about it out loud.' },
};

export const DEFAULT_DRAFT: ReminderDraft = {
  title: '',
  notes: null,
  due_at: null,
  pin_to_timezone: false,
  lead_minutes: 0,
  delivery: 'notification',
  style: 'reminder',
  recurrence: 'none',
  recurrence_until: null,
  escalate: false,
  escalate_after_minutes: 3,
  escalate_phone: null,
};

async function fail(res: Response, fallback: string): Promise<never> {
  let detail = '';
  try {
    const body = (await res.json()) as { message?: string; hint?: string };
    detail = body.message ?? body.hint ?? '';
  } catch {
    detail = '';
  }
  throw new Error(detail || `${fallback} (${res.status}).`);
}

/**
 * Everything the reminders screen shows: still to do, plus anything already ticked off or missed
 * so the user can see and undo it. Cancelled rows are kept by the server but not shown.
 */
export async function listReminders(accessToken: string, limit = 200): Promise<Reminder[]> {
  const res = await supabaseFetch(
    `${TABLE}?select=${COLUMNS}&status=in.(pending,done,missed)&order=due_at.asc.nullslast,created_at.desc&limit=${limit}`,
    {},
    accessToken,
  );
  if (!res.ok) await fail(res, 'Your reminders could not be loaded');
  return (await res.json()) as Reminder[];
}

/** The ones with a moment inside this window — used by the calendar's day view. */
export async function listRemindersBetween(
  accessToken: string,
  from: Date,
  to: Date,
): Promise<Reminder[]> {
  const res = await supabaseFetch(
    `${TABLE}?select=${COLUMNS}&due_at=gte.${from.toISOString()}&due_at=lte.${to.toISOString()}` +
      '&status=in.(pending,done,missed)&order=due_at.asc',
    {},
    accessToken,
  );
  if (!res.ok) await fail(res, 'Your reminders could not be loaded');
  return (await res.json()) as Reminder[];
}

export async function fetchReminder(accessToken: string, id: string): Promise<Reminder | null> {
  const res = await supabaseFetch(
    `${TABLE}?select=${COLUMNS}&id=eq.${encodeURIComponent(id)}&limit=1`,
    {},
    accessToken,
  );
  if (!res.ok) await fail(res, 'That reminder could not be loaded');
  const rows = (await res.json()) as Reminder[];
  return rows[0] ?? null;
}

export async function createReminder(
  accessToken: string,
  userId: string,
  draft: ReminderDraft,
): Promise<Reminder> {
  const res = await supabaseFetch(
    TABLE,
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify([{ ...draft, user_id: userId, timezone: deviceTimezone() }]),
    },
    accessToken,
  );
  if (!res.ok) await fail(res, 'The reminder could not be saved');
  const rows = (await res.json()) as Reminder[];
  return rows[0];
}

export async function updateReminder(
  accessToken: string,
  id: string,
  patch: Partial<ReminderDraft>,
): Promise<void> {
  const res = await supabaseFetch(
    `${TABLE}?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    },
    accessToken,
  );
  if (!res.ok) await fail(res, 'The change could not be saved');
}

/** Ticked off. The row is kept so the user can see what they have done and undo a mistake. */
export async function setReminderDone(
  accessToken: string,
  id: string,
  done: boolean,
): Promise<void> {
  const now = new Date().toISOString();
  const res = await supabaseFetch(
    `${TABLE}?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: done ? 'done' : 'pending',
        completed_at: done ? now : null,
        updated_at: now,
      }),
    },
    accessToken,
  );
  if (!res.ok) await fail(res, done ? 'That could not be ticked off' : 'That could not be reopened');
  // A reminder that has been dealt with must not still buzz later, and must not escalate to a call.
  if (done) {
    const { cancelReminderNotification } = await import('./notifications');
    await cancelReminderNotification(id);
    await acknowledgeReminder(accessToken, id);
  }
}

/**
 * Marks the reminder as seen, which is what stops the server ringing the user about it. Done
 * whenever they tick it off or open it from a notification.
 */
export async function acknowledgeReminder(accessToken: string, id: string): Promise<void> {
  await supabaseFetch(
    `${TABLE}?id=eq.${encodeURIComponent(id)}&acknowledged_at=is.null`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ acknowledged_at: new Date().toISOString() }),
    },
    accessToken,
  ).catch(() => {
    /* the escalation is a backstop; failing to silence it is not worth an error on screen */
  });
}

export async function deleteReminder(accessToken: string, id: string): Promise<void> {
  const res = await supabaseFetch(
    `${TABLE}?id=eq.${encodeURIComponent(id)}`,
    { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
    accessToken,
  );
  if (!res.ok) await fail(res, 'The reminder could not be deleted');
  const { cancelReminderNotification } = await import('./notifications');
  await cancelReminderNotification(id);
}

// ─── Grouping ────────────────────────────────────────────────────────────────

export type ReminderGroup = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'someday';

export const GROUP_TITLES: Record<ReminderGroup, string> = {
  overdue: 'Overdue',
  today: 'Today',
  tomorrow: 'Tomorrow',
  week: 'This week',
  later: 'Later',
  someday: 'Someday',
};

/** The order the sections appear in; `someday` is listed separately as the undated list. */
export const DATED_GROUPS: ReminderGroup[] = ['overdue', 'today', 'tomorrow', 'week', 'later'];
