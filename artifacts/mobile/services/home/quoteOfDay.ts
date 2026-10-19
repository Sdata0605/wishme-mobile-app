/**
 * The day's line and its pictures, read from the MyAssistant server (api.hariassistant.tech, GET /quote-cards/public/today).
 * Once per India day that server writes a new line and makes one text-free picture per style, the same for every user of
 * both apps; the words are set over the picture on the phone. No login is needed: it is the same for everyone and carries
 * nothing personal. Until the server answers (or with no network) Home shows the app's own line for the day
 * (dailyQuote.ts), so the quote is never blank.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { todaysQuote } from './dailyQuote';

const QUOTE_SERVER = process.env.EXPO_PUBLIC_QUOTE_SERVER || 'https://api.hariassistant.tech';

const CACHE_KEY = 'home_quote_day_v1';

export interface QuoteCard {
  style: string;
  label: string;
  /** The colour the words are set in. */
  ink: string;
  font: 'serif' | 'sans';
  /** 'light' for a pale picture: the middle is lightened instead of darkened. */
  scrim: 'dark' | 'light';
  /** 'lower' when the subject fills the top: the words sit in the lower half. */
  place: 'center' | 'lower';
  url: string;
  width: number;
  height: number;
}

export interface QuoteDay {
  date: string;
  text: string;
  status: 'ready' | 'generating' | 'off';
  total: number;
  cards: QuoteCard[];
}

/** YYYY-MM-DD in India. */
export function indiaToday(now = Date.now()): string {
  return new Date(now + 330 * 60_000).toISOString().slice(0, 10);
}

/** Today's record if it is cached and still today, else null. */
export async function cachedQuoteDay(): Promise<QuoteDay | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const d = raw ? (JSON.parse(raw) as QuoteDay) : null;
    return d && d.date === indiaToday() && d.text ? d : null;
  } catch {
    return null;
  }
}

/** The picture urls come relative to the server ("/quote-cards/img/…"). */
const absolute = (url: string) => (/^https?:\/\//.test(url) ? url : `${QUOTE_SERVER}${url.startsWith('/') ? '' : '/'}${url}`);

/** Asks the server for today. Null on any problem; the caller keeps what it shows. */
export async function fetchQuoteDay(): Promise<QuoteDay | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${QUOTE_SERVER}/quote-cards/public/today`, { signal: controller.signal });
    if (!res.ok) return null;
    const d = (await res.json()) as QuoteDay;
    if (!d?.text || !d.date) return null;
    const cards = (Array.isArray(d.cards) ? d.cards : []).filter((c) => c?.url).map((c) => ({ ...c, place: c.place ?? 'center', url: absolute(c.url) }));
    const day: QuoteDay = { ...d, cards };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(day)).catch(() => {});
    return day;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The line to show: the server's for today, else the app's own. */
export function lineFor(day: QuoteDay | null, now = new Date()): string {
  return day && day.date === indiaToday(now.getTime()) ? day.text : todaysQuote(now);
}
