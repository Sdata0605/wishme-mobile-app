/**
 * What the assistant remembers about the user between conversations ("my sister Anita's birthday is 12 March", "I am
 * vegetarian", "my wife is Meera"). Kept on the account in `assistant_memories` (only the owner can read or change a row),
 * a short block of it is given to the assistant at the start of every conversation, and the user can read and delete
 * everything in Settings > AI Assistant > What the assistant remembers.
 */

import { supabaseFetch } from '@/constants/supabase';
import { pickForPrompt } from './memoryStrength';

export type MemoryCategory = 'about_me' | 'people' | 'goals' | 'events' | 'preferences' | 'follow_up' | 'work' | 'feelings' | 'places' | 'calls' | 'other';

export interface Memory {
  id: string;
  subject: string;
  fact: string;
  created_at: string;
  category: MemoryCategory;
  person: string | null;
  event_date: string | null;
  /** user = told to remember, chat = noted from a conversation, call = from an AI phone call, learned = a habit noticed. */
  source: 'user' | 'chat' | 'call' | 'learned';
  /** 1 as stored, up to 3 when used and said again, down when unused for weeks or corrected (memory-learn). */
  strength?: number | null;
  last_used_at?: string | null;
}

const TABLE = '/rest/v1/assistant_memories';
const COLUMNS = 'id,subject,fact,created_at,category,person,event_date,source,strength,last_used_at';
/** Older rows, before the learning columns existed (the migration has not run yet). */
const BASIC_COLUMNS = 'id,subject,fact,created_at,category,person,event_date,source';

/** The most the assistant is shown, so the system prompt (resent every Sarvam turn) stays short. */
const BLOCK_ROWS = 25;
/** How many are read to choose those 25 from: the strongest and the newest win. */
const POOL_ROWS = 80;
const BLOCK_CHARS = 1100;
const MAX_FACT = 300;
const MAX_SUBJECT = 80;

let cached: Memory[] = [];

async function fail(res: Response, fallback: string): Promise<never> {
  throw new Error(`${fallback} (${res.status})`);
}

export async function listMemories(token: string, limit = 200): Promise<Memory[]> {
  let res = await supabaseFetch(`${TABLE}?select=${COLUMNS}&order=created_at.desc&limit=${limit}`, {}, token);
  // 400 = a column is missing: the learning migration has not been applied, so read what there is.
  if (res.status === 400) res = await supabaseFetch(`${TABLE}?select=${BASIC_COLUMNS}&order=created_at.desc&limit=${limit}`, {}, token);
  if (!res.ok) await fail(res, 'The memories could not be loaded');
  return (await res.json()) as Memory[];
}

/** Reads the memories ahead of the next conversation. Never throws: no memories is a fine answer. */
export async function refreshMemories(token: string | null | undefined): Promise<void> {
  if (!token) return;
  try {
    cached = await listMemories(token, POOL_ROWS);
  } catch {
    /* keep what was there */
  }
}

export function clearMemoryCache() {
  cached = [];
}

/** The lines the assistant is given, or '' when it remembers nothing. Pure: checked offline. */
export function memoryBlock(rows: Memory[] = cached): string {
  if (!rows.length) return '';
  const lines: string[] = [];
  let used = 0;
  // A faded fact (unused for months, or doubted) stays listed and recallable but no longer rides in the prompt.
  for (const m of pickForPrompt(rows, BLOCK_ROWS)) {
    const line = `- ${m.subject}: ${m.fact}`;
    if (used + line.length > BLOCK_CHARS) break;
    lines.push(line);
    used += line.length + 1;
  }
  return lines.length
    ? `What you remember about the user (use it naturally when it helps; never recite the list; if they say something here is wrong, call forget_memory):\n${lines.join('\n')}`
    : '';
}

const clean = (s: unknown, max: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Tells memory-learn what just happened, without waiting: a fact told again grows stronger, and a new fact retires the
 * remembered ones it replaces ("my office moved to Whitefield" replaces "office is in Koramangala"). Never throws.
 */
function learn(token: string, action: 'remembered' | 'said_again', id: string): void {
  void supabaseFetch('/functions/v1/memory-learn', { method: 'POST', body: JSON.stringify({ action, id }) }, token, 60_000)
    .then(async (r) => {
      // A replaced fact has gone: the next conversation must not be given it.
      if (r.ok && action === 'remembered') await refreshMemories(token);
    })
    .catch(() => {});
}

/** Once a day per user, memory-learn tidies the memory: fading, merging duplicates, habits. Called after login; never throws. */
export function dailyMemoryUpkeep(token: string): void {
  void supabaseFetch('/functions/v1/memory-learn', { method: 'POST', body: JSON.stringify({ action: 'daily' }) }, token, 150_000).catch(() => {});
}

/**
 * Saves one fact. The same fact about the same subject is not saved twice (it is reinforced instead); a new fact replaces
 * the remembered ones it updates or contradicts (memory-learn decides which, after the answer).
 */
export async function rememberFact(token: string, subject: unknown, fact: unknown): Promise<{ ok: true; subject: string; fact: string; duplicate: boolean } | { ok: false; error: string }> {
  const s = clean(subject, MAX_SUBJECT);
  const f = clean(fact, MAX_FACT);
  if (s.length < 2 || f.length < 2) return { ok: false, error: 'Ask the user what exactly to remember, and about whom.' };
  const existing = await listMemories(token, 200);
  const same = existing.find((m) => m.subject.toLowerCase() === s.toLowerCase() && m.fact.toLowerCase() === f.toLowerCase());
  if (same) {
    learn(token, 'said_again', same.id);
    return { ok: true, subject: s, fact: f, duplicate: true };
  }
  const res = await supabaseFetch(TABLE, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ subject: s, fact: f }) }, token);
  if (!res.ok) await fail(res, 'That could not be remembered');
  const saved = ((await res.json().catch(() => [])) as { id?: string }[])[0];
  await refreshMemories(token);
  if (saved?.id) learn(token, 'remembered', saved.id);
  return { ok: true, subject: s, fact: f, duplicate: false };
}

const words = (q: string) => q.toLowerCase().match(/[\p{L}\p{M}\p{N}]{2,}/gu) ?? [];

/** The memories that mention what was asked for (every word), newest first. An empty question gives the latest. */
export function matchMemories(rows: Memory[], query: string): Memory[] {
  const w = words(query);
  if (!w.length) return rows;
  return rows.filter((m) => {
    const hay = `${m.subject} ${m.fact}`.toLowerCase();
    return w.every((x) => hay.includes(x));
  });
}

export async function recallMemories(token: string, query: unknown): Promise<Memory[]> {
  return matchMemories(await listMemories(token, 200), clean(query, 100)).slice(0, 15);
}

/** Forgets everything that matches what the user said to forget. */
export async function forgetMemories(token: string, query: unknown): Promise<{ removed: Memory[] }> {
  const q = clean(query, 100);
  if (!words(q).length) return { removed: [] };
  const hits = matchMemories(await listMemories(token, 200), q);
  for (const m of hits) {
    const res = await supabaseFetch(`${TABLE}?id=eq.${encodeURIComponent(m.id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }, token);
    if (!res.ok) await fail(res, 'That could not be forgotten');
  }
  if (hits.length) await refreshMemories(token);
  return { removed: hits };
}

export async function deleteMemory(token: string, id: string): Promise<void> {
  const res = await supabaseFetch(`${TABLE}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }, token);
  if (!res.ok) await fail(res, 'That could not be removed');
  await refreshMemories(token);
}
