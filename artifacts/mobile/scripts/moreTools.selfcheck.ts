/**
 * Self-check for the assistant's everyday tools (services/assistant/moreTools.ts) and its memory (memory.ts), with the phone,
 * the clock, the reminders store and the address book replaced by fakes (no network):
 *
 *   node --experimental-strip-types scripts/moreTools.selfcheck.ts
 */

import { register } from 'node:module';

const FAKES: Record<string, string> = {
  'react-native': `export const Platform = { OS: 'android' }; export const Linking = { openURL: async (u) => { (globalThis.__opened ??= []).push(u); } };`,
  '@/constants/supabase': `export async function supabaseFetch(path, init) { (globalThis.__requests ??= []).push({ path, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(init.body) : null }); const r = globalThis.__reply?.(path, init); return r ?? { ok: true, status: 200, json: async () => [] }; }`,
  '@/services/hub/calendar': `
    export async function listEvents() { return globalThis.__events ?? []; }
    export async function updateEvent(t, id, patch) { (globalThis.__calls ??= []).push(['updateEvent', id, patch]); }
    export async function deleteEvent(t, id) { (globalThis.__calls ??= []).push(['deleteEvent', id]); }`,
  '@/services/hub/reminders': `
    export const DEFAULT_DRAFT = { title: '', style: 'reminder', delivery: 'notification', recurrence: 'none' };
    export async function listReminders() { return globalThis.__reminders ?? []; }
    export async function createReminder(t, u, draft) { (globalThis.__calls ??= []).push(['createReminder', draft]); return { id: 'new', ...draft }; }
    export async function updateReminder(t, id, patch) { (globalThis.__calls ??= []).push(['updateReminder', id, patch]); }
    export async function deleteReminder(t, id) { (globalThis.__calls ??= []).push(['deleteReminder', id]); }
    export async function setReminderDone(t, id, done) { (globalThis.__calls ??= []).push(['setReminderDone', id, done]); }`,
  './recall': `
    export function describeHits(h) { return h.map((x) => ({ when: '15 Oct 2026', kind: 'phone call', person: x.person, text: x.content })); }
    export async function searchMemory(t, args) { (globalThis.__calls ??= []).push(['searchMemory', args]); if (globalThis.__recall === 'fail') throw new Error('network'); return { results: globalThis.__recall ?? [], used: {} }; }`,
  './phone': `
    export async function launchActivity(action, params) { (globalThis.__intents ??= []).push({ action, ...params }); return globalThis.__clock === 'refuse' ? 'failed' : 'launched'; }
    export async function findContacts(q) { return globalThis.__contactReply(q); }`,
};
register('data:text/javascript,' + encodeURIComponent(`
  const FAKES = ${JSON.stringify(FAKES)};
  export async function resolve(specifier, context, next) {
    if (specifier in FAKES) return { url: 'fake:' + encodeURIComponent(specifier), shortCircuit: true };
    if (specifier.startsWith('@/')) return { url: 'fake:' + encodeURIComponent(specifier), shortCircuit: true };
    try { return await next(specifier, context); } catch (e) { if (specifier.startsWith('.') && !/\\.[cm]?[jt]s$/.test(specifier)) return next(specifier + '.ts', context); throw e; }
  }
  export async function load(url, context, next) {
    if (url.startsWith('fake:')) return { format: 'module', source: FAKES[decodeURIComponent(url.slice(5))] ?? 'export default {};', shortCircuit: true };
    return next(url, context);
  }`));

const g = globalThis as Record<string, any>;
const m = await import(new URL('../services/assistant/moreTools.ts', import.meta.url).href);
const mem = await import(new URL('../services/assistant/memory.ts', import.meta.url).href);

let checks = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  checks++;
  if (!ok) throw new Error(`FAILED: ${name}${detail === undefined ? '' : `\n  got: ${JSON.stringify(detail)}`}`);
}
const reset = () => { for (const k of ['__opened', '__requests', '__intents', '__calls']) g[k] = []; g.__clock = 'ok'; g.__events = []; g.__reminders = []; };
const ctx = (extra: Record<string, unknown> = {}) => ({
  getAccessToken: async () => 'tok',
  getUserId: () => 'user-1',
  onAction: () => {},
  onRemindersChanged: () => { (g.__calls ??= []).push(['rescheduled']); },
  ...extra,
});

// ─── Pure helpers ────────────────────────────────────────────────────────────
check('a 10-digit mobile gets 91', m.whatsappNumber('98765 43210') === '919876543210');
check('+91 and 0 forms agree', m.whatsappNumber('+91 98765-43210') === '919876543210' && m.whatsappNumber('098765 43210') === '919876543210');
check('too short is refused', m.whatsappNumber('12345') === null);
check('a foreign number is kept', m.whatsappNumber('+44 7911 123456') === '447911123456');
check('wa.me link carries the message encoded', m.whatsappUrl('919876543210', 'I will be late & tired') === 'https://wa.me/919876543210?text=I%20will%20be%20late%20%26%20tired');
check('mailto carries subject and body', m.mailtoUrl('a@b.com', 'Hi there', 'Line 1\nLine 2') === 'mailto:a%40b.com?subject=Hi%20there&body=Line%201%0ALine%202');
check('alarm days map to Android numbers (Sunday is 1)', JSON.stringify(m.alarmDays(['Mon', 'wednesday', 'sun', 'nonsense', 'mon'])) === JSON.stringify([2, 4, 1]), m.alarmDays(['Mon', 'wednesday', 'sun']));
const at = new Date(2026, 9, 18, 10, 0, 0);
check('an hour already gone means tomorrow', m.nextOccurrence(6, 30, at).getDate() === 19 && m.nextOccurrence(6, 30, at).getHours() === 6);
check('an hour still ahead means today', m.nextOccurrence(18, 0, at).getDate() === 18);
check('navigation link by car and on foot', m.navigationUrl('Pune Airport', 'drive') === 'google.navigation:q=Pune%20Airport&mode=d' && m.navigationUrl('Pune Airport', 'walk').endsWith('mode=w'));
check('a map search link', m.mapsSearchUrl('petrol pump near me') === 'https://www.google.com/maps/search/petrol%20pump%20near%20me');
check('only public web pages are read', m.readableUrl('http://localhost:3000/x') === null && m.readableUrl('https://192.168.1.5/a') === null && m.readableUrl('file:///etc/passwd') === null && m.readableUrl('https://intranet/x') === null && m.readableUrl('https://www.ndtv.com/a') !== null);
check('a bare domain gets https', m.readableUrl('ndtv.com/news') === 'https://ndtv.com/news');
const page = m.pageText('<html><head><title>Big news</title><style>x{}</style></head><body><nav>Home About</nav><script>evil()</script><p>The minister said on Tuesday that the new policy will start next month across the state.</p><p>Menu</p></body></html>');
check('page text drops scripts, menus and tags', page.title === 'Big news' && page.text.includes('The minister said') && !page.text.includes('evil') && !page.text.includes('Home About') && !page.text.includes('Menu'), page);
const rows = [{ title: 'Dentist appointment' }, { title: 'Call dentist back' }, { title: 'Buy milk' }];
check('one match is picked', m.pickByTitle(rows, 'milk').match?.title === 'Buy milk');
check('two matches ask which', !m.pickByTitle(rows, 'dentist').match && m.pickByTitle(rows, 'dentist').choices.length === 2);
check('an exact title wins over a partial one', m.pickByTitle(rows, 'dentist appointment').match?.title === 'Dentist appointment');
check('nothing matches: no choice', m.pickByTitle(rows, 'gym').choices.length === 0);

// ─── Memory block ────────────────────────────────────────────────────────────
const mk = (n: number) => ({ id: `${n}`, subject: `Person ${n}`, fact: 'likes tea '.repeat(8).trim(), created_at: '2026-10-18T00:00:00Z' });
check('no memories: no block', mem.memoryBlock([]) === '');
check('a block lists what is remembered and tells the model not to recite it', /Anita: sister/.test(mem.memoryBlock([{ id: '1', subject: 'Anita', fact: 'sister, birthday 12 March', created_at: '' }])) && /never recite/.test(mem.memoryBlock([mk(1)])));
check('the block is capped so the prompt stays short', mem.memoryBlock(Array.from({ length: 60 }, (_, i) => mk(i))).length < 1500);
check('matching needs every word', mem.matchMemories([{ id: '1', subject: 'Anita (sister)', fact: 'birthday 12 March', created_at: '' }, { id: '2', subject: 'Meera', fact: 'wife', created_at: '' }], 'anita birthday').length === 1);
check('an empty question gives them all', mem.matchMemories([mk(1), mk(2)], '').length === 2);

// ─── Tools ───────────────────────────────────────────────────────────────────
reset();
let r = await m.runMoreTool('set_alarm', { hour: 6, minute: 30, label: 'Gym', days: ['mon', 'fri'] }, ctx());
check('the alarm goes to the clock app with the time, label and days', r.ok && r.in === 'the phone clock' && g.__intents[0].action === 'android.intent.action.SET_ALARM' && g.__intents[0].extra['android.intent.extra.alarm.HOUR'] === 6 && g.__intents[0].extra['android.intent.extra.alarm.MINUTES'] === 30 && JSON.stringify(g.__intents[0].extra['android.intent.extra.alarm.DAYS']) === '[2,6]', { r, i: g.__intents });
reset(); g.__clock = 'refuse';
r = await m.runMoreTool('set_alarm', { hour: 6, minute: 30 }, ctx());
const made = g.__calls.find((c: any[]) => c[0] === 'createReminder');
check('when the phone refuses, a loud WishMe alarm is set and the model is told the truth', r.ok && r.in === 'WishMe' && made && made[1].style === 'alarm' && /not in the clock app/.test(r.note), { r, calls: g.__calls });
check('a bad time is refused', (await m.runMoreTool('set_alarm', { hour: 25, minute: 0 }, ctx())).ok === false);
reset();
r = await m.runMoreTool('set_timer', { seconds: 600, label: 'Pasta' }, ctx());
check('the timer goes to the clock with its length', r.ok && g.__intents[0].action === 'android.intent.action.SET_TIMER' && g.__intents[0].extra['android.intent.extra.alarm.LENGTH'] === 600);
reset(); g.__clock = 'refuse';
r = await m.runMoreTool('stop_alarm', {}, ctx());
check('a refused stop is reported, never claimed', r.ok === false && /do not claim it worked/.test(r.instruction));

reset();
g.__contactReply = async () => ({ matches: [{ name: 'Amma', number: '+91 98765 43210' }] });
const opened: any[] = [];
r = await m.runMoreTool('send_whatsapp_message', { to: 'Amma', message: 'I will be late' }, ctx({ openAfterReply: (url: string, subject: string, back: string) => opened.push({ url, subject, back }) }));
check('WhatsApp opens with the message ready, after the reply, and the model is told it was NOT sent', r.ok && opened[0].url === 'https://wa.me/919876543210?text=I%20will%20be%20late' && /NOT sent/.test(r.instruction) && /tap send/.test(r.instruction), { r, opened });
g.__contactReply = async () => ({ matches: [{ name: 'Rahul Sharma', number: '9811111111' }, { name: 'Rahul Dravid', number: '9822222222' }] });
r = await m.runMoreTool('send_whatsapp_message', { to: 'Rahul', message: 'hi' }, ctx());
check('two different people: the user chooses', r.needs_choice === true && r.choices.length === 2);
g.__contactReply = async () => ({ matches: [{ name: 'Amma', number: '9811111111' }, { name: 'Amma', number: '9822222222' }] });
r = await m.runMoreTool('send_whatsapp_message', { to: 'Amma', message: 'hi' }, ctx({ openAfterReply: () => {} }));
check('one person with two numbers is not a choice', r.ok === true);
g.__contactReply = async () => ({ matches: [] });
check('no such contact is said plainly', (await m.runMoreTool('send_whatsapp_message', { to: 'Zed', message: 'hi' }, ctx())).ok === false);
r = await m.runMoreTool('send_whatsapp_message', { to: '98765 43210', message: 'hi' }, ctx({ openAfterReply: (u: string) => opened.push({ url: u }) }));
check('a spoken number needs no contact', r.ok && opened.at(-1).url.startsWith('https://wa.me/919876543210'));
check('an email address must be one', (await m.runMoreTool('send_email', { to: 'not-an-email', body: 'x' }, ctx())).ok === false);

reset();
g.__reminders = [{ id: 'r1', title: 'Dentist appointment', due_at: '2026-10-20T10:00:00Z' }, { id: 'r2', title: 'Call dentist back', due_at: null }, { id: 'r3', title: 'Buy milk', due_at: null }];
r = await m.runMoreTool('delete_reminder', { which: 'milk' }, ctx());
check('a reminder is deleted by its title and the phone reschedules', r.ok && g.__calls.some((c: any[]) => c[0] === 'deleteReminder' && c[1] === 'r3') && g.__calls.some((c: any[]) => c[0] === 'rescheduled'), g.__calls);
r = await m.runMoreTool('delete_reminder', { which: 'dentist' }, ctx());
check('an ambiguous title lists the choices and deletes nothing', r.needs_choice === true && r.choices.length === 2 && !g.__calls.some((c: any[]) => c[0] === 'deleteReminder' && c[1] !== 'r3'));
r = await m.runMoreTool('update_reminder', { which: 'dentist appointment', when_iso: '2026-10-24T17:00:00+05:30' }, ctx());
check('a reminder is moved', r.ok && g.__calls.some((c: any[]) => c[0] === 'updateReminder' && c[1] === 'r1' && c[2].due_at === '2026-10-24T11:30:00.000Z'), g.__calls);
r = await m.runMoreTool('update_reminder', { which: 'milk', done: true }, ctx());
check('a reminder is ticked off', r.ok === false || g.__calls.some((c: any[]) => c[0] === 'setReminderDone'));

reset();
g.__events = [{ id: 'e1', title: 'Meeting with Raj', starts_at: '2026-10-21T10:00:00Z', ends_at: '2026-10-21T11:30:00Z' }];
r = await m.runMoreTool('update_event', { which: 'raj', starts_iso: '2026-10-21T17:00:00+05:30' }, ctx());
const upd = g.__calls.find((c: any[]) => c[0] === 'updateEvent');
check('moving an event keeps its length', r.ok && upd[2].starts_at === '2026-10-21T11:30:00.000Z' && upd[2].ends_at === '2026-10-21T13:00:00.000Z', upd);
r = await m.runMoreTool('delete_event', { which: 'raj' }, ctx());
check('an event is deleted', r.ok && g.__calls.some((c: any[]) => c[0] === 'deleteEvent' && c[1] === 'e1'));
r = await m.runMoreTool('delete_event', { which: 'wedding' }, ctx());
check('no such event is said plainly', r.ok === false && /could not find/.test(r.instruction));

reset();
const logged = await m.runMoreTool('remember_fact', { subject: 'Anita (sister)', fact: 'birthday is 12 March' }, { ...ctx(), getAccessToken: async () => null });
check('memory needs a login', logged.ok === false);
check('a tool it does not own is left alone', (await m.runMoreTool('web_search', {}, ctx())) === null);

// ─── Looking back at past conversations and calls ───────────────────────────
g.__calls = [];
g.__recall = [{ content: 'Rahul: I will pay by Friday.', person: 'Rahul', at: '2026-10-15T10:00:00Z', source: 'call', kind: 'chunk' }];
r = await m.runMoreTool('recall_past', { query: 'loan', person: 'Rahul', days_ago: 4 }, ctx());
check('recall_past asks the memory with the person, topic and days', g.__calls.some((c: any) => c[0] === 'searchMemory' && c[1].person === 'Rahul' && c[1].query === 'loan' && c[1].days_ago === 4), g.__calls);
check('recall_past hands back the exact words and tells the model not to invent', r.ok === true && r.found[0].text.includes('pay by Friday') && /Never add details/.test(r.instruction), r);
g.__recall = [];
r = await m.runMoreTool('recall_past', { query: 'cricket' }, ctx());
check('nothing found is said honestly, not invented', r.ok === true && r.found.length === 0 && /Do not guess/.test(r.instruction), r);
g.__calls = [];
await m.runMoreTool('recall_past', { person: 'Anita' }, ctx());
check('no days given means no day filter', g.__calls[0][1].days_ago === undefined, g.__calls);
g.__recall = 'fail';
r = await m.runMoreTool('recall_past', { query: 'x' }, ctx());
check('a network failure is reported, not crashed', r.ok === false && /could not look it up/.test(r.instruction), r);
const loggedOut = await m.runMoreTool('recall_past', { query: 'x' }, { ...ctx(), getAccessToken: async () => null });
check('recall_past needs a login', loggedOut.ok === false);

console.log(`${checks} checks passed`);
