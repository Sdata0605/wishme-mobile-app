/**
 * The assistant's research: one `web_search` tool that both voice engines call whenever they need something they do not
 * reliably know (news, people, prices, a protest's latest, anything).
 *
 * The model writes up to three searches and says how fresh the answer must be; the phone passes them to the `web-search`
 * Supabase function (Tavily reads the web there; no search key is ever on the phone), and the short, dated, source-named
 * text that comes back is what the model turns into a spoken answer. If the first result is weak the model searches
 * again with different words; the phone only stops a loop (a handful of searches a minute) and bounds the wait.
 *
 * Pure of React Native apart from the app's two Supabase constants, so it can be self-checked.
 */

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/constants/supabase';
import { parseOpenAppCommand } from './appCommand';
import { getAppIndex } from './installedApps';

export const WEB_FUNCTION_DECLARATIONS = [
  {
    name: 'web_search',
    description:
      'Search the live internet. Returns a short summary and dated results from named sources. Use it for anything that changes or that you are not sure of: news and current events, people, office-holders, prices, scores, schedules, places, rules, anything recent or unfamiliar.',
    parameters: {
      type: 'OBJECT',
      properties: {
        queries: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description:
            'One to three searches that run at the same time. Write each the way you would type it into Google: the subject plus what you need, in English, two to eight words, e.g. "Balasaheb Thorat", "Karnataka chief minister", "gold rate Mumbai 24 carat", "CJP protest". Use several only for separate parts of a question or a briefing ("India top news", "world news", "business news India"). Never add words like latest, today, current, biography or a date.',
        },
        recency: {
          type: 'STRING',
          enum: ['any', 'month', 'week', 'day'],
          description:
            'How fresh the answer must be. day: prices, rates, scores, today\'s news. week: an ongoing story or a recent event. month: the last few weeks. any (the default): people, organisations, facts and background.',
        },
      },
      required: ['queries'],
    },
  },
];

/** The wait for the function: Tavily 7 s, then the fallback sources 2.5 s, on the server. */
const SEARCH_TIMEOUT_MS = 10_000;
/** An identical search asked again soon after is answered from memory. */
const CACHE_MS = 60_000;
const CACHE_MAX = 40;
const WARM_EVERY_MS = 5 * 60_000;
/** A loop guard: more than this many web_search calls in a minute are refused (the server also limits per user). */
const MAX_CALLS_PER_MINUTE = 4;
/** A search that mostly repeats one made this recently is the model digging deeper: it gets the thorough (two-credit) kind. */
const REFINE_WINDOW_MS = 120_000;

type Result = Record<string, unknown>;
type Recency = 'any' | 'day' | 'week' | 'month';

const cache = new Map<string, { at: number; result: Result }>();
let recentQueries: { at: number; words: Set<string> }[] = [];
let recentCalls: number[] = [];
let lastWarmAt = 0;

const OFFLINE: Result = {
  ok: false,
  error: 'The web lookup is not available right now.',
  instruction:
    "Say in one sentence that you couldn't reach the internet just now, give what you know, say it may be out of date, and offer to try again.",
};

export interface WebToolContext {
  getAccessToken?: () => Promise<string | null | undefined>;
  /** The server refused the login (401). */
  onAuthRejected?: () => void;
  onAction?: (label: string) => void;
}

const log: (...args: unknown[]) => void = __DEV__ ? (...args) => console.log('[web]', ...args) : () => {};

const functionUrl = () => `${SUPABASE_URL}/functions/v1/web-search`;

/** Boots the function ahead of the first question (it answers 204 at once and costs nothing against the limits). */
export function warmWebSearch(getAccessToken?: () => Promise<string | null | undefined> | string | null | undefined) {
  if (!getAccessToken || Date.now() - lastWarmAt < WARM_EVERY_MS) return;
  lastWarmAt = Date.now();
  void (async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      await fetch(functionUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ warm: true }),
      });
    } catch {
      /* a failed warm-up costs nothing: the real question will just boot the function itself */
    }
  })();
}

const wordsOf = (q: string) => new Set(q.toLowerCase().match(/[\p{L}\p{M}\p{N}]{3,}/gu) ?? []);

/** The searches the model asked for: the `queries` list, a single `query` (older prompts) or both; at most three, each 120 characters. */
export function searchesFrom(a: Record<string, unknown>): string[] {
  const raw: unknown[] = [...(Array.isArray(a.queries) ? a.queries : typeof a.queries === 'string' ? [a.queries] : []), a.query];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of raw) {
    const clean = typeof q === 'string' ? q.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
    if (clean.length >= 2 && !seen.has(clean.toLowerCase())) {
      seen.add(clean.toLowerCase());
      out.push(clean);
    }
  }
  return out.slice(0, 3);
}

/** True when a search shares at least half its words with one made in the last two minutes (the model is refining a weak result). */
export function isRefinement(queries: string[], now: number): boolean {
  recentQueries = recentQueries.filter((r) => now - r.at < REFINE_WINDOW_MS);
  return queries.some((q) => {
    const w = wordsOf(q);
    if (!w.size) return false;
    return recentQueries.some((r) => {
      let shared = 0;
      for (const x of w) if (r.words.has(x)) shared++;
      return shared / w.size >= 0.5;
    });
  });
}

/** Forgets everything remembered between searches (the self-check starts each group of checks from a clean slate). */
export function resetWebSearchState() {
  cache.clear();
  recentQueries = [];
  recentCalls = [];
  lastWarmAt = 0;
}

export async function runWebTool(name: string, a: Record<string, unknown>, ctx: WebToolContext): Promise<Result | null> {
  if (name !== 'web_search') return null;

  const queries = searchesFrom(a);
  if (!queries.length) return { ok: false, error: 'No search query was given.' };

  // The model sometimes reaches for search when the user only asked to open something.
  if (queries.some((q) => parseOpenAppCommand(q, getAppIndex()))) {
    return { ok: false, instruction: 'That is a phone action, not a question: call open_app instead.' };
  }

  const recency: Recency = a.recency === 'day' || a.recency === 'week' || a.recency === 'month' ? a.recency : 'any';

  const now = Date.now();
  recentCalls = recentCalls.filter((t) => now - t < 60_000);
  if (recentCalls.length >= MAX_CALLS_PER_MINUTE) {
    return { ok: false, instruction: 'Search limit reached for now: answer from what you have already found, and say what you could not confirm.' };
  }

  // The thorough kind costs two credits and is used only when the model is digging for something the last search missed.
  const depth = isRefinement(queries, now) && (recency === 'any' || recency === 'month') ? 'advanced' : 'basic';

  const key = `${recency}|${depth}|${queries.map((q) => q.toLowerCase()).join('|')}`;
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_MS) return { ...hit.result, cached: true };

  recentCalls.push(now);
  recentQueries.push(...queries.map((q) => ({ at: now, words: wordsOf(q) })));
  ctx.onAction?.('Searching the web…');
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), SEARCH_TIMEOUT_MS);
  try {
    const token = await ctx.getAccessToken?.();
    if (!token) return { ok: false, error: 'Please log in to search the web.' };
    const res = await fetch(functionUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      // `query` and `kind` are for the server version that does not know `queries` yet: it answers the first search, the old way.
      body: JSON.stringify({ queries, recency, depth, query: queries[0], kind: recency === 'day' || recency === 'week' ? 'news' : 'general' }),
      signal: abort.signal,
    });
    if (res.status === 429) {
      return { ok: false, instruction: 'You have searched a lot just now: answer from what you know and what you already found, and say what you could not confirm.' };
    }
    if (res.status === 401) {
      log('refused: your login was not accepted (401)');
      ctx.onAuthRejected?.();
      return {
        ok: false,
        error: 'The login was not accepted.',
        instruction: "Say in one sentence that you couldn't search because the user's login has ended and they need to sign in again. Do NOT say the internet is down.",
      };
    }
    if (!res.ok) {
      log(`search service answered ${res.status}`);
      return OFFLINE;
    }
    const data = (await res.json()) as Result;
    // The model reads the text and the instruction, nothing else (no addresses, no accounting).
    const result: Result = { ok: data.ok !== false, results: data.results, ...(data.instruction ? { instruction: data.instruction } : {}) };
    if (data.ok === false) return { ok: false, instruction: data.instruction ?? OFFLINE.instruction };
    log(`${queries.join(' | ')} [${recency}/${depth}] ${data.took_ms}ms via ${data.provider}, ${data.credits} credit(s)${data.cached ? ', cached' : ''}`);
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(key, { at: Date.now(), result });
    return result;
  } catch (e) {
    log('search request failed:', e instanceof Error ? e.message : e);
    return OFFLINE;
  } finally {
    clearTimeout(timer);
    ctx.onAction?.('');
  }
}
