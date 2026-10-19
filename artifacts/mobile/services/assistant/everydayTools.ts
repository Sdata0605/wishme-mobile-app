/**
 * Everyday tools ported from MyAssistant (2026-10-19): weather, currency, promises, the shopping list and standing rules.
 *
 * What each one honestly does:
 *  - get_weather and convert_currency read keyless public sources (Open-Meteo, Frankfurter) and say so; they never guess;
 *  - promises are what the user said THEY would do, noted only when they said it, ticked off only when they say so;
 *  - the shopping list is one list on the account, also shown on the Shopping list screen;
 *  - standing rules are lasting instructions about how the assistant behaves, given to it in every conversation.
 */

import { Linking } from 'react-native';
import { findCity, wherever } from '@/services/home/weather';
import { addItems, clearItems, listItems, removeItems, setDone } from '@/services/hub/shopping';
import { currencyCode, describeWeather, dueFrom, dueWords, listText, matchByWords, money, parseItems } from './everyday';
import type { MoreToolContext } from './moreTools';
import { addPromise, listOpenPromises, setPromiseStatus } from './promises';
import { addRule, removeRules } from './rules';

const str = (description: string) => ({ type: 'STRING', description });
const num = (description: string) => ({ type: 'NUMBER', description });

export const EVERYDAY_FUNCTION_DECLARATIONS = [
  // ── Weather and money ────────────────────────────────────────────────
  {
    name: 'get_weather',
    description:
      'Current weather and the next three days for a city or the user\'s own area. Use it whenever the user asks about weather, rain, temperature, umbrella or what to wear. Prefer it over web_search for weather.',
    parameters: { type: 'OBJECT', properties: { location: str('City name. Leave empty for where the user is.') } },
  },
  {
    name: 'convert_currency',
    description: 'Convert an amount between currencies at today\'s rate ("how much is 50 dollars in rupees", "1 euro to INR").',
    parameters: {
      type: 'OBJECT',
      properties: { amount: num('The amount, default 1'), from: str('Currency to convert from: a 3-letter code (USD) or a word (dollars)'), to: str('Currency to convert to, default INR') },
      required: ['from'],
    },
  },
  // ── Promises ─────────────────────────────────────────────────────────
  {
    name: 'note_promise',
    description:
      'Note something the USER promised to do ("I\'ll send Ravi the proposal by Friday", "tell her I\'ll call back tomorrow"). Only a first-person, specific, future promise the user made in this conversation; never a musing, a question, or what someone else promised. Do it quietly and say only "Noted." For a time-based nudge the user asks for, use add_reminder as well.',
    parameters: {
      type: 'OBJECT',
      properties: {
        what: str('The promise as a short task, e.g. "Send Ravi the proposal"'),
        owed_to: str('Who it was promised to, if anyone'),
        due: str('When it is due, ISO date or date-time, if they said'),
        quote: str('The user\'s own words'),
      },
      required: ['what'],
    },
  },
  {
    name: 'list_my_promises',
    description: 'What the user has promised to do and not done yet. Use for "what did I promise", "what do I owe people", "anything pending", "what did I say I would do".',
  },
  {
    name: 'complete_promise',
    description: 'Mark a promise done when the user says they did it ("I sent Ravi the proposal", "done with the GST filing"). Pass cancel=true when they say it is no longer needed.',
    parameters: { type: 'OBJECT', properties: { which: str('Words that identify it, e.g. "proposal Ravi"'), cancel: { type: 'BOOLEAN', description: 'True when it is called off rather than done' } }, required: ['which'] },
  },
  // ── Shopping list ────────────────────────────────────────────────────
  {
    name: 'shopping_list_add',
    description: 'Add things to the user\'s shopping list ("add milk and eggs", "put 2 kg rice on the list"). One call can add several items.',
    parameters: { type: 'OBJECT', properties: { items: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Each item with its quantity if said, e.g. "2 kg rice"' } }, required: ['items'] },
  },
  { name: 'shopping_list_show', description: 'Read out the shopping list and open it on screen ("what is on my list", "show my shopping list").' },
  {
    name: 'shopping_list_check',
    description: 'Tick items off as bought ("I bought the milk", "got eggs and bread").',
    parameters: { type: 'OBJECT', properties: { items: { type: 'ARRAY', items: { type: 'STRING' }, description: 'The items bought' } }, required: ['items'] },
  },
  {
    name: 'shopping_list_remove',
    description: 'Take items off the list without buying them ("remove the eggs", "no need for sugar").',
    parameters: { type: 'OBJECT', properties: { items: { type: 'ARRAY', items: { type: 'STRING' }, description: 'The items to remove' } }, required: ['items'] },
  },
  {
    name: 'shopping_list_clear',
    description: 'Clear the bought items from the list, or with everything=true the whole list. Clearing everything needs the user\'s yes first: ask, then call with user_confirmed=true.',
    parameters: { type: 'OBJECT', properties: { everything: { type: 'BOOLEAN', description: 'True to empty the whole list' }, user_confirmed: { type: 'BOOLEAN', description: 'True only after the user said yes' } } },
  },
  {
    name: 'share_shopping_list',
    description: 'Open WhatsApp with the shopping list written out, so the user can send it to someone ("send my list to my wife"). The user picks the chat and taps send.',
  },
  // ── Standing rules ───────────────────────────────────────────────────
  {
    name: 'add_standing_rule',
    description:
      'Save a PERMANENT rule for how YOU behave: "always ask before sending messages", "never call anyone after 10 pm", "keep answers short", "call me by my first name". Only for a lasting instruction about your behaviour, not a one-off request and not a fact about the user (use remember_fact for that).',
    parameters: { type: 'OBJECT', properties: { rule: str('The rule, close to the user\'s words') }, required: ['rule'] },
  },
  {
    name: 'remove_standing_rule',
    description: 'Remove a rule the user cancels ("you don\'t need to ask before reminders any more").',
    parameters: { type: 'OBJECT', properties: { about: str('Words that identify the rule') }, required: ['about'] },
  },
];

const NAMES = new Set(EVERYDAY_FUNCTION_DECLARATIONS.map((d) => d.name));

const signedOut = { ok: false, error: 'The user needs to log in again.' };

const names = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : typeof v === 'string' ? [v] : []);

export async function runEverydayTool(name: string, a: Record<string, unknown>, ctx: MoreToolContext & { openShoppingList?: () => void }): Promise<Record<string, unknown> | null> {
  if (!NAMES.has(name)) return null;
  const token = await ctx.getAccessToken?.();

  switch (name) {
    // ── Weather ────────────────────────────────────────────────────────
    case 'get_weather': {
      const asked = String(a.location ?? '').trim();
      ctx.onAction?.(asked ? `Checking the weather in ${asked}` : 'Checking the weather');
      let place: { latitude: number; longitude: number; name: string } | null = null;
      if (asked) {
        const p = await findCity(asked);
        if (!p) return { ok: false, error: `No place called "${asked}" was found.`, instruction: 'Say you could not find that place and ask which city they mean.' };
        place = { latitude: p.latitude, longitude: p.longitude, name: [p.name, p.admin1, p.country].filter(Boolean).join(', ') };
      } else {
        const here = await wherever(token);
        if (!here) return { ok: false, error: 'The location is not available.', instruction: 'Say you do not know where they are, and ask which city.' };
        place = { latitude: here.latitude, longitude: here.longitude, name: here.city || 'your area' };
      }
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
          '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code' +
          '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=3',
      ).catch(() => null);
      if (!res?.ok) return { ok: false, error: 'The weather service did not answer.', instruction: 'Say the weather could not be checked right now. Do not guess it.' };
      const j = (await res.json()) as {
        current?: { temperature_2m?: number; apparent_temperature?: number; relative_humidity_2m?: number; wind_speed_10m?: number; weather_code?: number };
        daily?: { time?: string[]; weather_code?: number[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: number[] };
      };
      const c = j.current;
      if (c?.temperature_2m == null) return { ok: false, error: 'No weather came back.', instruction: 'Say the weather could not be checked right now. Do not guess it.' };
      const d = j.daily ?? {};
      const days = (d.time ?? []).map((date, i) => ({
        date,
        sky: describeWeather(d.weather_code?.[i] ?? -1),
        high_c: Math.round(d.temperature_2m_max?.[i] ?? NaN),
        low_c: Math.round(d.temperature_2m_min?.[i] ?? NaN),
        chance_of_rain: `${Math.round(d.precipitation_probability_max?.[i] ?? 0)}%`,
      }));
      return {
        ok: true,
        place: place.name,
        now: {
          sky: describeWeather(c.weather_code ?? -1),
          temp_c: Math.round(c.temperature_2m),
          feels_like_c: Math.round(c.apparent_temperature ?? c.temperature_2m),
          humidity: `${Math.round(c.relative_humidity_2m ?? 0)}%`,
          wind_kmh: Math.round(c.wind_speed_10m ?? 0),
        },
        days,
        source: 'Open-Meteo',
        instruction: 'Answer what they asked in one or two short sentences (now, today or the day they asked about). Mention rain only if it matters.',
      };
    }

    // ── Currency ───────────────────────────────────────────────────────
    case 'convert_currency': {
      const from = currencyCode(a.from);
      const to = currencyCode(a.to ?? 'INR');
      const amount = Number(a.amount ?? 1);
      if (!from || !to) return { ok: false, error: 'Unknown currency.', instruction: 'Ask which currency they mean.' };
      if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'No amount.', instruction: 'Ask how much to convert.' };
      if (from === to) return { ok: true, result: `${money(amount, to)} ${to}` };
      ctx.onAction?.(`Converting ${from} to ${to}`);
      const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`).catch(() => null);
      const j = res?.ok ? ((await res.json()) as { date?: string; rates?: Record<string, number> }) : null;
      const rate = j?.rates?.[to];
      if (!rate) return { ok: false, error: `No rate for ${from} to ${to}.`, instruction: 'Say the rate could not be found right now. Do not guess it.' };
      return {
        ok: true,
        result: `${money(amount, from)} ${from} = ${money(amount * rate, to)} ${to}`,
        rate: `1 ${from} = ${money(rate, to)} ${to}`,
        as_of: j?.date,
        source: 'European Central Bank reference rate (Frankfurter)',
        instruction: 'Say the converted amount in one sentence. Mention it is the reference rate and banks charge a little more.',
      };
    }

    // ── Promises ───────────────────────────────────────────────────────
    case 'note_promise': {
      if (!token) return signedOut;
      const text = String(a.what ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
      if (text.length < 2) return { ok: false, error: 'Ask what they promised.' };
      const due = dueFrom(a.due);
      const owed = String(a.owed_to ?? '').trim().slice(0, 80);
      const open = await listOpenPromises(token, 100);
      if (open.some((p) => p.text.toLowerCase() === text.toLowerCase())) return { ok: true, duplicate: true, instruction: 'It is already on their list. Say "Noted." only.' };
      await addPromise(token, { text, owed_to: owed, due_at: due?.toISOString() ?? null, quote: String(a.quote ?? '').slice(0, 300) });
      ctx.onAction?.('Noting your promise');
      return { ok: true, noted: text, owed_to: owed || undefined, due: due ? dueWords(due.toISOString()) : undefined, instruction: 'Say only "Noted." or similar, in a few words.' };
    }
    case 'list_my_promises': {
      if (!token) return signedOut;
      const open = await listOpenPromises(token, 20);
      if (!open.length) return { ok: true, promises: [], instruction: 'Say there is nothing outstanding.' };
      return {
        ok: true,
        count: open.length,
        promises: open.slice(0, 8).map((p) => ({ what: p.text, to: p.owed_to || undefined, when: dueWords(p.due_at) || undefined })),
        instruction: 'Say how many are open, then the first few in natural sentences, overdue ones first. Offer to tick one off.',
      };
    }
    case 'complete_promise': {
      if (!token) return signedOut;
      const open = await listOpenPromises(token, 100);
      const hits = matchByWords(open, String(a.which ?? ''), (p) => `${p.text} ${p.owed_to}`);
      if (!hits.length) return { ok: false, error: 'Nothing open matches.', open: open.slice(0, 6).map((p) => p.text), instruction: 'Say you could not find that promise; if the list is short, read it and ask which one. Do not pretend it was ticked off.' };
      if (hits.length > 1) return { ok: false, error: 'More than one matches.', choices: hits.slice(0, 5).map((p) => p.text), instruction: 'Ask which of these they mean.' };
      await setPromiseStatus(token, hits[0].id, a.cancel === true ? 'cancelled' : 'done');
      ctx.onAction?.('Ticking that off');
      return { ok: true, done: hits[0].text, instruction: a.cancel === true ? 'Say in a few words that it is off the list.' : 'Say in a few words that it is ticked off.' };
    }

    // ── Shopping list ──────────────────────────────────────────────────
    case 'shopping_list_add': {
      if (!token) return signedOut;
      const drafts = parseItems(a.items);
      if (!drafts.length) return { ok: false, error: 'Ask what to add.' };
      const r = await addItems(token, drafts);
      ctx.onAction?.('Updating your shopping list');
      return { ok: true, added: r.added, already_on_list: r.already, instruction: 'Say in a few words what was added (and what was already there). Do not read the whole list.' };
    }
    case 'shopping_list_show': {
      if (!token) return signedOut;
      const items = await listItems(token);
      ctx.openShoppingList?.();
      const open = items.filter((i) => !i.done);
      if (!open.length) return { ok: true, items: [], instruction: 'Say the list is empty, and offer to add something.' };
      return { ok: true, count: open.length, items: open.map((i) => (i.quantity ? `${i.name} (${i.quantity})` : i.name)), bought: items.filter((i) => i.done).length, instruction: 'Read the items naturally, briefly. It is also on the screen.' };
    }
    case 'shopping_list_check':
    case 'shopping_list_remove': {
      if (!token) return signedOut;
      const items = await listItems(token);
      const found: string[] = [];
      const missing: string[] = [];
      const ids: string[] = [];
      for (const want of names(a.items).flatMap((s) => parseItems(s).map((d) => d.name))) {
        const hit = items.find((i) => i.name.toLowerCase() === want.toLowerCase()) ?? matchByWords(items, want, (i) => i.name)[0];
        if (hit && !ids.includes(hit.id)) {
          ids.push(hit.id);
          found.push(hit.name);
        } else if (!hit) missing.push(want);
      }
      if (!ids.length) return { ok: false, error: 'None of those are on the list.', instruction: 'Say they are not on the list.' };
      if (name === 'shopping_list_check') await setDone(token, ids, true);
      else await removeItems(token, ids);
      ctx.onAction?.('Updating your shopping list');
      return { ok: true, [name === 'shopping_list_check' ? 'ticked' : 'removed']: found, not_on_list: missing, instruction: 'Confirm in a few words.' };
    }
    case 'shopping_list_clear': {
      if (!token) return signedOut;
      const all = a.everything === true;
      if (all && a.user_confirmed !== true) return { ok: false, needs_confirmation: true, instruction: 'Ask: "Clear the whole shopping list?" Call again with user_confirmed=true only after they say yes.' };
      await clearItems(token, all);
      ctx.onAction?.('Clearing your shopping list');
      return { ok: true, cleared: all ? 'everything' : 'the bought items', instruction: 'Confirm in a few words.' };
    }
    case 'share_shopping_list': {
      if (!token) return signedOut;
      const text = listText(await listItems(token));
      if (!text) return { ok: false, error: 'The list is empty.', instruction: 'Say there is nothing on the list to send.' };
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      if (ctx.openAfterReply) ctx.openAfterReply(url, 'your shopping list', '[The user is back from WhatsApp, where you put their shopping list. Same conversation, do not greet. In one short sentence ask if it went. Then wait.]');
      else await Linking.openURL(url).catch(() => {});
      return { ok: true, note: 'WhatsApp opens with the list written; the user picks the chat and taps send.', instruction: 'Say in one sentence that WhatsApp is opening with the list, and they pick who to send it to.' };
    }

    // ── Standing rules ─────────────────────────────────────────────────
    case 'add_standing_rule': {
      if (!token) return signedOut;
      const rule = String(a.rule ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
      if (rule.length < 3) return { ok: false, error: 'Ask what the rule is.' };
      const r = await addRule(token, rule);
      ctx.onAction?.('Saving that rule');
      return { ok: true, saved: rule, instruction: r.duplicate ? 'You already had that rule. Say so in a few words.' : 'Say in a few words that you will always do that, starting now.' };
    }
    case 'remove_standing_rule': {
      if (!token) return signedOut;
      const gone = await removeRules(token, String(a.about ?? ''));
      if (!gone.length) return { ok: false, error: 'No rule matches.', instruction: 'Say you had no rule like that.' };
      return { ok: true, removed: gone.map((r) => r.text), instruction: 'Say in a few words that the rule is gone.' };
    }
  }
  return null;
}
