/**
 * Self-check for which remembered facts the assistant is given (no network):
 *
 *   node --experimental-strip-types scripts/memoryStrength.selfcheck.ts
 */

import { pickForPrompt, strengthOf } from '../services/assistant/memoryStrength.ts';

let checks = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  checks++;
  if (!ok) throw new Error(`FAILED: ${name}${detail === undefined ? '' : `\n  got: ${JSON.stringify(detail)}`}`);
}

const now = Date.parse('2026-10-19T10:00:00Z');
const daysAgo = (n: number) => new Date(now - n * 86_400_000).toISOString();
const row = (id: string, age: number, strength?: number | null, usedAgo?: number) => ({
  id,
  created_at: daysAgo(age),
  strength,
  last_used_at: usedAgo == null ? null : daysAgo(usedAgo),
});

check('a row from before the column reads as 1', strengthOf(row('a', 1)) === 1 && strengthOf(row('a', 1, null)) === 1);

const old = [row('n1', 1), row('n2', 10), row('n3', 60)];
check('without strengths the order is newest first', pickForPrompt(old, 10, now).map((r) => r.id).join() === 'n1,n2,n3');

const ids = pickForPrompt([row('fresh', 1), row('faded', 2, 0.2), row('strong-old', 90, 2.6), row('weak', 3, 0.5)], 10, now).map((r) => r.id);
check('a faded fact leaves the prompt', !ids.includes('faded'), ids);
check('a fact used often outranks a new one', ids[0] === 'strong-old', ids);
check('a doubted fact ranks below an untouched one', ids.indexOf('weak') > ids.indexOf('fresh'), ids);

const used = pickForPrompt([row('stale', 60), row('used-lately', 60, 1, 2)], 10, now).map((r) => r.id);
check('a fact used recently counts as recent', used[0] === 'used-lately', used);

check('the limit holds', pickForPrompt(old, 2, now).length === 2);

console.log(`memoryStrength: ${checks} checks passed`);
