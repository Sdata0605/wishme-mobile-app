/**
 * Pure (React Native free) helpers for the screen-control layer: label normalisation and fuzzy matching,
 * icon-name hints and the safety patterns. Kept dependency-free so they run under plain
 * `node --experimental-strip-types` (see scripts/screenControl.selfcheck.ts).
 */

// ─── Safety patterns (enforced in code by uiTools.ts, never left to the model) ──────────────────────────────

/** Controls that commit money or an order: the user must tap these themselves. */
export const PAYMENT_ACTION_RE =
  /\b(pay|payment|pay now|proceed to pay|make payment|place order|buy now|purchase|checkout|confirm (booking|order|payment)|subscribe|donate|transfer|send money)\b/i;

/** Destructive / account-ending controls. */
export const DESTRUCTIVE_ACTION_RE = /\b(delete|remove account|deactivate|log ?out|sign ?out)\b/i;

/** Fields the assistant must never type into (secrets, payment and government identifiers). */
export const SENSITIVE_FIELD_RE = /otp|pin\b|password|cvv|cvc|card number|expiry|upi pin|aadhaar|pan\b/i;

/** Longest text the assistant may type into a field in one go. */
export const MAX_FILL_TEXT = 500;

/** Why an action was refused, in a form that can be returned straight to the model. */
export interface Refusal {
  error: string;
  instruction: string;
}

/** `text` = everything that describes the control (label, visible text, title); `label` is what is shown. Null = allowed. */
export function tapRefusal(text: string, label: string = text): Refusal | null {
  const kind = PAYMENT_ACTION_RE.test(text) ? 'payment or order' : DESTRUCTIVE_ACTION_RE.test(text) ? 'destructive' : null;
  if (!kind) return null;
  return {
    error: `Blocked: this control looks like a ${kind} action ("${truncate(cleanText(label), 60)}").`,
    instruction:
      'This needs the user to tap it themselves. Tell the user which control it is and ask them to tap it.',
  };
}

/** `text` = label, placeholder and the name the model used for the field. */
export function fillRefusal(text: string, secure: boolean): Refusal | null {
  if (!secure && !SENSITIVE_FIELD_RE.test(text)) return null;
  return {
    error: 'Blocked: this field holds a secret or a payment/identity detail (password, OTP, PIN, card, ID number).',
    instruction: 'Ask the user to enter this themselves.',
  };
}

export function isSensitiveFieldText(text: string): boolean {
  return SENSITIVE_FIELD_RE.test(text);
}

// ─── Text helpers ──────────────────────────────────────────────────────────────────────────────────────────

/** Collapses whitespace runs and trims. */
export function cleanText(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Shortens to `max` characters (ellipsis included). */
export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, Math.max(0, max - 1)).trimEnd() + '…' : s;
}

// Built from char codes so the source stays ASCII: U+0300-U+036F are Latin combining accents; the word class
// keeps a-z, 0-9 and everything from U+00C0 up to the CJK range except the U+2000 punctuation/symbol blocks.
const COMBINING_MARKS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, 'g');
const NON_WORD_CHARS = new RegExp(
  `[^a-z0-9${String.fromCharCode(0xc0)}-${String.fromCharCode(0x1fff)}${String.fromCharCode(0x2c00)}-${String.fromCharCode(0xd7ff)}]+`,
  'g',
);

/**
 * Lower-cases, strips Latin accents and punctuation/symbols and collapses spaces. Non-Latin letters
 * (e.g. Devanagari) are kept so Hindi labels still match.
 */
export function normalizeLabel(s: string): string {
  let out = s.toLowerCase();
  if (typeof out.normalize === 'function') out = out.normalize('NFD').replace(COMBINING_MARKS, '');
  return out.replace(NON_WORD_CHARS, ' ').trim();
}

const FILLER_WORDS = new Set(['the', 'a', 'an', 'button', 'link', 'icon', 'tab', 'field', 'box', 'please', 'tap', 'click', 'press']);

/** Normalises what the model asked for, dropping filler like "the Login button" -> "login". */
export function normalizeQuery(s: string): string {
  const words = normalizeLabel(s).split(' ').filter(Boolean);
  const kept = words.filter((w) => !FILLER_WORDS.has(w));
  return (kept.length > 0 ? kept : words).join(' ');
}

// ─── Fuzzy matching ────────────────────────────────────────────────────────────────────────────────────────

/**
 * 0 = no match. Higher is better: exact > prefix > whole-word > substring > all words > label inside query.
 * A small length-difference penalty (< one tier) prefers the shortest, most specific label.
 */
export function scoreLabel(query: string, label: string): number {
  const q = normalizeQuery(query);
  const l = normalizeLabel(label);
  if (!q || !l) return 0;

  let base = 0;
  if (q === l) base = 100;
  else if (l.startsWith(q + ' ')) base = 85;
  else if ((' ' + l + ' ').includes(' ' + q + ' ')) base = 70;
  else if (l.includes(q)) base = 55;
  else if (q.split(' ').every((w) => (' ' + l + ' ').includes(' ' + w + ' '))) base = 40;
  else if (l.length >= 3 && (' ' + q + ' ').includes(' ' + l + ' ')) base = 25;
  if (base === 0) return 0;

  return base - Math.min(9, Math.floor(Math.abs(l.length - q.length) / 6));
}

/**
 * Ranks `items` against `query`; each item may expose several strings (label, placeholder, ...) and its
 * score is the best of them. Items without a match are dropped; ties keep the original (reading) order.
 */
export function rankByLabel<T>(query: string, items: T[], labelsOf: (item: T) => string[]): Array<{ item: T; score: number }> {
  const ranked: Array<{ item: T; score: number; index: number }> = [];
  items.forEach((item, index) => {
    let score = 0;
    for (const label of labelsOf(item)) score = Math.max(score, scoreLabel(query, label));
    if (score > 0) ranked.push({ item, score, index });
  });
  ranked.sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked.map(({ item, score }) => ({ item, score }));
}

// ─── Icon hints ────────────────────────────────────────────────────────────────────────────────────────────

const ICON_HINTS: Array<[RegExp, string]> = [
  [/\b(arrow|chevron|chevrons|angle|caret) (left|back)\b|^(back|left|arrow back)$/, 'back'],
  [/^(x|close|cross|times|cancel|x circle|x square)$|\bclose\b/, 'close'],
  [/\bsearch\b|\bmagnify/, 'search'],
  [/\bmenu\b|\bhamburger\b/, 'menu'],
  [/\bmore (horizontal|vertical)\b|\bellipsis\b|\bdots\b/, 'more options'],
  [/\bfilter\b|\bsliders?\b/, 'filters'],
  [/\bsettings?\b|\bcog\b|\bgear\b/, 'settings'],
  [/^(plus|add)\b|\bplus (circle|square)\b/, 'add'],
  [/^minus\b/, 'decrease'],
  [/\b(trash|delete|bin)\b/, 'delete'],
  [/\b(edit|pencil|pen)\b/, 'edit'],
  [/\bshare\b/, 'share'],
  [/\b(heart|star)\b/, 'favorite'],
  [/\bbookmark\b/, 'save'],
  [/\bbell\b/, 'notifications'],
  [/\bmic(rophone)?\b/, 'microphone'],
  [/\bcamera\b/, 'camera'],
  [/\beye\b/, 'show or hide'],
  [/\bcheck\b/, 'confirm'],
  [/\b(phone|call)\b/, 'call'],
  [/\bsend\b/, 'send'],
  [/\b(refresh|reload|rotate)\b/, 'refresh'],
  [/\bcopy\b/, 'copy'],
  [/\bplay\b/, 'play'],
  [/\bpause\b/, 'pause'],
  [/\bhome\b/, 'home'],
  [/\b(user|profile|person)\b/, 'profile'],
  [/\blog ?out\b|\bsign ?out\b/, 'log out'],
  [/\b(chevron|arrow|angle|caret) (right|forward)\b/, 'next'],
  [/\b(chevron|arrow|angle|caret) down\b/, 'expand'],
  [/\b(chevron|arrow|angle|caret) up\b/, 'collapse'],
];

/**
 * Turns an icon component name ("ArrowLeft", "arrow-left", "chevron-down") into a spoken hint ("back",
 * "expand"). Unknown short names are returned as plain words; returns null for names that are not icon-like.
 */
export function iconHint(name: string): string | null {
  const words = normalizeLabel(name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([a-zA-Z])(\d)/g, '$1 $2'));
  if (!words) return null;
  for (const [re, hint] of ICON_HINTS) {
    if (re.test(words)) return hint;
  }
  return words.split(' ').length <= 3 ? words : null;
}
