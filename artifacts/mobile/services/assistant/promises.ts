/**
 * PROMISES: what the user said THEY would do ("I'll send Ravi the proposal by Friday"), kept until done. Ported from
 * MyAssistant (commitments). Rows live in `assistant_promises` (owner only). They are added by the assistant when the user
 * makes a promise in conversation (note_promise), and by memory-ingest from finished conversations.
 */

import { supabaseFetch } from '@/constants/supabase';

export interface PromiseRow {
  id: string;
  text: string;
  owed_to: string;
  due_at: string | null;
  status: 'open' | 'done' | 'cancelled';
  quote: string;
  created_at: string;
}

const TABLE = '/rest/v1/assistant_promises';
const COLUMNS = 'id,text,owed_to,due_at,status,quote,created_at';

async function check(res: Response, what: string): Promise<void> {
  if (!res.ok) throw new Error(`${what} (${res.status})`);
}

/** Open promises, the soonest due first (those with no date last). */
export async function listOpenPromises(token: string, limit = 30): Promise<PromiseRow[]> {
  const res = await supabaseFetch(`${TABLE}?select=${COLUMNS}&status=eq.open&order=due_at.asc.nullslast,created_at.desc&limit=${limit}`, {}, token);
  await check(res, 'The promises could not be loaded');
  return (await res.json()) as PromiseRow[];
}

export async function addPromise(token: string, p: { text: string; owed_to: string; due_at: string | null; quote: string }): Promise<PromiseRow | null> {
  const res = await supabaseFetch(TABLE, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ ...p, source: 'voice' }) }, token);
  await check(res, 'That could not be noted');
  return ((await res.json().catch(() => [])) as PromiseRow[])[0] ?? null;
}

export async function setPromiseStatus(token: string, id: string, status: 'done' | 'cancelled' | 'open'): Promise<void> {
  const now = new Date().toISOString();
  const res = await supabaseFetch(
    `${TABLE}?id=eq.${encodeURIComponent(id)}`,
    { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status, done_at: status === 'done' ? now : null, updated_at: now }) },
    token,
  );
  await check(res, 'That could not be changed');
}
