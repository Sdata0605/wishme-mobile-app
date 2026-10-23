/**
 * Pulls the useful bits out of text read from a photo (a business card, a bill, a note): who, where, how much, when.
 * Plain rules, no model: good enough to prefill a contact, an expense, a reminder or a calendar event for the user to
 * correct before saving.
 */
export interface Parsed {
  firstLine: string;
  name: string | null;
  org: string | null;
  title: string | null;
  phones: string[];
  emails: string[];
  urls: string[];
  amount: number | null;
  date: Date | null;
  hasTime: boolean;
}

const ORG = /\b(ltd|limited|pvt|private|inc|llp|llc|corp|corporation|company|co\.|technologies|technology|solutions|systems|services|enterprises|industries|hospital|clinic|school|college|university|bank|store|stores|mart|restaurant|hotel|cafe|bakery|pharmacy|motors|traders|agencies|associates|group)\b/i;
const TITLE = /\b(manager|engineer|director|ceo|cto|cfo|coo|founder|co-founder|head|lead|consultant|developer|designer|analyst|officer|president|partner|advocate|doctor|dr\.|professor|sales|marketing|executive|proprietor|owner|architect|accountant|specialist)\b/i;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function uniq(a: string[]): string[] { return Array.from(new Set(a)); }

export function parsePhones(text: string): string[] {
  const out: string[] = [];
  const re = /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?)?\d{3,5}[\s-]?\d{3,5}(?:[\s-]?\d{2,4})?/g;
  for (const m of text.match(re) ?? []) {
    const digits = m.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 13) continue;
    if (/[./]/.test(m)) continue; // a date or an amount
    const idx = text.indexOf(m);
    const before = text[idx - 1] ?? ' ';
    const after = text[idx + m.length] ?? ' ';
    if (/[\d./]/.test(before) || /[\d./%]/.test(after)) continue;
    out.push(m.trim());
  }
  return uniq(out);
}

export function parseEmails(text: string): string[] {
  return uniq((text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []).map((e) => e.toLowerCase()));
}

export function parseUrls(text: string): string[] {
  return uniq((text.match(/\b(?:https?:\/\/|www\.)[^\s,;]+/gi) ?? []).map((u) => u.replace(/[.,;:)]+$/, '')));
}

function toNumber(s: string): number | null {
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 && n < 1e8 ? n : null;
}

/** The bill total: the figure on a "total" line, else the biggest figure with a currency mark, else the biggest decimal. */
export function parseAmount(text: string): number | null {
  const lines = text.split('\n');
  const money = /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+\.\d{2})\b/gi;
  let best: number | null = null;
  for (const line of lines) {
    if (!/\b(grand\s*total|total|amount\s*(?:due|payable)?|net\s*(?:amount|payable)|balance|payable)\b/i.test(line)) continue;
    for (const m of line.matchAll(/[\d,]*\d(?:\.\d{1,2})?/g)) {
      const n = toNumber(m[0]);
      if (n !== null && (best === null || n > best)) best = n;
    }
  }
  if (best !== null) return best;
  for (const m of text.matchAll(money)) {
    const n = toNumber(m[1] ?? m[2] ?? '');
    if (n !== null && (best === null || n > best)) best = n;
  }
  return best;
}

/** A date and maybe a time in the text, in the phone's local time. */
export function parseWhen(text: string, now = new Date()): { date: Date | null; hasTime: boolean } {
  const t = text.toLowerCase();
  let date: Date | null = null;
  let m: RegExpMatchArray | null;

  if ((m = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/))) date = new Date(+m[1], +m[2] - 1, +m[3]);
  else if ((m = t.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/))) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    date = new Date(y, +m[2] - 1, +m[1]); // day first, as in India
  } else if ((m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s*(\d{4})?\b/))) {
    date = new Date(m[3] ? +m[3] : now.getFullYear(), MONTHS.indexOf(m[2]), +m[1]);
  } else if ((m = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?\b/))) {
    date = new Date(m[3] ? +m[3] : now.getFullYear(), MONTHS.indexOf(m[1]), +m[2]);
  } else if (/\btomorrow\b/.test(t)) {
    date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  } else if (/\btoday\b|\btonight\b/.test(t)) {
    date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if ((m = t.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/))) {
    const want = DAYS.indexOf(m[1]);
    const delta = (want - now.getDay() + 7) % 7 || 7;
    date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + delta);
  }
  if (date && Number.isNaN(date.getTime())) date = null;

  let hasTime = false;
  const tm = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) ?? t.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s*(?:am|pm))/);
  if (tm) {
    let h = +tm[1];
    const min = tm[2] ? +tm[2] : 0;
    const ap = tm[3];
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    if (h >= 0 && h < 24) {
      if (!date) date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (h * 60 + min <= now.getHours() * 60 + now.getMinutes() ? 1 : 0));
      date.setHours(h, min, 0, 0);
      hasTime = true;
    }
  } else if (date) {
    date.setHours(9, 0, 0, 0);
  }
  return { date, hasTime };
}

export function parseText(text: string, now = new Date()): Parsed {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const phones = parsePhones(text);
  const emails = parseEmails(text);
  const urls = parseUrls(text);
  const org = lines.find((l) => ORG.test(l) && !/@/.test(l)) ?? null;
  const title = lines.find((l) => TITLE.test(l) && l.length < 60 && !/@|\d/.test(l) && l !== org) ?? null;
  const name =
    lines.find((l) => {
      if (l === org || l === title) return false;
      if (/[\d@/:]/.test(l) || l.length > 40 || ORG.test(l) || TITLE.test(l)) return false;
      const words = l.replace(/[.,]/g, '').split(/\s+/);
      return words.length >= 2 && words.length <= 4 && words.every((w) => /^[A-Za-z][A-Za-z'’-]*$/.test(w));
    }) ?? null;
  const amount = parseAmount(text);
  const { date, hasTime } = parseWhen(text, now);
  return { firstLine: lines[0] ?? '', name, org, title, phones, emails, urls, amount, date, hasTime };
}
