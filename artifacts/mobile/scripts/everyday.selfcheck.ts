/**
 * Self-check for the everyday tools' pure helpers: the shopping list, currency, promises and standing rules (no network):
 *
 *   node --experimental-strip-types scripts/everyday.selfcheck.ts
 */

import { currencyCode, describeWeather, dueFrom, dueWords, listText, matchByWords, money, parseItems, rulesBlock } from '../services/assistant/everyday.ts';

let checks = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  checks++;
  if (!ok) throw new Error(`FAILED: ${name}${detail === undefined ? '' : `\n  got: ${JSON.stringify(detail)}`}`);
}

// ─── Shopping list ───
const items = parseItems('milk, 2 kg rice and a dozen eggs');
check('a spoken list is split into items', items.map((i) => i.name).join('|') === 'milk|rice|eggs', items);
check('quantities are kept apart from the name', items[1].quantity === '2 kg' && items[2].quantity === 'a dozen', items);
check('items given as a list are split the same way', parseItems(['bread', '500 g paneer']).map((i) => `${i.name}/${i.quantity}`).join('|') === 'bread/|paneer/500 g');
check('the same item twice is added once', parseItems('milk, Milk').length === 1);
check('Hindi "aur" joins items', parseItems('doodh aur chini').length === 2);
check('nothing said, nothing added', parseItems('').length === 0 && parseItems(undefined).length === 0);
const text = listText([{ name: 'milk', quantity: '', done: false }, { name: 'rice', quantity: '2 kg', done: false }, { name: 'eggs', quantity: '', done: true }]);
check('the shared list holds what is still to buy', text === 'Shopping list\n- milk\n- rice (2 kg)', text);
check('an all-bought list has nothing to share', listText([{ name: 'milk', quantity: '', done: true }]) === '');

// ─── Matching ───
const list = [{ t: 'Send Ravi the proposal' }, { t: 'Call Amma back' }, { t: 'eggs' }];
check('every word must match', matchByWords(list, 'proposal Ravi', (x) => x.t).length === 1);
check('a plural finds the singular', matchByWords(list, 'eggs', (x) => x.t).length === 1 && matchByWords([{ t: 'egg' }], 'eggs', (x) => x.t).length === 1);
check('an empty question matches nothing', matchByWords(list, '', (x) => x.t).length === 0);

// ─── Currency ───
check('words become codes', currencyCode('dollars') === 'USD' && currencyCode('rupees') === 'INR' && currencyCode('₹') === 'INR' && currencyCode('dirham') === 'AED');
check('a 3-letter code is taken as it is', currencyCode('gbp') === 'GBP');
check('an unclear currency is null', currencyCode('money') === null && currencyCode('') === null);
check('rupees use Indian grouping', money(1234567.8, 'INR') === '12,34,567.80', money(1234567.8, 'INR'));

// ─── Weather ───
check('weather codes read as words', describeWeather(0) === 'clear' && describeWeather(63) === 'rain' && describeWeather(95) === 'thunderstorms');

// ─── Promises ───
check('a bare date is the end of that day in India', dueFrom('2026-10-23')?.toISOString() === '2026-10-23T18:29:00.000Z', dueFrom('2026-10-23'));
check('no date is null', dueFrom('') === null && dueFrom('soon') === null);
const now = new Date('2026-10-19T06:00:00Z');
check('past is overdue', dueWords('2026-10-18T10:00:00Z', now) === 'overdue');
check('later today', dueWords('2026-10-19T15:00:00Z', now) === 'due today');
check('tomorrow', dueWords('2026-10-20T10:00:00Z', now) === 'due tomorrow');
check('within the week', dueWords('2026-10-22T10:00:00Z', now) === 'due in 3 days');
check('no due date says nothing', dueWords(null, now) === '');

// ─── Rules ───
check('no rules, no block', rulesBlock([]) === '');
check('rules are listed and must be followed', /Always follow/.test(rulesBlock([{ text: 'Always ask before sending messages' }])) && /- Always ask before sending messages/.test(rulesBlock([{ text: 'Always ask before sending messages' }])));

console.log(`everyday: ${checks} checks passed`);
