/**
 * PROMISES FROM A CONVERSATION (2026-10-19, ported from MyAssistant commitments/service.js).
 *
 * "I'll send Ravi the proposal by Friday." A busy person is judged on whether those happen, and they are exactly the
 * things that get lost: said in passing, never written down. When a conversation with the assistant ends, memory-ingest
 * hands its lines here; promises the USER made are filed in assistant_promises with a person and a deadline.
 *
 * False positives are worse than misses: a list full of things the user never promised stops being read. So a cheap
 * pattern gates the model call (most conversations promise nothing), and the prompt demands a FIRST-PERSON, SPECIFIC,
 * FUTURE undertaking. Never throws.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { pickModels } from './geminiModels.ts';

const API = 'https://generativelanguage.googleapis.com/v1beta';

/** Cheap gate before spending a model call. */
export const PROMISE_RX =
  /\b(i'?ll|i will|i'?m going to|i shall|let me|i'?ve got to|i need to|i have to|i must|i promised|i told \w+ i'?d|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|tonight|evening|morning|next week)|before (the )?(eod|end of day|tomorrow))\b|करूंगा|करूँगा|करूंगी|भेज दूंगा|भेज दूँगा/i;

const PROMPT = `You extract PROMISES the user made about their own future actions.

A promise is FIRST PERSON, SPECIFIC and FUTURE: something the user said THEY would do, usually for someone. It qualifies:
  "I'll send Ravi the proposal by Friday"  -> {"text":"Send Ravi the proposal","owed_to":"Ravi","due":"<that Friday>"}
  "tell her I'll call back tomorrow"      -> {"text":"Call her back","owed_to":"","due":"<tomorrow>"}
It does NOT qualify: a wish or musing ("I should exercise more"), a question, something someone else promised, a task the
user asked the assistant to do right now (set a reminder, send a message), or something already done.

Rewrite each as a short task starting with a verb. due is an ISO date (YYYY-MM-DD) or date-time with +05:30 when a time was
said, or null. quote is the user's own sentence. At most 5. Today is {TODAY}.
ALREADY NOTED (never repeat one of these, even in other words):
{HAVE}
Return only JSON: {"promises":[{"text":"","owed_to":"","due":null,"quote":""}]}`;

export interface Line { role: 'user' | 'assistant'; text: string }

const clean = (s: unknown, max: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Checks the model's answer. Pure. */
export function cleanPromises(parsed: unknown, have: string[]): { text: string; owed_to: string; due_at: string | null; quote: string }[] {
  const seen = new Set(have.map(norm));
  const out: { text: string; owed_to: string; due_at: string | null; quote: string }[] = [];
  const list = (parsed as { promises?: unknown })?.promises;
  for (const p of Array.isArray(list) ? list.slice(0, 5) : []) {
    const text = clean(p?.text, 300);
    if (text.length < 4 || seen.has(norm(text))) continue;
    seen.add(norm(text));
    const raw = clean(p?.due, 40);
    const d = raw ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T23:59:00+05:30` : raw) : null;
    out.push({ text, owed_to: clean(p?.owed_to, 80), due_at: d && !Number.isNaN(d.getTime()) ? d.toISOString() : null, quote: clean(p?.quote, 300) });
  }
  return out;
}

export async function extractPromises(db: SupabaseClient, apiKey: string, userId: string, lines: Line[], source: 'chat' | 'call'): Promise<number> {
  try {
    const said = lines.filter((l) => l.role === 'user').map((l) => l.text);
    if (!apiKey || !said.some((t) => PROMISE_RX.test(t))) return 0;
    const convo = lines.map((l) => `${l.role === 'user' ? 'User' : 'Assistant'}: ${l.text.replace(/\s+/g, ' ').trim()}`).join('\n').slice(0, 12_000);
    const { data: open } = await db.from('assistant_promises').select('text').eq('user_id', userId).eq('status', 'open').limit(200);
    const have = (open ?? []).map((r) => String(r.text));
    const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
    let parsed: unknown = null;
    for (const model of await pickModels(apiKey, Deno.env.get('MEMORY_MODEL') || undefined)) {
      try {
        const res = await fetch(`${API}/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: PROMPT.replace('{TODAY}', today).replace('{HAVE}', have.slice(0, 40).join('\n') || '(none)') }] },
            contents: [{ role: 'user', parts: [{ text: convo }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
          }),
          signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) continue;
        const body = await res.json();
        const text = (body.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
        parsed = JSON.parse(text.replace(/^```json\s*|```$/g, '').trim());
        break;
      } catch {
        /* the next model */
      }
    }
    if (!parsed) return 0;
    const rows = cleanPromises(parsed, have);
    if (!rows.length) return 0;
    const { error } = await db.from('assistant_promises').insert(rows.map((r) => ({ ...r, user_id: userId, source })));
    if (error) {
      console.log('promises: insert failed:', error.message);
      return 0;
    }
    return rows.length;
  } catch (e) {
    console.log('promises: extraction failed:', e instanceof Error ? e.message : e);
    return 0;
  }
}
