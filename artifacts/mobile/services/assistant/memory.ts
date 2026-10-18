/**
 * What the assistant remembers about the user between conversations ("my sister Anita's birthday is 12 March", "I am
 * vegetarian", "my wife is Meera"). Kept on the account in `assistant_memories` (only the owner can read or change a row),
 * a short block of it is given to the assistant at the start of every conversation, and the user can read and delete
 * everything in Settings > AI Assistant > What the assistant remembers.
 */

import { supabaseFetch } from '@/constants/supabase';

export type MemoryCategory = 'about_me' | 'people' | 'goals' | 'events' | 'preferences' | 'follow_up' | 'work' | 'feelings' | 'places' | 'calls' | 'other';

export interface Memory {
  id: string;
  subject: string;
  fact: string;
  created_at: string;
  category: MemoryCategory;
  person: string | null;
  event_date: string | null;
  /** user = told to remember, chat = noted from a conversation, call = from an AI phone call. */
  source: 'user' | 'chat' | 'call';
}

const TABLE = '/rest/v1/assistant_memories';
const COLUMNS = 'id,subject,fact,created_at,category,person,event_date,source';

/** The most the assistant is shown, so the system prompt (resent every Sarvam turn) stays short. */
const BLOCK_ROWS = 25;
const BLOCK_CHARS = 1100;
const MAX_FACT = 300;
const MAX_SUBJECT = 80;

let cached: Memory[] = [];

async function fail(res: Response, fallback: string): Promise<never> {
  throw new Error(`${fallback} (${res.status})`);
}

export async function listMemories(token: string, limit = 200): Promise<Memory[]> {
  const res = await supabaseFetch(`${TABLE}?select=${COLUMNS}&order=created_at.desc&limit=${limit}`, {}, token);
  if (!res.ok) await fail(res, 'The memories could not be loaded');
  return (await res.json()) as Memory[];
}

/** Reads the memories ahead of the next conversation. Never throws: no memories is a fine answer. */
export async function refreshMemories(token: string | null | undefined): Promise<void> {
  if (!token) return;
  try {
    cached = await listMemories(token, BLOCK_ROWS);
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
  for (const m of rows.slice(0, BLOCK_ROWS)) {
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

/** Saves one fact. The same fact about the same subject is not saved twice; a new fact about a subject is added next to the old. */
export async function rememberFact(token: string, subject: unknown, fact: unknown): Promise<{ ok: true; subject: string; fact: string; duplicate: boolean } | { ok: false; error: string }> {
  const s = clean(subject, MAX_SUBJECT);
  const f = clean(fact, MAX_FACT);
  if (s.length < 2 || f.length < 2) return { ok: false, error: 'Ask the user what exactly to remember, and about whom.' };
  const existing = await listMemories(token, 200);
  if (existing.some((m) => m.subject.toLowerCase() === s.toLowerCase() && m.fact.toLowerCase() === f.toLowerCase())) {
    return { ok: true, subject: s, fact: f, duplicate: true };
  }
  const res = await supabaseFetch(TABLE, { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ subject: s, fact: f }) }, token);
  if (!res.ok) await fail(res, 'That could not be remembered');
  await refreshMemories(token);
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
