/**
 * The assistant's everyday tools that MyAssistant has and WishMe was missing (see Wish-Me/Assistant-capability-gap.md):
 * alarms and timers, WhatsApp and email drafts, maps and navigation, reading a web page, changing or deleting reminders and
 * calendar events, and memory.
 *
 * What each one honestly does:
 *  - alarms and timers go to the phone's own clock app; if the phone refuses (this build lacks the alarm permission, or the
 *    clock app does not support it) a loud WishMe reminder is set instead, and the assistant says which;
 *  - WhatsApp and email open the app with the message written and ready: the user taps send. The assistant never sends one by
 *    itself, and says so;
 *  - maps and navigation open Google Maps.
 */

import { Linking, Platform } from 'react-native';
import { deleteEvent, listEvents, updateEvent, type CalendarEvent } from '@/services/hub/calendar';
import { createReminder, DEFAULT_DRAFT, deleteReminder, listReminders, setReminderDone, updateReminder, type Reminder } from '@/services/hub/reminders';
import { forgetMemories, recallMemories, rememberFact } from './memory';
import { findContacts, launchActivity } from './phone';
import { describeHits, searchMemory } from './recall';

const str = (description: string) => ({ type: 'STRING', description });
const num = (description: string) => ({ type: 'NUMBER', description });

export const MORE_FUNCTION_DECLARATIONS = [
  {
    name: 'set_alarm',
    description:
      'Set a real alarm in the phone\'s clock app ("wake me at 5:30", "set an alarm for 7"). Pass the time as 24-hour hour and minute. For a one-off nudge that is not about waking up use add_reminder instead.',
    parameters: {
      type: 'OBJECT',
      properties: {
        hour: num('Hour, 0 to 23'),
        minute: num('Minute, 0 to 59'),
        label: str('What the alarm is for, e.g. "Gym"'),
        days: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Only for a repeating alarm: mon, tue, wed, thu, fri, sat, sun. Leave empty for the next time that hour comes.' },
      },
      required: ['hour', 'minute'],
    },
  },
  {
    name: 'set_timer',
    description: 'Start a countdown timer in the phone\'s clock app ("set a timer for ten minutes", "tell me when 20 minutes are up").',
    parameters: {
      type: 'OBJECT',
      properties: { seconds: num('Length in seconds: 10 minutes is 600'), label: str('Optional name, e.g. "Pasta"') },
      required: ['seconds'],
    },
  },
  { name: 'show_alarms', description: 'Open the phone\'s clock app so the user can see their alarms and timers ("show my alarms").' },
  { name: 'stop_alarm', description: 'Turn off the alarm that is ringing, or the next one ("stop the alarm", "switch off my alarm").' },
  {
    name: 'snooze_alarm',
    description: 'Snooze the alarm that is ringing right now ("snooze", "five more minutes").',
    parameters: { type: 'OBJECT', properties: { minutes: num('How long, default 10') } },
  },
  { name: 'stop_timer', description: 'Stop or cancel the running countdown timer ("stop the timer").' },
  {
    name: 'send_whatsapp_message',
    description:
      'Write a WhatsApp message and open WhatsApp with it ready to send. You CANNOT send it yourself: the user taps send, and you must say so. Pass a contact name (looked up in their contacts) or a phone number.',
    parameters: {
      type: 'OBJECT',
      properties: { to: str('A contact name, or a phone number'), message: str('The message, written the way the user would say it') },
      required: ['to', 'message'],
    },
  },
  {
    name: 'send_email',
    description: 'Write an email and open the mail app with it ready to send. You CANNOT send it yourself: the user taps send, and you must say so.',
    parameters: {
      type: 'OBJECT',
      properties: { to: str('The email address, if the user gave one'), subject: str('Subject line'), body: str('The email text') },
      required: ['body'],
    },
  },
  {
    name: 'find_places_nearby',
    description: 'Show places near the user on the map ("petrol pump near me", "best biryani nearby", "ATM", "chemist").',
    parameters: { type: 'OBJECT', properties: { query: str('What to look for, e.g. "pharmacy"') }, required: ['query'] },
  },
  {
    name: 'start_navigation',
    description: 'Start turn-by-turn navigation to a place in Google Maps ("take me to the airport", "navigate to Dadar station").',
    parameters: {
      type: 'OBJECT',
      properties: {
        destination: str('Where to, as the user said it'),
        mode: { type: 'STRING', enum: ['drive', 'walk', 'bike', 'transit'], description: 'Default drive' },
      },
      required: ['destination'],
    },
  },
  {
    name: 'read_webpage',
    description:
      'Read the text of ONE web page the user named or you found (a news story, an article, a product page) so you can summarise it or answer from it. Pass the full address. For finding things out use web_search instead.',
    parameters: { type: 'OBJECT', properties: { url: str('The full web address, https://...') }, required: ['url'] },
  },
  {
    name: 'update_reminder',
    description: 'Change an existing reminder, or tick it off ("move my dentist reminder to Friday 5pm", "rename it", "mark it done"). Say which one by words from its title.',
    parameters: {
      type: 'OBJECT',
      properties: {
        which: str('Words from the reminder\'s title, e.g. "dentist"'),
        new_title: str('A new title, only if they asked to rename it'),
        when_iso: str('The new due time, ISO 8601 with offset, only if they asked to move it'),
        done: { type: 'BOOLEAN', description: 'True to tick it off as done' },
      },
      required: ['which'],
    },
  },
  {
    name: 'delete_reminder',
    description: 'Delete a reminder ("cancel my dentist reminder", "delete it"). Say which one by words from its title.',
    parameters: { type: 'OBJECT', properties: { which: str('Words from the reminder\'s title') }, required: ['which'] },
  },
  {
    name: 'update_event',
    description: 'Change a calendar event: move it, rename it or change the place ("move the meeting with Raj to 5pm").',
    parameters: {
      type: 'OBJECT',
      properties: {
        which: str('Words from the event\'s title'),
        new_title: str('New title'),
        starts_iso: str('New start, ISO 8601 with offset'),
        ends_iso: str('New end, ISO 8601 with offset (the length is kept if only the start is given)'),
        location: str('New place'),
      },
      required: ['which'],
    },
  },
  {
    name: 'delete_event',
    description: 'Delete a calendar event ("cancel the meeting with Raj"). Say which one by words from its title.',
    parameters: { type: 'OBJECT', properties: { which: str('Words from the event\'s title') }, required: ['which'] },
  },
  {
    name: 'remember_fact',
    description:
      'Remember something about the user or the people in their life for future conversations: a name and relationship, a birthday, a preference, an allergy, a habit ("my sister is Anita", "I am vegetarian", "I take my medicine at 8"). Use it when they say "remember…" and also when they share something lasting about themselves. Never store passwords, OTPs or card numbers.',
    parameters: {
      type: 'OBJECT',
      properties: { subject: str('Who or what it is about: "Anita (sister)", "the user", "Dr Sharma"'), fact: str('The fact, in a short sentence') },
      required: ['subject', 'fact'],
    },
  },
  {
    name: 'recall_memory',
    description: 'Look up what you remember about a person or a topic ("what do you know about Anita?", "what is my wife\'s name?"). Pass nothing to get the latest memories.',
    parameters: { type: 'OBJECT', properties: { query: str('A name or topic') } },
  },
  {
    name: 'recall_past',
    description:
      'Look up what was said earlier, word for word, in past conversations with you and in the AI phone calls you made for the user. Use it whenever the user asks about something said before: "what did Rahul say when we called him four days ago?", "what did I tell you about the sister wedding?", "what was the plan we talked about yesterday?". Pass the name of the person when there is one, how many days ago when they say when (4 for "four days ago", 1 for yesterday, 7 for last week), and the topic in a few words. It also returns the saved facts about that person or topic.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: str('The topic in a few words, e.g. "loan repayment" or "sister wedding". Leave empty to just get the conversations with that person or on that day.'),
        person: str('The name of a person, if the question is about someone'),
        days_ago: num('About how many days ago, if the user said when (0 today, 1 yesterday)'),
      },
    },
  },
  {
    name: 'forget_memory',
    description: 'Forget something you remember, when the user says it is wrong or asks you to forget it ("forget Anita\'s birthday").',
    parameters: { type: 'OBJECT', properties: { query: str('Words that identify what to forget') }, required: ['query'] },
  },
];

export interface MoreToolContext {
  getAccessToken?: () => Promise<string | null | undefined>;
  getUserId?: () => string | undefined;
  onAction?: (label: string) => void;
  onRemindersChanged?: () => void;
  /** Opens a link once the assistant has finished its sentence, and picks the conversation up when the user returns. */
  openAfterReply?: (url: string, subject: string, backNote?: string) => void;
}

// ─── Small pure helpers (checked in scripts/moreTools.selfcheck.ts) ───────────

/** "9876543210" and "+91 98765 43210" and "098765 43210" all become 919876543210 (the form wa.me wants). */
export function whatsappNumber(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

export const whatsappUrl = (number: string, message: string) => `https://wa.me/${number}?text=${encodeURIComponent(message)}`;

export const mailtoUrl = (to: string, subject: string, body: string) =>
  `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

const DAY_NUMBER: Record<string, number> = { sun: 1, mon: 2, tue: 3, wed: 4, thu: 5, fri: 6, sat: 7 };

/** Android's alarm "days" extra: Sunday is 1 ... Saturday is 7. */
export function alarmDays(days: unknown): number[] {
  if (!Array.isArray(days)) return [];
  return [...new Set(days.map((d) => DAY_NUMBER[String(d).slice(0, 3).toLowerCase()]).filter(Boolean))];
}

/** The next moment that hour and minute come round (today if still ahead, otherwise tomorrow). */
export function nextOccurrence(hour: number, minute: number, from = new Date()): Date {
  const d = new Date(from);
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= from.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

export function mapsSearchUrl(query: string) {
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
}

export function navigationUrl(destination: string, mode: string) {
  const m = mode === 'walk' ? 'w' : mode === 'bike' ? 'b' : mode === 'transit' ? 'r' : 'd';
  return `google.navigation:q=${encodeURIComponent(destination)}&mode=${m}`;
}

export function navigationWebUrl(destination: string, mode: string) {
  const m = mode === 'walk' ? 'walking' : mode === 'bike' ? 'bicycling' : mode === 'transit' ? 'transit' : 'driving';
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=${m}`;
}

/** Only public web pages are read: never a private network address or another scheme. */
export function readableUrl(raw: string): string | null {
  let u = raw.trim();
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = `https://${u}`;
  try {
    const url = new URL(u);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || !host.includes('.')) return null;
    if (/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(host) || host.startsWith('[')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** The readable text of an HTML page: no scripts, styles, menus or tags, short enough for the assistant to use. */
export function pageText(html: string, max = 6000): { title: string; text: string } {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim();
  const body = html
    .replace(/<(script|style|noscript|svg|nav|footer|header|form|iframe)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|h[1-6]|br|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    // A line of one or two words is usually a menu item or a button.
    .filter((l) => l.split(' ').length > 3)
    .join('\n');
  return { title, text: body.slice(0, max).trim() };
}

/** The items whose title contains every word of what the user said (case-insensitive); an exact title wins over a partial one. */
export function pickByTitle<T extends { title: string }>(items: T[], which: string): { match?: T; choices: T[] } {
  const w = which.toLowerCase().match(/[\p{L}\p{M}\p{N}]{2,}/gu) ?? [];
  if (!w.length) return { choices: [] };
  const hits = items.filter((i) => w.every((x) => i.title.toLowerCase().includes(x)));
  if (hits.length === 1) return { match: hits[0], choices: hits };
  const exact = hits.filter((i) => i.title.trim().toLowerCase() === which.trim().toLowerCase());
  if (exact.length === 1) return { match: exact[0], choices: hits };
  return { choices: hits };
}

const friendly = (iso: string) => new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const iso = (v: unknown) => {
  const d = new Date(String(v ?? ''));
  return Number.isNaN(d.getTime()) ? null : d;
};

const CLOCK = {
  alarm: 'android.intent.action.SET_ALARM',
  timer: 'android.intent.action.SET_TIMER',
  show: 'android.intent.action.SHOW_ALARMS',
  dismissAlarm: 'android.intent.action.DISMISS_ALARM',
  snooze: 'android.intent.action.SNOOZE_ALARM',
  dismissTimer: 'android.intent.action.DISMISS_TIMER',
};
const X = 'android.intent.extra.alarm.';

/** What to tell the model after a clock action: it only says "done" when the phone accepted it. */
const clockResult = (ok: boolean, done: string, failed: string) =>
  ok ? { ok: true, note: done } : { ok: false, error: failed, instruction: `${failed} Say that plainly, in one sentence; do not claim it worked.` };

export async function runMoreTool(name: string, a: Record<string, unknown>, ctx: MoreToolContext): Promise<Record<string, unknown> | null> {
  if (!MORE_FUNCTION_DECLARATIONS.some((d) => d.name === name)) return null;
  const token = await ctx.getAccessToken?.();
  const userId = ctx.getUserId?.();

  switch (name) {
    // ── Alarms and timers ───────────────────────────────────────────────────
    case 'set_alarm': {
      const hour = Math.round(Number(a.hour));
      const minute = Math.round(Number(a.minute));
      if (!(hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59)) return { ok: false, error: 'Ask the user for the time.' };
      const label = String(a.label ?? '').trim().slice(0, 60);
      const days = alarmDays(a.days);
      const when = nextOccurrence(hour, minute);
      const spoken = `${String(hour % 12 || 12)}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
      ctx.onAction?.(`Setting an alarm for ${spoken}`);

      let landed = false;
      if (Platform.OS === 'android') {
        landed = (await launchActivity(CLOCK.alarm, {
          extra: { [`${X}HOUR`]: hour, [`${X}MINUTES`]: minute, [`${X}MESSAGE`]: label || 'WishMe alarm', [`${X}SKIP_UI`]: true, ...(days.length ? { [`${X}DAYS`]: days } : {}) },
        })) === 'launched';
      }
      if (landed) return { ok: true, in: 'the phone clock', note: `The alarm is set in the phone's clock app for ${spoken}${days.length ? ' on those days' : ''}. Tell the user in one short sentence.` };

      // The phone would not take it: a loud WishMe reminder is the next best thing, and the user is told.
      if (token && userId) {
        await createReminder(token, userId, { ...DEFAULT_DRAFT, title: label || 'Alarm', due_at: when.toISOString(), style: 'alarm' });
        ctx.onRemindersChanged?.();
        return { ok: true, in: 'WishMe', note: `The phone's clock would not take the alarm, so a loud WishMe alarm is set for ${friendly(when.toISOString())} instead. Tell the user exactly that in one sentence: it is a WishMe alarm, not in the clock app.` };
      }
      return clockResult(false, '', "The alarm could not be set.");
    }

    case 'set_timer': {
      const seconds = Math.round(Number(a.seconds));
      if (!(seconds >= 5 && seconds <= 86_400)) return { ok: false, error: 'Ask the user how long the timer should run.' };
      const label = String(a.label ?? '').trim().slice(0, 60);
      ctx.onAction?.('Starting a timer');
      let landed = false;
      if (Platform.OS === 'android') {
        landed = (await launchActivity(CLOCK.timer, { extra: { [`${X}LENGTH`]: seconds, [`${X}MESSAGE`]: label || 'WishMe timer', [`${X}SKIP_UI`]: true } })) === 'launched';
      }
      if (landed) return { ok: true, in: 'the phone clock', note: `The timer is running in the phone's clock app. Tell the user in one short sentence.` };
      if (token && userId) {
        await createReminder(token, userId, { ...DEFAULT_DRAFT, title: label ? `Timer: ${label}` : 'Timer is up', due_at: new Date(Date.now() + seconds * 1000).toISOString(), style: 'alarm' });
        ctx.onRemindersChanged?.();
        return { ok: true, in: 'WishMe', note: 'The phone\'s clock would not take the timer, so a WishMe alarm will go off when the time is up instead. Tell the user exactly that in one sentence.' };
      }
      return clockResult(false, '', 'The timer could not be started.');
    }

    case 'show_alarms': {
      const ok = Platform.OS === 'android' && (await launchActivity(CLOCK.show, {})) === 'launched';
      return clockResult(ok, "The phone's clock app is open on the alarms.", "The clock app could not be opened.");
    }
    case 'stop_alarm': {
      const ok = Platform.OS === 'android' && (await launchActivity(CLOCK.dismissAlarm, { extra: { [`${X}SEARCH_MODE`]: 'android.next' } })) === 'launched';
      return clockResult(ok, 'The alarm is switched off.', "The phone would not let me switch the alarm off from here; the user can tap stop on the alarm.");
    }
    case 'snooze_alarm': {
      const minutes = Math.min(60, Math.max(1, Math.round(Number(a.minutes) || 10)));
      const ok = Platform.OS === 'android' && (await launchActivity(CLOCK.snooze, { extra: { [`${X}ALARM_SNOOZE_DURATION`]: minutes } })) === 'launched';
      return clockResult(ok, `The alarm is snoozed for ${minutes} minutes.`, "The phone would not let me snooze the alarm from here; the user can tap snooze on the alarm.");
    }
    case 'stop_timer': {
      const ok = Platform.OS === 'android' && (await launchActivity(CLOCK.dismissTimer, {})) === 'launched';
      return clockResult(ok, 'The timer is stopped.', "The phone would not let me stop the timer from here; the user can stop it in the clock app.");
    }

    // ── WhatsApp and email: drafted, never sent ───────────────────────────
    case 'send_whatsapp_message': {
      const message = String(a.message ?? '').trim().slice(0, 1500);
      const to = String(a.to ?? '').trim();
      if (!message) return { ok: false, error: 'Ask the user what the message should say.' };
      if (!to) return { ok: false, error: 'Ask the user who it is for.' };

      let number = /\d{7,}/.test(to.replace(/[\s\-()]/g, '')) ? whatsappNumber(to) : null;
      let who = to;
      if (!number) {
        const found = await findContacts(to);
        if (found.permissionDenied) return { ok: false, error: found.error, instruction: 'Say that WishMe needs the contacts permission to find them, or ask the user to say the number.' };
        if (!found.matches.length) return { ok: false, error: `No contact called ${to} was found.`, instruction: 'Say no contact was found and ask the user to say the number.' };
        // The same person saved with two numbers is one contact; different people are a choice for the user.
        const names = [...new Set(found.matches.map((m) => m.name))];
        if (names.length > 1) return { ok: false, needs_choice: true, choices: names.slice(0, 4), instruction: 'Ask which of these they mean, then call again with that name.' };
        number = whatsappNumber(found.matches[0].number);
        who = found.matches[0].name;
      }
      if (!number) return { ok: false, error: 'That number does not look right.', instruction: 'Ask the user to say the number again.' };
      const url = whatsappUrl(number, message);
      ctx.onAction?.(`WhatsApp message for ${who}`);
      if (ctx.openAfterReply) ctx.openAfterReply(url, `your WhatsApp message to ${who}`, `[The user is back from WhatsApp, where you drafted a message to ${who}. Same conversation, do not greet. In one short sentence ask if they sent it or want to change it. Then wait.]`);
      else await Linking.openURL(url).catch(() => {});
      return { ok: true, drafted_for: who, instruction: `WhatsApp is opening with your message to ${who} written and ready. You have NOT sent it: say in one sentence that it is ready and they need to tap send. Do not say it was sent.` };
    }

    case 'send_email': {
      const body = String(a.body ?? '').trim().slice(0, 4000);
      if (!body) return { ok: false, error: 'Ask the user what the email should say.' };
      const to = String(a.to ?? '').trim();
      if (to && !/^\S+@\S+\.\S+$/.test(to)) return { ok: false, error: 'That is not an email address.', instruction: 'Ask the user to spell the email address.' };
      const url = mailtoUrl(to, String(a.subject ?? '').trim().slice(0, 200), body);
      ctx.onAction?.('Writing an email');
      if (ctx.openAfterReply) ctx.openAfterReply(url, 'your email', '[The user is back from the mail app, where you drafted an email. Same conversation, do not greet. In one short sentence ask if they sent it. Then wait.]');
      else await Linking.openURL(url).catch(() => {});
      return { ok: true, instruction: 'The mail app is opening with the email written. You have NOT sent it: say in one sentence that it is ready and they need to tap send.' };
    }

    // ── Maps ───────────────────────────────────────────────────────────────
    case 'find_places_nearby': {
      const query = String(a.query ?? '').replace(/\s+/g, ' ').trim().slice(0, 100);
      if (!query) return { ok: false, error: 'Ask what they want to find.' };
      const url = mapsSearchUrl(/\bnear(by| me)?\b/i.test(query) ? query : `${query} near me`);
      ctx.onAction?.(`Looking for ${query}`);
      if (ctx.openAfterReply) ctx.openAfterReply(url, query, `[The user is back from the map showing ${query}. Same conversation, do not greet. In one short sentence ask if they want directions to one. Then wait.]`);
      else await Linking.openURL(url).catch(() => {});
      return { ok: true, instruction: `Google Maps is opening with ${query} near the user. Say ONE short sentence that you have opened it. Do not name specific places: you have not seen the map.` };
    }

    case 'start_navigation': {
      const destination = String(a.destination ?? '').replace(/\s+/g, ' ').trim().slice(0, 150);
      if (!destination) return { ok: false, error: 'Ask where to.' };
      const mode = String(a.mode ?? 'drive');
      ctx.onAction?.(`Navigating to ${destination}`);
      const url = navigationUrl(destination, mode);
      const back = `[The user is back from navigation to ${destination}. Same conversation, do not greet. In one short sentence ask if they need anything else. Then wait.]`;
      if (ctx.openAfterReply) ctx.openAfterReply(url, `navigation to ${destination}`, back);
      else if (!(await Linking.openURL(url).then(() => true, () => false))) await Linking.openURL(navigationWebUrl(destination, mode)).catch(() => {});
      return { ok: true, instruction: `Navigation to ${destination} is starting in Google Maps. Say ONE short sentence that you are starting it.` };
    }

    // ── Reading a page ────────────────────────────────────────────────────
    case 'read_webpage': {
      const url = readableUrl(String(a.url ?? ''));
      if (!url) return { ok: false, error: 'That is not a web page I can read.', instruction: 'Say you cannot read that link and offer to search the web for it.' };
      ctx.onAction?.('Reading the page');
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36', Accept: 'text/html' }, signal: AbortSignal.timeout(9000) });
        if (!res.ok) return { ok: false, error: `The page answered ${res.status}.`, instruction: 'Say the page could not be opened, and offer to search the web for the story instead.' };
        const type = res.headers.get('content-type') ?? '';
        if (!/html|text/i.test(type)) return { ok: false, error: 'That link is not a web page.', instruction: 'Say that link is not an article you can read.' };
        const { title, text } = pageText(await res.text());
        if (text.length < 200) return { ok: false, error: 'The page has no readable text (it may need a login or a browser).', instruction: 'Say you could not read it, and offer to search the web for the story instead.' };
        return { ok: true, title, text, instruction: 'Answer from this text only. Summarise in a few spoken sentences unless asked for more. If it does not contain what was asked, say so.' };
      } catch {
        return { ok: false, error: 'The page could not be reached.', instruction: 'Say the page could not be reached, and offer to search the web for the story instead.' };
      }
    }

    // ── Changing reminders and events ──────────────────────────────────────
    case 'update_reminder':
    case 'delete_reminder': {
      if (!token) return { ok: false, error: 'The user needs to log in again.' };
      const which = String(a.which ?? '').trim();
      const { match, choices } = pickByTitle<Reminder>(await listReminders(token), which);
      if (!match) return choices.length ? { ok: false, needs_choice: true, choices: choices.slice(0, 5).map((r) => `${r.title}${r.due_at ? ` (${friendly(r.due_at)})` : ''}`), instruction: 'Ask which one they mean, then call again with more of its title.' } : { ok: false, error: `No reminder matching "${which}".`, instruction: 'Say you could not find that reminder.' };
      if (name === 'delete_reminder') {
        await deleteReminder(token, match.id);
        ctx.onRemindersChanged?.();
        return { ok: true, deleted: match.title, instruction: `Say in one sentence that "${match.title}" is deleted.` };
      }
      const patch: Record<string, unknown> = {};
      if (a.new_title) patch.title = String(a.new_title).trim().slice(0, 200);
      const due = a.when_iso ? iso(a.when_iso) : null;
      if (a.when_iso && !due) return { ok: false, error: 'That time could not be understood.', instruction: 'Ask the user to say the new time again.' };
      if (due) patch.due_at = due.toISOString();
      if (Object.keys(patch).length) await updateReminder(token, match.id, patch);
      if (a.done === true) await setReminderDone(token, match.id, true);
      if (!Object.keys(patch).length && a.done !== true) return { ok: false, error: 'Nothing to change was given.', instruction: 'Ask what to change about it.' };
      ctx.onRemindersChanged?.();
      return { ok: true, updated: match.title, instruction: `Say in one short sentence what you changed about "${match.title}"${due ? ` (now ${friendly(due.toISOString())})` : ''}.` };
    }

    case 'update_event':
    case 'delete_event': {
      if (!token) return { ok: false, error: 'The user needs to log in again.' };
      const which = String(a.which ?? '').trim();
      const events = await listEvents(token, new Date(Date.now() - 86_400_000), new Date(Date.now() + 180 * 86_400_000));
      const { match, choices } = pickByTitle<CalendarEvent>(events, which);
      if (!match) return choices.length ? { ok: false, needs_choice: true, choices: choices.slice(0, 5).map((e) => `${e.title} (${friendly(e.starts_at)})`), instruction: 'Ask which one they mean, then call again with more of its title.' } : { ok: false, error: `No event matching "${which}".`, instruction: 'Say you could not find that event.' };
      if (name === 'delete_event') {
        await deleteEvent(token, match.id);
        return { ok: true, deleted: match.title, instruction: `Say in one sentence that "${match.title}" is deleted from the calendar.` };
      }
      const patch: Record<string, unknown> = {};
      if (a.new_title) patch.title = String(a.new_title).trim().slice(0, 200);
      if (a.location) patch.location = String(a.location).trim().slice(0, 300);
      const start = a.starts_iso ? iso(a.starts_iso) : null;
      if (a.starts_iso && !start) return { ok: false, error: 'That time could not be understood.', instruction: 'Ask the user to say the new time again.' };
      if (start) {
        patch.starts_at = start.toISOString();
        const end = a.ends_iso ? iso(a.ends_iso) : null;
        // The length of the event is kept when only the start moves.
        const length = match.ends_at ? new Date(match.ends_at).getTime() - new Date(match.starts_at).getTime() : 3_600_000;
        patch.ends_at = (end ?? new Date(start.getTime() + length)).toISOString();
      }
      if (!Object.keys(patch).length) return { ok: false, error: 'Nothing to change was given.', instruction: 'Ask what to change about it.' };
      await updateEvent(token, match.id, patch);
      return { ok: true, updated: match.title, instruction: `Say in one short sentence what you changed about "${match.title}"${start ? ` (now ${friendly(start.toISOString())})` : ''}.` };
    }

    // ── Memory ────────────────────────────────────────────────────────────
    case 'remember_fact': {
      if (!token) return { ok: false, error: 'The user needs to log in again.' };
      const r = await rememberFact(token, a.subject, a.fact);
      if (!r.ok) return r;
      ctx.onAction?.('Remembering that');
      return { ok: true, saved: `${r.subject}: ${r.fact}`, instruction: r.duplicate ? 'You already knew this. Say so in a few words.' : 'Say in a few words that you will remember it. Do not repeat it back at length.' };
    }
    case 'recall_memory': {
      if (!token) return { ok: false, error: 'The user needs to log in again.' };
      const rows = await recallMemories(token, a.query);
      return rows.length
        ? { ok: true, memories: rows.map((m) => `${m.subject}: ${m.fact}`), instruction: 'Answer from these in natural sentences.' }
        : { ok: true, memories: [], instruction: 'You have nothing remembered about that. Say so, and offer to remember it if they tell you.' };
    }
    case 'recall_past': {
      if (!token) return { ok: false, error: 'The user needs to log in again.' };
      const daysAgo = Number(a.days_ago);
      try {
        const found = await searchMemory(token, {
          query: typeof a.query === 'string' ? a.query : undefined,
          person: typeof a.person === 'string' ? a.person : undefined,
          days_ago: a.days_ago !== undefined && a.days_ago !== null && a.days_ago !== '' && Number.isFinite(daysAgo) ? daysAgo : undefined,
          limit: 5,
        });
        ctx.onAction?.('Looking back');
        if (!found.results.length) {
          return { ok: true, found: [], instruction: 'Nothing was found for that. Say so honestly in one sentence and offer to look for it another way (a different name or day). Do not guess or invent what was said.' };
        }
        return {
          ok: true,
          found: describeHits(found.results),
          instruction:
            'These are the exact earlier records, newest relevant first. Answer the question from them: say what was actually said (quote the key words) and when, in natural speech. If they do not answer the question, say you found nothing about that. Never add details that are not in them.',
        };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'The lookup failed.', instruction: 'Say in one short sentence that you could not look it up right now, and offer to try again.' };
      }
    }
    case 'forget_memory': {
      if (!token) return { ok: false, error: 'The user needs to log in again.' };
      const { removed } = await forgetMemories(token, a.query);
      return removed.length
        ? { ok: true, forgot: removed.map((m) => `${m.subject}: ${m.fact}`), instruction: 'Say in one short sentence that you have forgotten it.' }
        : { ok: false, error: 'Nothing matched.', instruction: 'Say you could not find anything remembered about that.' };
    }
  }
  return null;
}

