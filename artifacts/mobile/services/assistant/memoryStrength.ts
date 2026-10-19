/**
 * Which remembered facts the assistant is given (pure: checked offline in scripts/memoryStrength.selfcheck.ts).
 *
 * Every fact carries a strength (supabase/functions/_shared/memoryLearning.ts): 1 as stored, up to 3 when it is used and
 * said again, down when it goes unused for weeks or the user corrects it. A row from before the column existed reads as 1
 * and ranks exactly as before: newest first.
 */

/** Below this a fact leaves the prompt; it stays listed in Settings and recallable. */
export const FADED = 0.35;

const DAY = 86_400_000;

export interface Ranked {
  created_at: string;
  strength?: number | null;
  last_used_at?: string | null;
}

export function strengthOf(row: Ranked): number {
  const n = row.strength == null ? NaN : Number(row.strength);
  return Number.isFinite(n) ? n : 1;
}

/** A fact used recently counts as recent. */
function recencyBonus(row: Ranked, now: number): number {
  const at = Math.max(Date.parse(row.created_at) || 0, Date.parse(row.last_used_at ?? '') || 0);
  const age = now - at;
  return age < 7 * DAY ? 1 : age < 30 * DAY ? 0.5 : 0;
}

/** The facts for the prompt, best first: faded ones out, then strength and recency; ties keep the order given. */
export function pickForPrompt<T extends Ranked>(rows: T[], limit: number, now = Date.now()): T[] {
  return rows
    .map((r, i) => ({ r, i, s: strengthOf(r) }))
    .filter((x) => x.s >= FADED)
    .map((x) => ({ ...x, score: x.s - 1 + recencyBonus(x.r, now) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.r);
}
