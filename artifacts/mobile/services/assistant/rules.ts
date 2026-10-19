/**
 * STANDING RULES: lasting instructions about how the assistant behaves ("always ask before sending messages", "never call
 * anyone after 10 pm", "reply in Kannada when I speak Kannada"). Ported from MyAssistant (standing instructions). Kept in
 * `assistant_rules` (owner only) and given to the assistant at the start of every conversation, like the memories.
 */

import { supabaseFetch } from '@/constants/supabase';
import { matchByWords, rulesBlock } from './everyday';

export interface Rule { id: string; text: string; created_at: string }

const TABLE = '/rest/v1/assistant_rules';

let cached: Rule[] = [];

export async function listRules(token: string): Promise<Rule[]> {
  const res = await supabaseFetch(`${TABLE}?select=id,text,created_at&order=created_at.asc&limit=50`, {}, token);
  if (!res.ok) throw new Error(`The rules could not be loaded (${res.status})`);
  return (await res.json()) as Rule[];
}

/** Reads the rules ahead of the next conversation. Never throws. */
export async function refreshRules(token: string | null | undefined): Promise<void> {
  if (!token) return;
  try {
    cached = await listRules(token);
  } catch {
    /* keep what was there */
  }
}

export function clearRulesCache() {
  cached = [];
}

/** What the assistant is told, or ''. */
export const currentRulesBlock = () => rulesBlock(cached);

export async function addRule(token: string, text: string): Promise<{ duplicate: boolean }> {
  const have = await listRules(token);
  if (have.some((r) => r.text.toLowerCase() === text.toLowerCase())) return { duplicate: true };
  const res = await supabaseFetch(TABLE, { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ text }) }, token);
  if (!res.ok) throw new Error(`That rule could not be saved (${res.status})`);
  await refreshRules(token);
  return { duplicate: false };
}

/** Removes the rules that hold every word of `about`. */
export async function removeRules(token: string, about: string): Promise<Rule[]> {
  const hits = matchByWords(await listRules(token), about, (r) => r.text);
  for (const r of hits) {
    const res = await supabaseFetch(`${TABLE}?id=eq.${encodeURIComponent(r.id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }, token);
    if (!res.ok) throw new Error(`That rule could not be removed (${res.status})`);
  }
  if (hits.length) await refreshRules(token);
  return hits;
}
