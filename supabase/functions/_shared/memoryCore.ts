/**
 * What the assistant's long-term memory needs from Gemini: embeddings (to find passages by meaning), fact extraction (the lasting
 * things a user says about their life) and a few pure helpers (cutting a conversation into passages, picking search words).
 * Used by memory-ingest (saving) and memory-search (finding).
 */

import { pickModels } from './geminiModels.ts';

export const EMBED_DIMS = 768;
const API = 'https://generativelanguage.googleapis.com/v1beta';

export const CATEGORIES = ['about_me', 'people', 'goals', 'events', 'preferences', 'follow_up', 'work', 'feelings', 'places', 'calls', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Line { role: 'user' | 'assistant'; text: string; at?: string }
export interface Fact { subject: string; fact: string; category: Category; person: string | null; event_date: string | null; supersedes: string[] }

// ── Embeddings ────────────────────────────────────────────────────────────────────────────────────────────────────────────

let embedModelCache: { at: number; id: string } | null = null;

/** The best embedding model this key can see (discovered, so a retired model fixes itself). */
async function embeddingModel(apiKey: string): Promise<string> {
  if (embedModelCache && Date.now() - embedModelCache.at < 60 * 60_000) return embedModelCache.id;
  let id = 'gemini-embedding-001';
  try {
    const res = await fetch(`${API}/models?key=${apiKey}&pageSize=200`, { signal: AbortSignal.timeout(10_000) });
    if (res.ok) {
      const body = await res.json();
      const names = ((body.models ?? []) as { name: string; supportedGenerationMethods?: string[] }[])
        .filter((m) => (m.supportedGenerationMethods ?? []).some((x) => /embed/i.test(x)))
        .map((m) => m.name.replace(/^models\//, ''));
      id = names.find((n) => n === 'gemini-embedding-001') ?? names.find((n) => /gemini-embedding/.test(n)) ?? names.find((n) => /text-embedding-004/.test(n)) ?? names[0] ?? id;
    }
  } catch {
    /* use the default */
  }
  embedModelCache = { at: Date.now(), id };
  return id;
}

/** One vector (768 numbers) per text, in the same order. Throws if Gemini cannot be reached. */
export async function embedTexts(apiKey: string, texts: string[], task: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'): Promise<number[][]> {
  if (!texts.length) return [];
  const model = await embeddingModel(apiKey);
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 50) {
    const batch = texts.slice(i, i + 50);
    const res = await fetch(`${API}/models/${model}:batchEmbedContents?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: batch.map((t) => ({ model: `models/${model}`, content: { parts: [{ text: t.slice(0, 6000) }] }, taskType: task, outputDimensionality: EMBED_DIMS })),
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`embedding ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = await res.json();
    for (const e of (body.embeddings ?? []) as { values: number[] }[]) out.push(e.values);
  }
  if (out.length !== texts.length) throw new Error('embedding count mismatch');
  return out;
}

/** The text form PostgREST accepts for a vector column. */
export const vectorLiteral = (v: number[]) => `[${v.map((x) => Number(x.toFixed(6))).join(',')}]`;

// ── Search words ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const STOP = new Set(
  ('the a an is are was were be been what whats did do does done he she they them it its his her their about said say says tell told me my mine i you your we our of to in on at for with and or but that this those these when who whom how why which there here ' +
    'ago day days week weeks last any some from by as if then than so just please can could would should will shall have has had get got want know remember recall ' +
    'क्या था थी थे है हैं ने को से का की के में और मुझे बताओ बताइए कब कौन कैसे').split(' '),
);

/** Words worth searching for: letters and digits only (so they are safe in a text-search query), no filler. */
export function searchTerms(query: string): string[] {
  const words = (query.toLowerCase().match(/[\p{L}\p{M}\p{N}]{2,}/gu) ?? []).filter((w) => !STOP.has(w));
  return [...new Set(words)].slice(0, 12);
}

// ── Cutting a conversation into passages ──────────────────────────────────────────────────────────────────────────────────

const label = (role: Line['role'], source: 'assistant' | 'call', person: string | null) =>
  role === 'assistant' ? 'Assistant' : source === 'call' ? person || 'The other person' : 'User';

/** Passages of a few lines each (about 700 characters), each starting with who and when, so a name or a date finds it. */
export function chunkLines(lines: Line[], source: 'assistant' | 'call', person: string | null, when: Date): { content: string; at: Date }[] {
  const day = when.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const header = source === 'call' ? `Phone call with ${person || 'someone'} on ${day}` : `Conversation with the assistant on ${day}`;
  const chunks: { content: string; at: Date }[] = [];
  let buf: string[] = [];
  let size = 0;
  let at = when;
  const flush = () => {
    if (!buf.length) return;
    chunks.push({ content: `${header}\n${buf.join('\n')}`, at });
    buf = [];
    size = 0;
  };
  for (const l of lines) {
    const text = l.text.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const row = `${label(l.role, source, person)}: ${text}`;
    if (size + row.length > 700 && buf.length) flush();
    if (!buf.length) at = l.at ? new Date(l.at) : when;
    buf.push(row.slice(0, 1500));
    size += row.length;
  }
  flush();
  return chunks;
}

// ── Facts ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const GUIDE = `You keep the long-term memory of a personal voice assistant. Read the conversation and list the LASTING facts worth remembering, as short plain sentences.

Categories:
- about_me: the user's own name, age, birthday, where they live or are from, languages, how they like to be addressed
- people: someone in the user's life (family, friends, colleagues): who they are, their relationship, birthday, job, city, what the user said about them
- goals: dreams, ambitions, things the user wants to achieve, buy or learn
- events: something happening on a date (exam, interview, trip, wedding, deadline, appointment), with the date in event_date when it was said
- preferences: likes, dislikes, food, diet, music, sport, teams, hobbies, routines, how they like answers
- follow_up: something unfinished the assistant should ask about later (waiting for a result, plans to call someone, a promise)
- work: job, studies, business, workplace
- feelings: a lasting concern or mood the user shared about their life (not a passing remark)
- places: places that matter to the user
- calls: for phone calls the assistant made: what the other person said, promised or decided (set person to their name)
- other: anything else lasting

Rules:
- Only what was actually said. Never guess or invent. A fact must be true after this conversation ends.
- Anything the user explicitly asks to remember, note, save or not forget is kept, whoever it is about.
- Never save passwords, OTPs, card, bank or ID numbers.
- Do not save health, religion, politics or sexual matters unless the user clearly asked to remember them.
- Skip small talk, questions, and things the assistant said itself unless the user confirmed them.
- subject is who or what it is about (a name, or "User"); fact is one sentence of at most 250 characters, in the language of the conversation.
- If a fact replaces or corrects one of the EXISTING facts listed below (new city, new job, a changed date), put that fact's id in supersedes. Do not repeat a fact that already exists.
- At most 12 facts. If there is nothing worth keeping, return an empty list.
Return only JSON: {"facts":[{"subject":"","fact":"","category":"","person":null,"event_date":null,"supersedes":[]}]}`;

const clean = (s: unknown, max: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export async function extractFacts(
  apiKey: string,
  lines: Line[],
  context: { source: 'assistant' | 'call'; person: string | null; today: string },
  existing: { id: string; subject: string; fact: string }[],
): Promise<Fact[]> {
  const convo = lines
    .map((l) => `${label(l.role, context.source, context.person)}: ${l.text.replace(/\s+/g, ' ').trim()}`)
    .join('\n')
    .slice(0, 24_000);
  if (!convo) return [];
  const known = existing.length ? existing.map((m) => `[${m.id}] ${m.subject}: ${m.fact}`).join('\n') : '(none)';
  const prompt = `${GUIDE}\n\nToday is ${context.today}.\nThis was ${context.source === 'call' ? `a phone call the assistant made to ${context.person || 'someone'} for the user` : 'a conversation between the user and the assistant'}.\n\nEXISTING facts:\n${known}\n\nCONVERSATION:\n${convo}`;
  const models = await pickModels(apiKey, Deno.env.get('MEMORY_MODEL') || undefined);
  const known_ids = new Set(existing.map((m) => m.id));
  for (const model of models) {
    try {
      const res = await fetch(`${API}/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } }),
        signal: AbortSignal.timeout(40_000),
      });
      if (!res.ok) continue;
      const body = await res.json();
      const text = (body.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
      const parsed = JSON.parse(text.replace(/^```json\s*|```$/g, '').trim());
      const facts: Fact[] = [];
      for (const f of Array.isArray(parsed?.facts) ? parsed.facts : []) {
        const subject = clean(f.subject, 80);
        const fact = clean(f.fact, 300);
        if (subject.length < 2 || fact.length < 2) continue;
        const category = (CATEGORIES as readonly string[]).includes(f.category) ? (f.category as Category) : 'other';
        const date = typeof f.event_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.event_date) ? f.event_date : null;
        const supersedes = (Array.isArray(f.supersedes) ? f.supersedes : []).map(String).filter((id: string) => known_ids.has(id));
        facts.push({ subject, fact, category, person: f.person ? clean(f.person, 80) : null, event_date: date, supersedes });
        if (facts.length >= 12) break;
      }
      return facts;
    } catch {
      /* try the next model */
    }
  }
  return [];
}
