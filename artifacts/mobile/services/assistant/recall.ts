/**
 * The assistant's long-term memory of conversations and AI phone calls (server side: memory-ingest and memory-search).
 *
 *  - every assistant conversation is kept word for word when it ends, and the lasting facts in it (family, goals, plans,
 *    follow-ups...) are saved as categorised memories;
 *  - AI phone calls already keep their transcripts; each one is handed to the same memory once, so "what did Rahul say when we
 *    called him last week" can be answered with his own words;
 *  - `searchMemory` finds passages by person, date, exact words and meaning, and is what the assistant's recall_past tool uses.
 *
 * Everything is private to the signed-in user, who can read and delete it in Settings > AI Assistant > What the assistant remembers.
 */

import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseFetch } from '@/constants/supabase';

export interface RecallHit {
  kind: 'chunk' | 'fact';
  source: 'assistant' | 'call' | 'memory';
  person: string | null;
  at: string | null;
  content: string;
  /** How it was found: keyword, meaning, person/date (joined with " + "). */
  via: string;
  score: number;
  /** How close a meaning match was (0 = identical); null when it was not found by meaning. */
  distance: number | null;
}

export interface RecallArgs {
  query?: string;
  person?: string;
  days_ago?: number;
  from?: string;
  to?: string;
  limit?: number;
}

export interface RecallAnswer {
  results: RecallHit[];
  used: { terms: string[]; meaning: boolean; person: string | null; from: string | null; to: string | null };
}

async function callFunction<T>(fn: string, token: string, body: unknown, ms: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : `${fn} failed (${res.status})`);
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Finds what was said before. Throws on a network problem; the caller says it could not look. */
export function searchMemory(token: string, args: RecallArgs): Promise<RecallAnswer> {
  return callFunction<RecallAnswer>('memory-search', token, args, 12_000);
}

// ─── Saving conversations ────────────────────────────────────────────────────────────────────────────────────────────────

export interface LogLine { role: 'user' | 'assistant'; text: string; at: string }

/** Sends one finished conversation. Saving the same session twice does nothing. Never throws. */
export async function saveConversation(token: string, sessionId: string, startedAt: string, lines: LogLine[]): Promise<void> {
  try {
    await callFunction('memory-ingest', token, { source: 'assistant', session_id: sessionId, started_at: startedAt, lines }, 90_000);
  } catch (e) {
    if (__DEV__) console.log('[memory] could not save the conversation:', e instanceof Error ? e.message : e);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let indexing = false;
let lastIndexAt = 0;

/**
 * Hands the AI calls that are not in the memory yet to it, a few at a time (the first run after the update catches up on
 * the old ones). Safe to call often: it does nothing while a run is going or within ten minutes of the last one.
 */
export async function indexPendingCalls(token: string, force = false): Promise<number> {
  if (indexing || (!force && Date.now() - lastIndexAt < 10 * 60_000)) return 0;
  indexing = true;
  lastIndexAt = Date.now();
  let done = 0;
  try {
    const [callsRes, refsRes] = await Promise.all([
      supabaseFetch('/rest/v1/ai_calls?select=id&status=eq.completed&order=created_at.desc&limit=60', {}, token),
      supabaseFetch('/rest/v1/assistant_conversations?select=source_ref&source=eq.call&limit=500', {}, token),
    ]);
    if (!callsRes.ok || !refsRes.ok) return 0;
    const calls = (await callsRes.json()) as { id: string }[];
    const known = new Set(((await refsRes.json()) as { source_ref: string | null }[]).map((r) => r.source_ref));
    const missing = calls.filter((c) => !known.has(c.id)).slice(0, 6);
    for (const c of missing) {
      try {
        await callFunction('memory-ingest', token, { source: 'call', call_id: c.id }, 90_000);
        done++;
      } catch (e) {
        if (__DEV__) console.log('[memory] could not index call', c.id, e instanceof Error ? e.message : e);
      }
      await sleep(300);
    }
    if (__DEV__ && done) console.log(`[memory] indexed ${done} AI call(s)`);
  } catch {
    /* tried again next time */
  } finally {
    indexing = false;
  }
  return done;
}

// ─── What the assistant is told ─────────────────────────────────────────────────────────────────────────────────────────

const when = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
};

/** The hits as plain facts for the model: the exact words, with who, when and which kind of record. */
export function describeHits(hits: RecallHit[]): { when: string; kind: string; person: string | null; text: string }[] {
  return hits.map((h) => ({
    when: when(h.at),
    kind: h.kind === 'fact' ? 'saved fact' : h.source === 'call' ? 'phone call' : 'conversation with the assistant',
    person: h.person,
    text: h.content.slice(0, 900),
  }));
}

// ─── The user's switches ────────────────────────────────────────────────────────────────────────────────────────────────

export interface MemorySettings { save_chats: boolean; learn_facts: boolean }

export async function getMemorySettings(token: string): Promise<MemorySettings> {
  try {
    const res = await supabaseFetch('/rest/v1/assistant_memory_settings?select=save_chats,learn_facts&limit=1', {}, token);
    if (res.ok) {
      const rows = (await res.json()) as MemorySettings[];
      if (rows[0]) return rows[0];
    }
  } catch {
    /* defaults */
  }
  return { save_chats: true, learn_facts: true };
}

export async function setMemorySettings(token: string, userId: string, next: MemorySettings): Promise<void> {
  const res = await supabaseFetch(
    '/rest/v1/assistant_memory_settings?on_conflict=user_id',
    { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ user_id: userId, ...next, updated_at: new Date().toISOString() }) },
    token,
  );
  if (!res.ok) throw new Error(`The setting could not be saved (${res.status})`);
}

/** Deletes every saved conversation and call passage (the facts are managed separately). */
export async function deleteAllConversations(token: string): Promise<void> {
  const res = await supabaseFetch('/rest/v1/assistant_conversations?id=not.is.null', { method: 'DELETE', headers: { Prefer: 'return=minimal' } }, token);
  if (!res.ok) throw new Error(`The conversations could not be deleted (${res.status})`);
}
