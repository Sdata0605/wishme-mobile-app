/**
 * Self-check for the pure helpers behind the assistant's screen control (label matching, icon hints and the
 * safety rules). No React Native needed:
 *
 *   node --experimental-strip-types scripts/screenControl.selfcheck.ts
 *
 * Exits with an error (non-zero) on the first failing check.
 */

// Loaded by file URL because Node needs the ".ts" extension that the app's TypeScript config does not allow.
const m = await import(new URL('../services/assistant/labelMatch.ts', import.meta.url).href);

let checks = 0;
function check(name: string, ok: boolean): void {
  checks++;
  if (!ok) throw new Error(`FAILED: ${name}`);
}

// Normalisation
check('normalizeLabel strips accents and punctuation', m.normalizeLabel('  Café — Menu! ') === 'cafe menu');
check('normalizeLabel keeps Devanagari', m.normalizeLabel('खोजें!') === 'खोजें');
check('normalizeQuery drops filler words', m.normalizeQuery('the Login button') === 'login');
check('normalizeQuery keeps a query made only of filler', m.normalizeQuery('Button') === 'button');

// Matching
check('exact beats prefix', m.scoreLabel('book', 'Book') > m.scoreLabel('book', 'Book now'));
check('prefix beats substring', m.scoreLabel('book', 'Book now') > m.scoreLabel('book', 'Hotel booking'));
check('no match scores 0', m.scoreLabel('flights', 'Hotels') === 0);
check('query with filler still matches', m.scoreLabel('tap the search button', 'Search') > 0);
check('all query words match in any order', m.scoreLabel('date departure', 'Departure date') > 0);
const ranked = m.rankByLabel('book', ['Booking history', 'Book now', 'Book'], (l: string) => [l]);
check('ranking prefers the shortest exact label', ranked[0].item === 'Book');
check('ranking drops non-matches', ranked.length === 3 && m.rankByLabel('zzz', ['a'], (l: string) => [l]).length === 0);
const tie = m.rankByLabel('buy', ['Buy A', 'Buy B'], (l: string) => [l]);
check('ties keep reading order', tie[0].item === 'Buy A');
check('best of several labels is used', m.rankByLabel('search', [['x', 'Search celebrities']], (l: string[]) => l)[0].score > 0);

// Icon hints
check('ArrowLeft -> back', m.iconHint('ArrowLeft') === 'back');
check('chevron-left -> back', m.iconHint('chevron-left') === 'back');
check('X -> close', m.iconHint('X') === 'close');
check('x (kebab) -> close', m.iconHint('x') === 'close');
check('Trash2 -> delete', m.iconHint('Trash2') === 'delete');
check('trash-2 -> delete', m.iconHint('trash-2') === 'delete');
check('search -> search', m.iconHint('search') === 'search');
check('unknown short name falls back to its words', m.iconHint('Calendar') === 'calendar');

// Safety: payment / destructive controls
for (const label of ['Pay now', 'Proceed to Pay ₹500', 'Place order', 'Buy now', 'Checkout', 'Confirm booking', 'Confirm payment',
  'Subscribe', 'Donate', 'Send money', 'Transfer', 'Log out', 'Logout', 'Sign out', 'Delete account', 'Deactivate', 'Remove account']) {
  check(`tap blocked: ${label}`, m.tapRefusal(label) !== null);
}
for (const label of ['Search', 'Continue', 'Back', 'Paytm wallet', 'Book flight', 'Next', 'Add traveller']) {
  check(`tap allowed: ${label}`, m.tapRefusal(label) === null);
}
const refusal = m.tapRefusal('Pay now');
check('tap refusal asks the user to do it', /needs the user to tap it themselves/.test(refusal.instruction));

// Safety: fields
for (const label of ['Enter OTP', 'UPI PIN', 'Password', 'Card number', 'CVV', 'CVC', 'Expiry date', 'Aadhaar number', 'PAN']) {
  check(`fill blocked: ${label}`, m.fillRefusal(label, false) !== null);
}
for (const label of ['Search celebrities', 'Mobile number', 'Pincode', 'Shipping address', 'Full name', 'Message']) {
  check(`fill allowed: ${label}`, m.fillRefusal(label, false) === null);
}
check('secure input is always blocked', m.fillRefusal('Anything', true) !== null);
check('fill refusal asks the user to enter it', /Ask the user to enter this themselves/.test(m.fillRefusal('Password', false).instruction));
check('text cap is 500', m.MAX_FILL_TEXT === 500);

console.log(`screenControl self-check: ${checks} checks passed`);
