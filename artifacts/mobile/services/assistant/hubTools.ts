/**
 * Reminders and calendar events, created by voice.
 *
 * The Hub screens are forms; this is the shortcut. "Remind me to call Raj at five" should just
 * work, so the model is given the user's current date and time and asked for a plain ISO moment
 * rather than being left to invent its own phrasing.
 */

import { createEvent, deviceTimezone, listEvents, type EventDraft } from '@/services/hub/calendar';
import {
  createReminder,
  DEFAULT_DRAFT,
  listReminders,
  type Reminder,
  type ReminderDelivery,
  type ReminderDraft,
  type ReminderStyle,
} from '@/services/hub/reminders';
import { checkPhoneNumber } from './aiCalls';

const str = (description: string) => ({ type: 'STRING', description });
const num = (description: string) => ({ type: 'NUMBER', description });

export const HUB_FUNCTION_DECLARATIONS = [
  {
    name: 'add_reminder',
    description:
      'Create a reminder for the user. Use it whenever they say "remind me…", "don\'t let me forget…", "wake me at…" or similar. Work out the exact date and time yourself from what they said and from today\'s date — never ask them to repeat it in a different format. If they gave no time at all, leave when_iso empty and it becomes a "Someday" reminder.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: str('What to remind them about, in their own words, e.g. "Call Raj"'),
        notes: str('Any extra detail they gave'),
        when_iso: str('The moment it is due, ISO 8601 with the offset, e.g. 2026-10-09T17:00:00+05:30. Leave empty for a reminder with no date.'),
        minutes_before: num('Warn this many minutes early. 0 unless they asked for it.'),
        delivery: { type: 'STRING', enum: ['notification', 'call'], description: 'notification = a normal alert. call = ring their phone and read it out. Only use call if they asked to be called.' },
        style: { type: 'STRING', enum: ['alarm', 'reminder', 'quiet'], description: 'alarm = loud, for waking up or something critical. reminder = normal. quiet = no sound.' },
        repeat: { type: 'STRING', enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'] },
        ring_me_if_i_miss_it: { type: 'BOOLEAN', description: 'True only if they asked to be phoned when they do not respond.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'add_event',
    description:
      'Put something in the user\'s calendar: a meeting, appointment, trip or anything that occupies a block of time. Use add_reminder instead for a simple nudge that does not take up time.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: str('What the event is, e.g. "Dentist"'),
        starts_iso: str('When it starts, ISO 8601 with the offset'),
        ends_iso: str('When it finishes, ISO 8601. Leave empty for a one-hour default.'),
        all_day: { type: 'BOOLEAN', description: 'True for something that takes the whole day.' },
        location: str('Where it is'),
        notes: str('Any extra detail'),
        repeat: { type: 'STRING', enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'] },
      },
      required: ['title', 'starts_iso'],
    },
  },
  {
    name: 'list_upcoming',
    description:
      "Read back what the user has coming up: their reminders, their calendar, or both. Use it for \"what's on today?\", \"what do I have tomorrow?\", \"what are my reminders?\".",
    parameters: {
      type: 'OBJECT',
      properties: {
        what: { type: 'STRING', enum: ['reminders', 'events', 'both'] },
        days_ahead: num('How far to look. 1 = the rest of today, 2 = today and tomorrow. Default 7.'),
      },
    },
  },
];

export interface HubToolContext {
  getAccessToken?: () => Promise<string | null | undefined>;
  getUserId?: () => string | undefined;
  onAction?: (label: string) => void;
  /** Re-schedules the phone's own notifications after something changes. */
  onRemindersChanged?: () => void;
}

const asInt = (v: unknown, fallback: number, min: number, max: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

const REPEATS = ['none', 'daily', 'weekly', 'monthly', 'yearly'] as const;
const repeatOf = (v: unknown) => (REPEATS.includes(v as never) ? (v as ReminderDraft['recurrence']) : 'none');

/** A moment the user actually meant: real, and not in the past. */
function momentFrom(value: unknown): { ok: true; iso: string } | { ok: false; error: string } | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return { ok: false, error: 'That date and time could not be understood. Ask the user to say it again.' };
  if (at.getTime() < Date.now() - 60_000) {
    return { ok: false, error: `That time has already passed (now is ${new Date().toISOString()}). Work out the next one they meant, or ask them.` };
  }
  return { ok: true, iso: at.toISOString() };
}

const friendly = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export async function runHubTool(
  name: string,
  a: Record<string, unknown>,
  ctx: HubToolContext,
): Promise<Record<string, unknown> | null> {
  if (!HUB_FUNCTION_DECLARATIONS.some((d) => d.name === name)) return null;

  const token = await ctx.getAccessToken?.();
  const userId = ctx.getUserId?.();
  if (!token || !userId) return { ok: false, error: 'The user needs to log in again.' };

  switch (name) {
    case 'add_reminder': {
      const title = String(a.title ?? '').trim();
      if (title.length < 2) return { ok: false, error: 'Ask the user what the reminder should say.' };

      const when = momentFrom(a.when_iso);
      if (when && !when.ok) return { ok: false, error: when.error };

      const delivery: ReminderDelivery = a.delivery === 'call' ? 'call' : 'notification';
      const style: ReminderStyle = a.style === 'alarm' || a.style === 'quiet' ? a.style : 'reminder';

      // A reminder that rings the phone, or escalates to one, has to know which number.
      const wantsCall = delivery === 'call' || a.ring_me_if_i_miss_it === true;
      let phone: string | null = null;
      if (wantsCall) {
        const own = String(a.phone ?? '').trim();
        if (own) {
          const checked = checkPhoneNumber(own);
          if (!checked.ok) return { ok: false, error: checked.reason };
          phone = checked.e164;
        }
      }

      const draft: ReminderDraft = {
        ...DEFAULT_DRAFT,
        title: title.slice(0, 200),
        notes: a.notes ? String(a.notes).slice(0, 2000) : null,
        due_at: when?.ok ? when.iso : null,
        lead_minutes: asInt(a.minutes_before, 0, 0, 20160),
        delivery,
        style,
        recurrence: repeatOf(a.repeat),
        escalate: a.ring_me_if_i_miss_it === true,
        escalate_phone: phone,
      };

      const saved = await createReminder(token, userId, draft);
      ctx.onRemindersChanged?.();
      ctx.onAction?.(`Reminder set: ${title}`);
      return {
        ok: true,
        reminder_id: saved.id,
        when: saved.due_at ? friendly(saved.due_at) : null,
        note: saved.due_at
          ? `Tell the user briefly that it is set for ${friendly(saved.due_at)}.${draft.escalate ? ' Mention that you will ring them if they do not respond.' : ''}`
          : 'There was no date, so it is saved under Someday. Tell them they can add a time later.',
      };
    }

    case 'add_event': {
      const title = String(a.title ?? '').trim();
      if (title.length < 2) return { ok: false, error: 'Ask the user what the event is called.' };
      const starts = momentFrom(a.starts_iso);
      if (!starts) return { ok: false, error: 'Ask the user when it starts.' };
      if (!starts.ok) return { ok: false, error: starts.error };

      const ends = momentFrom(a.ends_iso);
      if (ends && !ends.ok) return { ok: false, error: ends.error };
      if (ends?.ok && new Date(ends.iso) < new Date(starts.iso)) {
        return { ok: false, error: 'The finish time is before the start. Ask the user which they meant.' };
      }

      const draft: EventDraft = {
        title: title.slice(0, 200),
        notes: a.notes ? String(a.notes).slice(0, 2000) : null,
        location: a.location ? String(a.location).slice(0, 300) : null,
        starts_at: starts.iso,
        // An appointment with no stated finish is assumed to last an hour.
        ends_at: ends?.ok ? ends.iso : new Date(new Date(starts.iso).getTime() + 3600_000).toISOString(),
        all_day: a.all_day === true,
        recurrence: repeatOf(a.repeat),
        recurrence_until: null,
      };

      const saved = await createEvent(token, userId, draft);
      ctx.onAction?.(`Added to calendar: ${title}`);
      return { ok: true, event_id: saved.id, when: friendly(saved.starts_at), note: `Tell the user it is in their calendar for ${friendly(saved.starts_at)}.` };
    }

    case 'list_upcoming': {
      const what = a.what === 'reminders' || a.what === 'events' ? a.what : 'both';
      const days = asInt(a.days_ahead, 7, 1, 60);
      const until = new Date(Date.now() + days * 86_400_000);

      const result: Record<string, unknown> = { timezone: deviceTimezone(), looked_ahead_days: days };

      if (what !== 'events') {
        const all = await listReminders(token);
        const soon = all
          .filter((r: Reminder) => r.status === 'pending' && r.due_at && new Date(r.due_at) <= until)
          .sort((x, y) => String(x.due_at).localeCompare(String(y.due_at)))
          .slice(0, 10);
        result.reminders = soon.map((r) => ({ title: r.title, when: friendly(r.due_at as string), delivery: r.delivery }));
        result.someday_count = all.filter((r) => r.status === 'pending' && !r.due_at).length;
      }

      if (what !== 'reminders') {
        const events = await listEvents(token, new Date(), until);
        result.events = events.slice(0, 10).map((e) => ({ title: e.title, when: friendly(e.starts_at), location: e.location }));
      }

      result.note = 'Read out only the next few, briefly. Do not list everything unless asked.';
      return { ok: true, ...result };
    }

    default:
      return null;
  }
}
