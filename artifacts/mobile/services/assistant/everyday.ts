/**
 * Pure helpers for the everyday tools (weather, currency, promises, the shopping list, standing rules), checked offline in
 * scripts/everyday.selfcheck.ts. No network, no React Native.
 */

// ── Words ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

const words = (q: string) => (q.toLowerCase().match(/[\p{L}\p{M}\p{N}]{2,}/gu) ?? []).filter((w) => !FILLER.has(w));
const FILLER = new Set('the a an my of to for and from on in with that this it is was i me please some'.split(' '));

/** The items whose text holds every word asked for. An empty question matches nothing. */
export function matchByWords<T>(items: T[], query: string, text: (t: T) => string): T[] {
  const w = words(query);
  if (!w.length) return [];
  return items.filter((it) => {
    const hay = text(it).toLowerCase();
    return w.every((x) => hay.includes(x) || (x.length > 3 && x.endsWith('s') && hay.includes(x.slice(0, -1))));
  });
}

// ── The shopping list ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface ItemDraft { name: string; quantity: string }

const QTY = /^(\d+(?:[.,]\d+)?\s*(?:kg|kgs|g|gm|gms|grams?|l|ltr|litres?|liters?|ml|dozen|packets?|packs?|pcs|pieces?|bottles?|boxes?|bags?|cans?|loaf|loaves)?|a dozen|half (?:a )?(?:kg|dozen|litre))\s+(?:of\s+)?/i;

/** "milk, 2 kg rice and a dozen eggs" → milk; rice (2 kg); eggs (a dozen). Items given as a list are split the same way. */
export function parseItems(input: unknown): ItemDraft[] {
  const parts = (Array.isArray(input) ? input.map(String) : [String(input ?? '')])
    .flatMap((s) => s.split(/\s*(?:,|;|\n|\band\b|\baur\b|&)\s*/i))
    .map((s) => s.replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, ''))
    .filter(Boolean);
  const out: ItemDraft[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const m = p.match(QTY);
    const quantity = m ? m[1].trim() : '';
    const name = (m ? p.slice(m[0].length) : p).trim().slice(0, 120);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({ name, quantity });
    if (out.length >= 30) break;
  }
  return out;
}

/** The list as plain text for WhatsApp or the model: what is still to buy, then (optionally) what is bought. */
export function listText(items: { name: string; quantity: string; done: boolean }[], title = 'Shopping list'): string {
  const open = items.filter((i) => !i.done);
  if (!open.length) return '';
  return `${title}\n${open.map((i) => `- ${i.name}${i.quantity ? ` (${i.quantity})` : ''}`).join('\n')}`;
}

// ── Currency ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const CURRENCY_WORDS: Record<string, string> = {
  rupee: 'INR', rupees: 'INR', rs: 'INR', inr: 'INR', '₹': 'INR',
  dollar: 'USD', dollars: 'USD', usd: 'USD', $: 'USD', 'us dollar': 'USD',
  euro: 'EUR', euros: 'EUR', '€': 'EUR', pound: 'GBP', pounds: 'GBP', sterling: 'GBP', '£': 'GBP',
  dirham: 'AED', dirhams: 'AED', yen: 'JPY', yuan: 'CNY', riyal: 'SAR', riyals: 'SAR',
  'singapore dollar': 'SGD', 'australian dollar': 'AUD', 'canadian dollar': 'CAD', taka: 'BDT', 'nepali rupee': 'NPR',
};

/** "dollars", "usd", "₹" → a 3-letter code; anything already 3 letters is taken as it is. Null when unclear. */
export function currencyCode(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return null;
  if (CURRENCY_WORDS[s]) return CURRENCY_WORDS[s];
  if (/^[a-z]{3}$/.test(s)) return s.toUpperCase();
  return null;
}

/** 1234567.8 → "12,34,567.80" (Indian grouping for rupees). */
export function money(amount: number, code: string): string {
  const fixed = Math.abs(amount) >= 100 ? 2 : 4;
  return amount.toLocaleString(code === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: fixed });
}

// ── Weather ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export function describeWeather(code: number): string {
  if (code === 0) return 'clear';
  if (code <= 2) return 'partly cloudy';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'foggy';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code >= 61 && code <= 67) return 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'showers';
  if (code >= 95) return 'thunderstorms';
  return 'fair';
}

// ── Promises ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** An ISO date the model passed, or null. A date with no time means the end of that day. */
export function dueFrom(raw: unknown): Date | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T23:59:00+05:30` : s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "overdue", "due today", "due tomorrow", "due in 3 days", "due 12 Nov". */
export function dueWords(due: string | null, now = new Date()): string {
  if (!due) return '';
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return '';
  if (d.getTime() < now.getTime()) return 'overdue';
  const day = (x: Date) => Math.floor((x.getTime() + 330 * 60_000) / 86_400_000);
  const n = day(d) - day(now);
  if (n === 0) return 'due today';
  if (n === 1) return 'due tomorrow';
  if (n < 7) return `due in ${n} days`;
  return `due ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}`;
}

// ── Standing rules ────────────────────────────────────────────────────────────────────────────────────────────────────

/** The block the assistant is given, or '' when there are no rules. */
export function rulesBlock(rules: { text: string }[]): string {
  const lines = rules.slice(0, 20).map((r) => `- ${r.text}`);
  return lines.length
    ? `Standing rules the user gave you. Always follow them unless they are unsafe, and never recite them unless asked:\n${lines.join('\n')}`
    : '';
}
