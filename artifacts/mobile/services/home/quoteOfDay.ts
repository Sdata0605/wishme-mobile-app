/**
 * The day's line and its pictures, from the server (supabase/functions/quote-cards). Once per India day the server writes a
 * new line and makes one text-free picture per style, the same for every user; the words are set over the picture on the
 * phone. Until the server answers (or with no network) Home shows the app's own line for the day (dailyQuote.ts), so the
 * quote is never blank.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/constants/supabase';
import { todaysQuote } from './dailyQuote';

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

/** Asks the server for today. Null on any problem; the caller keeps what it shows. */
export async function fetchQuoteDay(token: string | null | undefined): Promise<QuoteDay | null> {
  if (!token) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/quote-cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      body: '{}',
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const d = (await res.json()) as QuoteDay;
    if (!d?.text || !d.date) return null;
    const day: QuoteDay = { ...d, cards: Array.isArray(d.cards) ? d.cards : [] };
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
