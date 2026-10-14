/**
 * Calendar events in the Hub.
 *
 * The rows live on the server (public.calendar_events) rather than only on the phone, because the
 * reminder dispatcher has to read them while the app is closed. Every instant is stored in UTC and
 * formatted by the screens in the device's local time.
 */

import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarYears,
  endOfDay,
  isAfter,
  isBefore,
} from 'date-fns';
import { supabaseFetch } from '@/constants/supabase';

/** A full RRULE is deliberately not supported: the column only holds these. */
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

/** `user` = they added it. The others are mirrored from elsewhere and must not be edited here. */
export type EventSource = 'user' | 'occasion' | 'booking';

export interface CalendarEvent {
  id: string;
  title: string;
  notes: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  timezone: string;
  recurrence: Recurrence;
  recurrence_until: string | null;
  colour: string | null;
  source: EventSource;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

/** What the edit screen hands back. `user_id` and `timezone` are filled in here. */
export interface EventDraft {
  title: string;
  notes: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  recurrence: Recurrence;
  recurrence_until: string | null;
}

const TABLE = '/rest/v1/calendar_events';
const COLUMNS =
  'id,title,notes,location,starts_at,ends_at,all_day,timezone,recurrence,recurrence_until,colour,source,source_id,created_at,updated_at';

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: 'Does not repeat',
  daily: 'Every day',
  weekly: 'Every week',
  monthly: 'Every month',
  yearly: 'Every year',
};

/**
 * The zone the phone is in right now. Stored alongside the instant so an event can still be shown
 * at the wall-clock time it was created for after the user travels.
 */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

/** Turns a failed REST call into a message worth showing someone. */
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
 * Events that could show up between `from` and `to`. A repeating event is fetched whatever its
 * start date, because its later occurrences may land inside the window — `expandEvents` works
 * those out.
 */
export async function listEvents(accessToken: string, from: Date, to: Date): Promise<CalendarEvent[]> {
  const path =
    `${TABLE}?select=${COLUMNS}` +
    `&starts_at=lte.${to.toISOString()}` +
    `&or=(starts_at.gte.${from.toISOString()},recurrence.neq.none)` +
    '&order=starts_at.asc';
  const res = await supabaseFetch(path, {}, accessToken);
  if (!res.ok) await fail(res, 'Your calendar could not be loaded');
  return (await res.json()) as CalendarEvent[];
}

export async function fetchEvent(accessToken: string, id: string): Promise<CalendarEvent | null> {
  const res = await supabaseFetch(
    `${TABLE}?select=${COLUMNS}&id=eq.${encodeURIComponent(id)}&limit=1`,
    {},
    accessToken,
  );
  if (!res.ok) await fail(res, 'That event could not be loaded');
  const rows = (await res.json()) as CalendarEvent[];
  return rows[0] ?? null;
}

export async function createEvent(
  accessToken: string,
  userId: string,
  draft: EventDraft,
): Promise<CalendarEvent> {
  const res = await supabaseFetch(
    TABLE,
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify([{ ...draft, user_id: userId, timezone: deviceTimezone() }]),
    },
    accessToken,
  );
  if (!res.ok) await fail(res, 'The event could not be saved');
  const rows = (await res.json()) as CalendarEvent[];
  return rows[0];
}

export async function updateEvent(
  accessToken: string,
  id: string,
  patch: Partial<EventDraft>,
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

export async function deleteEvent(accessToken: string, id: string): Promise<void> {
  const res = await supabaseFetch(
    `${TABLE}?id=eq.${encodeURIComponent(id)}`,
    { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
    accessToken,
  );
  if (!res.ok) await fail(res, 'The event could not be deleted');
}

// ─── Repeating events ────────────────────────────────────────────────────────

/** One appearance of an event on the calendar. A repeating event has many. */
export interface EventOccurrence {
  /** Unique per appearance, so a repeating event can be used as a list key. */
  key: string;
  event: CalendarEvent;
  start: Date;
  end: Date | null;
}

const STEP: Record<Recurrence, ((d: Date) => Date) | null> = {
  none: null,
  daily: (d) => addDays(d, 1),
  weekly: (d) => addWeeks(d, 1),
  monthly: (d) => addMonths(d, 1),
  yearly: (d) => addYears(d, 1),
};

/** A month grid asks for at most ~42 days, so this is far more headroom than any screen needs. */
const MAX_OCCURRENCES = 500;

/**
 * Jumps straight to the repeat just before `from`, so a daily event started years ago does not
 * have to be stepped through one day at a time.
 */
function fastForward(start: Date, from: Date, recurrence: Recurrence): Date {
  if (recurrence === 'none' || !isBefore(start, from)) return start;
  switch (recurrence) {
    case 'daily': {
      const n = differenceInCalendarDays(from, start) - 1;
      return n > 0 ? addDays(start, n) : start;
    }
    case 'weekly': {
      const n = Math.floor(differenceInCalendarDays(from, start) / 7) - 1;
      return n > 0 ? addWeeks(start, n) : start;
    }
    case 'monthly': {
      const n = differenceInCalendarMonths(from, start) - 1;
      return n > 0 ? addMonths(start, n) : start;
    }
    case 'yearly': {
      const n = differenceInCalendarYears(from, start) - 1;
      return n > 0 ? addYears(start, n) : start;
    }
    default:
      return start;
  }
}

/** Every appearance of these events that falls inside the window, oldest first. */
export function expandEvents(events: CalendarEvent[], from: Date, to: Date): EventOccurrence[] {
  const out: EventOccurrence[] = [];

  for (const event of events) {
    const firstStart = new Date(event.starts_at);
    if (Number.isNaN(firstStart.getTime())) continue;

    const endValue = event.ends_at ? new Date(event.ends_at) : null;
    const lengthMs =
      endValue && !Number.isNaN(endValue.getTime())
        ? Math.max(0, endValue.getTime() - firstStart.getTime())
        : 0;

    // recurrence_until is a date, so the last day counts in full.
    const until = event.recurrence_until ? endOfDay(new Date(`${event.recurrence_until}T00:00:00`)) : null;
    const step = STEP[event.recurrence];

    let cursor = fastForward(firstStart, from, event.recurrence);
    for (let guard = 0; guard < MAX_OCCURRENCES; guard++) {
      if (isAfter(cursor, to)) break;
      if (until && isAfter(cursor, until)) break;

      const end = lengthMs > 0 ? new Date(cursor.getTime() + lengthMs) : null;
      // An event that started before the window but runs into it still belongs on screen.
      const reachesWindow = !isBefore(cursor, from) || (end !== null && !isBefore(end, from));
      if (reachesWindow) {
        out.push({ key: `${event.id}:${cursor.toISOString()}`, event, start: cursor, end });
      }

      if (!step) break;
      cursor = step(cursor);
    }
  }

  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}
