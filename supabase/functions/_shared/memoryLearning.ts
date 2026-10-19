/**
 * MEMORY THAT LEARNS (2026-10-19) — ported from MyAssistant (memory/learning.js and agents/memory.js, 2026-10-18).
 *
 * memory-ingest stores what the user SAYS. Left alone that memory only grows: the same thing saved several ways, a fact
 * used every day weighing the same as one that was wrong from the start, and nothing learnt from what the user DOES.
 * Every remembered row now carries a strength (1 as stored, 0.1 … 3; see the migration 20261019120000_memory_learning):
 *
 *   used in an answer ....... +0.05 (at most five facts a conversation)
 *   said again .............. +0.3
 *   contradicted ............ x0.4, judged by a model only when the user's words look like a correction and touch something
 *                             remembered. A misjudged "it's fine" costs a little standing, never the fact; a real change
 *                             ("moved to Pune") is learnt as the new fact and supersede() retires the old one. A learned
 *                             habit is let go at once.
 *   unused 30 days .......... x0.98 a day; facts about the user and their people never fade
 *
 * Once a day per user (memory-learn, action "daily"): decay, consolidation (duplicates and contradictions merged, newest
 * wins, categories corrected) and reflection (a week of conversations read for HABITS, kept only after three different days).
 *
 * Every step is best-effort: a failure is logged and never reaches the user.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { CATEGORIES, type Category } from './memoryCore.ts';
import { pickModels } from './geminiModels.ts';

const API = 'https://generativelanguage.googleapis.com/v1beta';

export const FADED = 0.35;
const MAX_STRENGTH = 3;
const USE_BUMP = 0.05;
const SAID_AGAIN_BUMP = 0.3;
const CORRECTION_FACTOR = 0.4;
const USES_PER_CONVERSATION = 5;
const LEARNED_STRENGTH = 0.8;
const LEARN_MIN_DAYS = 3;
const REFLECT_MIN_USER_LINES = 8;
const REFLECT_WINDOW_DAYS = 7;

export interface MemRow {
  id: string;
  subject: string;
  fact: string;
  category: string;
  person: string | null;
  source: string;
  strength?: number | null;
  uses?: number | null;
  evidence?: number | null;
  created_at?: string;
  updated_at?: string;
  event_date?: string | null;
}

// ── Words ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

const STOP = new Set(
  ('the and for are was were been being has have had with that this from they them their there what when where which who ' +
    'whom will would could should about into over than then just also very much more most some any user users assistant ' +
    'prefer prefers like likes want wants usually always name named live lives work works call calls message messages ' +
    'speak talk answer reply said says told tell').split(' '),
);

/** Content words of a text, lower-cased, a plural "s" dropped. Pure. */
export function memTokens(text: string): string[] {
  return (String(text || '').toLowerCase().match(/[\p{L}\p{M}\p{N}]{3,}/gu) ?? [])
    .map((w) => (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .filter((w) => !STOP.has(w));
}

/** Names in a fact: capitalised words that are not the first word or "User". Pure. */
export function entitiesOf(text: string): string[] {
  const words = String(text || '').match(/\p{Lu}[\p{L}\p{M}]+/gu) ?? [];
  return [...new Set(words.filter((w) => !/^(User|The|A|An|I|My|He|She|They|It|On|In|At)$/.test(w)).map((w) => w.toLowerCase()))];
}

const rowText = (r: MemRow) => `${r.subject}: ${r.fact}`;

/** Remembered rows that share a word or a name with `text`, newest first. Pure. */
export function relatedFacts(rows: MemRow[], text: string, limit = 10): MemRow[] {
  const words = new Set(memTokens(text));
  const names = new Set(entitiesOf(text));
  const lowerText = String(text || '').toLowerCase();
  return rows
    .filter((r) => {
      const subject = String(r.subject || '').toLowerCase();
      return memTokens(rowText(r)).some((w) => words.has(w)) || entitiesOf(rowText(r)).some((e) => names.has(e)) ||
        (subject.length > 2 && subject !== 'user' && lowerText.includes(subject));
    })
    .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
    .slice(0, limit);
}

/** The rows an answer drew on: two of the fact's own words in it, or one of its names plus one word. Pure. */
export function usedMemories(rows: MemRow[], answer: string, limit = USES_PER_CONVERSATION): MemRow[] {
  const text = String(answer || '');
  if (!text.trim()) return [];
  const said = new Set(memTokens(text));
  const lower = text.toLowerCase();
  const hits: { r: MemRow; score: number }[] = [];
  for (const r of rows) {
    const words = [...new Set(memTokens(r.fact))];
    const shared = words.filter((w) => said.has(w)).length;
    const names = entitiesOf(rowText(r)).filter((n) => new RegExp(`(^|[^\\p{L}])${n.replace(/[^\p{L}\p{N}]/gu, '')}([^\\p{L}]|$)`, 'u').test(lower)).length;
    const score = shared + names;
    if (score >= 2) hits.push({ r, score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit).map((h) => h.r);
}

/** "No, I moved to Pune", "that's not my office any more", "galat": the user is putting something right. */
export const CORRECTION_RX =
  /\b(wrong|not (true|right|correct)|that'?s not|isn'?t (true|right|correct)|any ?more|no longer|actually|i (have |'ve )?moved|(has|have|'ve) changed|not my|galat|sahi nahi)\b|^\s*(no|nope|nahi|illa)\b[,.!]?\s+(i|my|it|that|she|he|we|its?|use|don'?t)\b/i;

export const strengthOf = (r: { strength?: number | null }) => {
  const n = r.strength == null ? NaN : Number(r.strength);
  return Number.isFinite(n) ? n : 1;
};

// ── The model ─────────────────────────────────────────────────────────────────────────────────────────────────────────

async function ask(apiKey: string, system: string, content: string): Promise<unknown> {
  const models = await pickModels(apiKey, Deno.env.get('MEMORY_MODEL') || undefined);
  for (const model of models) {
    try {
      const res = await fetch(`${API}/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: content }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
        }),
        signal: AbortSignal.timeout(40_000),
      });
      if (!res.ok) continue;
      const body = await res.json();
      const text = (body.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
      return JSON.parse(text.replace(/^```json\s*|```$/g, '').trim());
    } catch {
      /* try the next model */
    }
  }
  throw new Error('no model answered');
}

const nums = (v: unknown): number[] => (Array.isArray(v) ? [...new Set(v.map(Number).filter((n) => Number.isInteger(n)))] : []);
const pickRows = (rows: MemRow[], picked: number[]) => picked.map((n) => rows[n - 1]).filter(Boolean);

// ── An update replaces what it updates ───────────────────────────────────────────────────────────────────────────────

const SUPERSEDE_PROMPT =
  "A personal assistant's long-term memory just learned a NEW fact. Decide which of the numbered EXISTING facts it " +
  'replaces: the same attribute of the same person or thing with a different or updated value (moved city, new job, a ' +
  'changed date, a preference reversed), or a fact the new one makes untrue. Do NOT include a fact that is only related, ' +
  'or that the new fact adds to without contradicting it. Separately, list the facts that say the SAME thing as the new ' +
  'one (a restatement, maybe in other words) and hold no detail the new one lacks. Return STRICT JSON only: ' +
  '{"replaces":[2],"same":[4]} — empty arrays when none. No prose, no markdown.';

/**
 * "My office moved to Whitefield" must not sit BESIDE "office is in Koramangala". The new fact is compared with the
 * remembered ones it shares words or a name with; a model decides which of those it replaces (deleted, as memory-ingest
 * already does with `supersedes`) and which only restate it (the new row takes over their standing). No related fact, no
 * model call. Returns the facts retired.
 */
export async function supersede(db: SupabaseClient, apiKey: string, userId: string, newRow: MemRow): Promise<string[]> {
  try {
    const { data } = await db
      .from('assistant_memories')
      .select('id, subject, fact, category, person, source, strength, uses, evidence, created_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .neq('id', newRow.id)
      .order('created_at', { ascending: false })
      .limit(200);
    const mine = rowText(newRow).toLowerCase();
    const others = ((data ?? []) as MemRow[]).filter((r) => rowText(r).toLowerCase() !== mine);
    const candidates = relatedFacts(others, rowText(newRow));
    if (!candidates.length) return [];
    const v = (await ask(apiKey, SUPERSEDE_PROMPT,
      `NEW: ${rowText(newRow).slice(0, 300)}\nEXISTING:\n${candidates.map((r, i) => `${i + 1}. ${rowText(r)}`).join('\n')}`)) as
      { replaces?: unknown; same?: unknown } | unknown[];
    const replaces = Array.isArray(v) ? nums(v) : nums(v?.replaces);
    const same = Array.isArray(v) ? [] : nums(v?.same);
    const restated = pickRows(candidates, same);
    const gone = [...new Map([...pickRows(candidates, replaces), ...restated].map((r) => [r.id, r])).values()];
    if (!gone.length) return [];
    if (restated.length) {
      // Said again in other words: the new row keeps the old standing rather than starting from zero.
      await db.from('assistant_memories').update({
        strength: Math.min(MAX_STRENGTH, Math.max(strengthOf(newRow), ...restated.map(strengthOf)) + SAID_AGAIN_BUMP),
        uses: (Number(newRow.uses) || 0) + restated.reduce((n, r) => n + (Number(r.uses) || 0), 0),
        evidence: (Number(newRow.evidence) || 1) + restated.reduce((n, r) => n + (Number(r.evidence) || 1), 0),
        last_used_at: new Date().toISOString(),
      }).eq('user_id', userId).eq('id', newRow.id);
    }
    await db.from('assistant_memories').delete().eq('user_id', userId).in('id', gone.map((r) => r.id));
    return gone.map((r) => r.fact);
  } catch (e) {
    console.log('memory learning: supersede failed:', e instanceof Error ? e.message : e);
    return [];
  }
}

/** The same fact told again is evidence it matters. */
export async function saidAgain(db: SupabaseClient, userId: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await db.rpc('memory_reinforce', { p_user: userId, p_ids: ids, p_amount: SAID_AGAIN_BUMP, p_used: false, p_evidence: true });
  if (error) console.log('memory learning: said-again failed:', error.message);
}

// ── After a conversation: used facts grow, contradicted facts weaken ─────────────────────────────────────────────────

const CORRECTION_PROMPT =
  'A personal assistant keeps long-term facts about its user. Below is what the assistant last said, what the user said ' +
  "next, and numbered FACTS. Which facts does the user now say are wrong or no longer true? Count only a fact the user " +
  "clearly contradicts or rejects ('no, I moved to Pune' contradicts 'lives in Mumbai'; 'don't use WhatsApp for me' " +
  "rejects 'prefers WhatsApp'): their words would be false if the fact were true. Agreeing, thanking, 'it's fine', 'no " +
  "problem' and changing the subject reject nothing. A fact the user only mentions, asks about or adds to is NOT wrong, " +
  'and neither is a fact about some other person, place or thing that stays true when the user\'s own situation changes ' +
  '(moving out does not change the old building\'s address). Return STRICT JSON only: {"wrong":[2]} — {"wrong":[]} when ' +
  'none. No prose, no markdown.';

export interface Line { role: 'user' | 'assistant'; text: string }

/** The user lines that look like a correction, each with what the assistant said just before. Pure. */
export function correctionMoments(lines: Line[], limit = 3): { user: string; before: string }[] {
  const out: { user: string; before: string }[] = [];
  let before = '';
  for (const l of lines) {
    if (l.role === 'assistant') before = l.text;
    else if (CORRECTION_RX.test(l.text)) out.push({ user: l.text, before });
    if (out.length >= limit) break;
  }
  return out;
}

/** Fire after a conversation the user really spoke. Never throws. */
export async function learnFromConversation(db: SupabaseClient, apiKey: string, userId: string, lines: Line[]): Promise<{ used: number; weakened: number }> {
  const result = { used: 0, weakened: 0 };
  try {
    const { data } = await db
      .from('assistant_memories')
      .select('id, subject, fact, category, person, source, strength, created_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(200);
    const rows = (data ?? []) as MemRow[];
    if (!rows.length) return result;

    const answers = lines.filter((l) => l.role === 'assistant').map((l) => l.text).join('\n');
    const used = usedMemories(rows, answers);
    if (used.length) {
      const { error } = await db.rpc('memory_reinforce', { p_user: userId, p_ids: used.map((r) => r.id), p_amount: USE_BUMP, p_used: true, p_evidence: false });
      if (!error) result.used = used.length;
    }

    if (!apiKey) return result;
    for (const m of correctionMoments(lines)) {
      const seen = new Set<string>();
      const cands = [...relatedFacts(rows, m.user), ...usedMemories(rows, m.before, 10)]
        .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
        .slice(0, 10);
      if (!cands.length) continue;
      const verdict = (await ask(apiKey, CORRECTION_PROMPT,
        `ASSISTANT SAID: ${m.before.slice(0, 400)}\nUSER NOW SAYS: ${m.user.slice(0, 400)}\nFACTS:\n${cands.map((r, i) => `${i + 1}. ${rowText(r)}`).join('\n')}`,
      ).catch(() => null)) as { wrong?: unknown } | null;
      const wrong = pickRows(cands, nums(verdict?.wrong));
      if (!wrong.length) continue;
      await db.rpc('memory_weaken', { p_user: userId, p_ids: wrong.map((r) => r.id), p_factor: CORRECTION_FACTOR });
      // A learned habit they turned down goes now, and is never learnt again.
      const learned = wrong.filter((r) => r.source === 'learned').map((r) => r.id);
      if (learned.length) {
        await db.from('assistant_memories').delete().eq('user_id', userId).in('id', learned);
        await db.from('memory_candidates').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('user_id', userId).in('memory_id', learned);
      }
      result.weakened += wrong.length;
    }
    if (result.weakened) console.log(`memory learning: user=${userId} correction weakened ${result.weakened} fact(s)`);
  } catch (e) {
    console.log('memory learning: after-conversation failed:', e instanceof Error ? e.message : e);
  }
  return result;
}

// ── Once a day ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** YYYY-MM-DD in India. Pure. */
export function indiaDay(at: Date | string | number = Date.now()): string {
  return new Date(new Date(at).getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

/** Runs decay, consolidation and reflection at most once per user per India day. */
export async function daily(db: SupabaseClient, apiKey: string, userId: string): Promise<Record<string, unknown>> {
  const today = indiaDay();
  const { data: state } = await db.from('memory_upkeep').select('day, decayed_at, consolidated_at').eq('user_id', userId).maybeSingle();
  if (state?.day === today) return { skipped: 'done today' };
  // Marked first: a failing step is retried tomorrow, not on every launch.
  await db.from('memory_upkeep').upsert({ user_id: userId, day: today }, { onConflict: 'user_id' });
  const out: Record<string, unknown> = {};
  const steps: [string, () => Promise<unknown>][] = [
    ['decay', () => decay(db, userId, state?.decayed_at ?? null)],
    ['consolidate', () => (apiKey ? consolidate(db, apiKey, userId, state?.consolidated_at ?? null) : Promise.resolve(null))],
    ['reflect', () => (apiKey ? reflect(db, apiKey, userId) : Promise.resolve(null))],
  ];
  for (const [name, step] of steps) {
    try {
      out[name] = await step();
    } catch (e) {
      console.log(`memory learning: ${name} failed for user=${userId}:`, e instanceof Error ? e.message : e);
      out[name] = 'failed';
    }
  }
  return out;
}

async function decay(db: SupabaseClient, userId: string, last: string | null): Promise<number> {
  const days = last ? Math.min(30, Math.max(1, Math.round((Date.now() - Date.parse(last)) / 86_400_000))) : 1;
  const { error } = await db.rpc('memory_decay', { p_user: userId, p_days: days });
  if (error) throw new Error(error.message);
  // A learned habit that stopped showing up is let go.
  await db.from('assistant_memories').delete().eq('user_id', userId).eq('source', 'learned').lt('strength', FADED);
  await db.from('memory_upkeep').update({ decayed_at: new Date().toISOString() }).eq('user_id', userId);
  return days;
}

// ── Consolidation ─────────────────────────────────────────────────────────────────────────────────────────────────────

const CONSOLIDATE_PROMPT =
  "You tidy a personal assistant's long-term memory about ONE user. The facts are numbered oldest first: a higher number " +
  'is newer. Each is "subject: fact". Find groups that say the same thing, or that contradict each other about the same ' +
  'attribute of the same person or thing — including one attribute written several ways with more, less or different ' +
  'detail (five versions of where the user lives are ONE group). For each group write ONE fact that keeps every detail ' +
  'that is still true — when they contradict, the NEWEST wins — with its subject. Never merge facts about different ' +
  'people or different attributes, never invent a detail, never drop a detail nothing contradicts. Also correct the ' +
  `category of any fact filed wrongly; the categories are: ${CATEGORIES.join(', ')}. Return STRICT JSON only: ` +
  '{"merge":[{"ids":[1,4],"subject":"…","fact":"…","category":"people"}],"category":[{"id":3,"category":"preferences"}]}' +
  ' — empty arrays when there is nothing to do. No prose, no markdown.';

const cat = (c: unknown): Category | null => ((CATEGORIES as readonly string[]).includes(String(c)) ? (String(c) as Category) : null);
const personKey = (r: MemRow) => String(r.person ?? '').trim().toLowerCase();

export interface ConsolidationPlan {
  merges: { rows: MemRow[]; subject: string; fact: string; category: Category; person: string | null }[];
  categories: { row: MemRow; category: Category }[];
}

/** Checks the model's plan against the rows it was shown; drops anything malformed. Pure. */
export function planConsolidation(rows: MemRow[], plan: unknown): ConsolidationPlan {
  const out: ConsolidationPlan = { merges: [], categories: [] };
  const p = (plan ?? {}) as { merge?: unknown; category?: unknown };
  const used = new Set<string>();
  const at = (n: unknown) => (Number.isInteger(Number(n)) ? rows[Number(n) - 1] ?? null : null);
  for (const m of Array.isArray(p.merge) ? p.merge.slice(0, 15) : []) {
    const group = [...new Set(Array.isArray(m?.ids) ? m.ids : [])].map(at);
    const fact = String(m?.fact ?? '').replace(/\s+/g, ' ').trim();
    const subject = String(m?.subject ?? '').replace(/\s+/g, ' ').trim();
    if (group.length < 2 || group.some((r) => !r || used.has(r.id))) continue;
    const g = group as MemRow[];
    // Facts about two different people never blend.
    const people = new Set(g.map(personKey).filter(Boolean));
    if (people.size > 1) continue;
    if (!fact || fact.length > 300 || subject.length < 2 || subject.length > 80) continue;
    g.forEach((r) => used.add(r.id));
    const newest = g.reduce((a, b) => (String(b.created_at ?? '') > String(a.created_at ?? '') ? b : a));
    out.merges.push({ rows: g, subject, fact, category: cat(m?.category) ?? (newest.category as Category), person: g.find((r) => r.person)?.person ?? null });
  }
  for (const k of Array.isArray(p.category) ? p.category.slice(0, 40) : []) {
    const row = at(k?.id);
    const c = cat(k?.category);
    if (!row || !c || used.has(row.id) || row.category === c) continue;
    out.categories.push({ row, category: c });
  }
  return out;
}

async function consolidate(db: SupabaseClient, apiKey: string, userId: string, since: string | null): Promise<unknown> {
  const { data } = await db
    .from('assistant_memories')
    .select('id, subject, fact, category, person, source, strength, uses, evidence, event_date, created_at, updated_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(150);
  const rows = (data ?? []) as MemRow[];
  if (rows.length < 2) return null;
  const changed = rows.reduce((m, r) => [r.created_at ?? '', r.updated_at ?? ''].reduce((a, b) => (b > a ? b : a), m), '');
  if (since && changed <= since) return { skipped: 'nothing new' };
  const plan = planConsolidation(rows, await ask(apiKey, CONSOLIDATE_PROMPT,
    rows.map((r, i) => `${i + 1}. [${r.category}${r.person ? `, about ${r.person}` : ''}] ${rowText(r).slice(0, 300)}`).join('\n')));
  const now = new Date().toISOString();
  for (const m of plan.merges) {
    const g = m.rows;
    const newest = g.reduce((a, b) => (String(b.created_at ?? '') > String(a.created_at ?? '') ? b : a));
    const { error } = await db.from('assistant_memories').insert({
      user_id: userId,
      subject: m.subject,
      fact: m.fact,
      category: m.category,
      person: m.person,
      event_date: newest.event_date ?? null,
      source: g.every((r) => r.source === 'learned') ? 'learned' : newest.source,
      // The group's own newest time: a merge is not news.
      created_at: newest.created_at,
      strength: Math.min(MAX_STRENGTH, Math.max(...g.map(strengthOf))),
      uses: g.reduce((n, r) => n + (Number(r.uses) || 0), 0),
      evidence: g.reduce((n, r) => n + (Number(r.evidence) || 1), 0),
    });
    if (error) {
      console.log('memory learning: merge insert failed:', error.message);
      continue;
    }
    await db.from('assistant_memories').delete().eq('user_id', userId).in('id', g.map((r) => r.id));
  }
  for (const k of plan.categories) {
    await db.from('assistant_memories').update({ category: k.category, updated_at: now }).eq('user_id', userId).eq('id', k.row.id);
  }
  await db.from('memory_upkeep').update({ consolidated_at: now }).eq('user_id', userId);
  if (plan.merges.length || plan.categories.length) {
    console.log(`memory learning: user=${userId} merged ${plan.merges.reduce((n, m) => n + m.rows.length, 0)} fact(s) into ${plan.merges.length}, re-filed ${plan.categories.length}`);
  }
  return { merged: plan.merges.length, refiled: plan.categories.length };
}

// ── Reflection: habits from what they do ─────────────────────────────────────────────────────────────────────────────

const REFLECT_PROMPT =
  'You read a week of conversation between a user and their personal voice assistant to learn HOW this user likes to be ' +
  'helped — patterns they show without ever saying them. Report a pattern only when the transcript shows it on at least ' +
  'two different days. Good patterns: the app or channel they use for something (messages to family always go by ' +
  'WhatsApp), the answer length that works for them (they cut long answers off), the language they speak in, routines ' +
  '(asks for traffic around 9 am on weekdays). NEVER infer health, religion, caste, politics, sexuality, money, or ' +
  'anything about other people; never repeat a fact the user stated outright (that is stored elsewhere); never guess. ' +
  'Patterns already being tracked are listed with their KEY: reuse the same key when you see the same pattern again. ' +
  'Return STRICT JSON only: [{"key":"short_snake_case","fact":"User … (one sentence, third person)",' +
  '"category":"preferences"|"about_me","days":["YYYY-MM-DD"]}] where days are the dates in this transcript that show ' +
  'it. [] when there is nothing. No prose, no markdown.';

const KEY_RX = /^[a-z][a-z0-9_]{2,60}$/;
const DAY_RX = /^\d{4}-\d{2}-\d{2}$/;

export interface Candidate { key: string; fact: string; kind: string; days: unknown; status: string }

const daysOf = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

/** Folds the model's proposals into the stored candidates. Pure. */
export function mergeCandidates(existing: Candidate[], proposals: unknown, validDays?: Set<string>, minDays = LEARN_MIN_DAYS) {
  const byKey = new Map(existing.map((c) => [c.key, c]));
  const out: { key: string; fact: string; kind: string; days: string[]; isNew: boolean; promote: boolean }[] = [];
  for (const p of Array.isArray(proposals) ? proposals.slice(0, 10) : []) {
    const key = String(p?.key ?? '').trim().toLowerCase();
    const fact = String(p?.fact ?? '').trim();
    if (!KEY_RX.test(key) || !fact || fact.length > 200) continue;
    const days = daysOf(p?.days).filter((d) => DAY_RX.test(d) && (!validDays || validDays.has(d)));
    if (!days.length) continue;
    const old = byKey.get(key);
    if (old && old.status !== 'pending') continue; // kept already, or turned down
    const all = [...new Set([...(old ? daysOf(old.days) : []), ...days])].sort().slice(-30);
    out.push({ key, fact, kind: p?.category === 'about_me' ? 'about_me' : 'preferences', days: all, isNew: !old, promote: all.length >= minDays });
  }
  return out;
}

async function reflect(db: SupabaseClient, apiKey: string, userId: string): Promise<number | null> {
  const since = new Date(Date.now() - REFLECT_WINDOW_DAYS * 86_400_000).toISOString();
  const { data: msgs } = await db
    .from('assistant_messages')
    .select('role, message, at')
    .eq('user_id', userId)
    .gte('at', since)
    .order('at', { ascending: false })
    .limit(400);
  const turns = (msgs ?? []) as { role: string; message: string; at: string }[];
  if (turns.filter((t) => t.role === 'user').length < REFLECT_MIN_USER_LINES) return null;
  // Newest kept first when the transcript has to be cut, then read in order.
  const lines: string[] = [];
  let size = 0;
  for (const t of turns) {
    const line = `${indiaDay(t.at)} ${t.role === 'user' ? 'User' : 'Assistant'}: ${String(t.message || '').replace(/\s+/g, ' ').trim().slice(0, 200)}`;
    if (size + line.length > 9000) break;
    lines.push(line);
    size += line.length + 1;
  }
  lines.reverse();
  const validDays = new Set(turns.map((t) => indiaDay(t.at)));
  const { data: ex } = await db.from('memory_candidates').select('key, fact, kind, days, status').eq('user_id', userId);
  const existing = (ex ?? []) as Candidate[];
  const tracked = existing.filter((c) => c.status === 'pending').map((c) => `${c.key}: ${c.fact}`).slice(0, 30).join('\n') || '(none)';
  const proposals = await ask(apiKey, REFLECT_PROMPT, `TRACKED PATTERNS:\n${tracked}\n\nTRANSCRIPT:\n${lines.join('\n')}`);
  const now = new Date().toISOString();
  let kept = 0;
  for (const c of mergeCandidates(existing, proposals, validDays)) {
    const { error } = await db.from('memory_candidates').upsert(
      { user_id: userId, key: c.key, fact: c.fact, kind: c.kind, days: c.days, status: 'pending', updated_at: now },
      { onConflict: 'user_id,key' },
    );
    if (error || !c.promote) continue;
    // Learnt, not told: a little below a stated fact, so one doubt or a few unused weeks let it go. Never supersede(): a
    // habit seen must not retire what they SAID.
    const { data: row, error: insError } = await db
      .from('assistant_memories')
      .insert({ user_id: userId, subject: 'User', fact: c.fact, category: c.kind, source: 'learned', strength: LEARNED_STRENGTH })
      .select('id')
      .single();
    if (insError) {
      console.log('memory learning: habit insert failed:', insError.message);
      continue;
    }
    await db.from('memory_candidates').update({ status: 'promoted', memory_id: row.id, updated_at: now }).eq('user_id', userId).eq('key', c.key);
    kept++;
  }
  if (kept) console.log(`memory learning: user=${userId} learnt ${kept} habit(s)`);
  return kept;
}

/** The Gemini key memory-ingest and memory-search use. */
export async function geminiKey(db: SupabaseClient): Promise<string> {
  const { data } = await db.rpc('ai_secret_get', { p_name: 'ai_gemini_api_key' });
  return (typeof data === 'string' && data) || Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_GEMINI_API_KEY') || '';
}
