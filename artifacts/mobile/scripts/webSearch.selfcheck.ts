/**
 * Self-check for the assistant's `web_search` tool (services/assistant/webSearch.ts), with a pretend server:
 *   - it is declared for the model (searches as a list, a freshness hint), and phone actions are turned away
 *   - one to three searches reach the server; the model gets the text and the instruction, nothing else
 *   - the same search again is served from memory, a refined one is sent as the thorough kind
 *   - a slow, failing or rate-limited server gives the model an honest instruction instead of silence
 *   - a runaway loop is stopped; the warm-up is sent once and never throws
 *
 *   node --experimental-strip-types scripts/webSearch.selfcheck.ts
 */

import { register } from 'node:module';

register('./assistant-hooks.mjs', import.meta.url);
const g = globalThis as Record<string, any>;
g.__DEV__ = false;
const web = await import(new URL('../services/assistant/webSearch.ts', import.meta.url).href);
const tools = await import(new URL('../services/assistant/tools.ts', import.meta.url).href);

let checks = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  checks++;
  if (!ok) throw new Error(`FAILED: ${name}${detail === undefined ? '' : `\n  got: ${JSON.stringify(detail)}`}`);
}

const calls: { url: string; body: any; auth: string | null }[] = [];
let mode: 'ok' | 'down' | 'slow' | 'limited' | 'failed' = 'ok';
g.fetch = (url: string, init: any) => {
  const body = init?.body ? JSON.parse(init.body) : null;
  calls.push({ url, body, auth: init?.headers?.Authorization ?? null });
  if (body?.warm) return Promise.resolve({ ok: true, status: 204 });
  if (mode === 'slow') return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
  if (mode === 'down') return Promise.reject(new Error('offline'));
  if (mode === 'limited') return Promise.resolve({ ok: false, status: 429, json: async () => ({}) });
  if (mode === 'failed') return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: false, error: 'No results found.', instruction: 'Say you could not reach the internet.' }) });
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({ ok: true, results: `Searched 15 Oct 2026, 14:05 IST.\n1. Goodreturns, 15 Oct (today): Gold rate. ₹14,826 per gram`, provider: 'tavily', credits: 1, took_ms: 2100, cached: false }),
  });
};

const ctx = { getAccessToken: async () => 'user-token', onAction: (l: string) => (g.__label = l) };
const run = (args: Record<string, unknown>) => web.runWebTool('web_search', args, ctx);
const fresh = () => web.resetWebSearchState();

// ─── Declared for both engines ───────────────────────────────────────────────
const decl = tools.FUNCTION_DECLARATIONS.find((d: any) => d.name === 'web_search');
check('web_search is in the tool list sent to the model', !!decl);
check('searches are a list of strings, required', decl.parameters.required.includes('queries') && decl.parameters.properties.queries.type === 'ARRAY' && decl.parameters.properties.queries.items.type === 'STRING');
check('freshness hint is one of four, no topic categories', decl.parameters.properties.recency.enum.join() === 'any,month,week,day' && !decl.parameters.properties.kind);
check('open_website no longer answers questions', /NEVER use it to answer a question/.test(tools.FUNCTION_DECLARATIONS.find((d: any) => d.name === 'open_website').description));
check('other tools are left alone', (await web.runWebTool('open_screen', {}, ctx)) === null);

// ─── What the model asked for ────────────────────────────────────────────────
check('a list', JSON.stringify(web.searchesFrom({ queries: ['A thing', 'Another thing'] })) === '["A thing","Another thing"]');
check('a single string in `queries`', JSON.stringify(web.searchesFrom({ queries: 'Only one' })) === '["Only one"]');
check('the older `query` field', JSON.stringify(web.searchesFrom({ query: 'Old shape' })) === '["Old shape"]');
check('at most three, no repeats, trimmed', JSON.stringify(web.searchesFrom({ queries: ['one one', 'ONE one', ' two  two ', 'three three', 'four four'] })) === '["one one","two two","three three"]');
check('long queries are cut to 120 characters', web.searchesFrom({ queries: ['x'.repeat(300)] })[0].length === 120);
check('junk is ignored', web.searchesFrom({ queries: [5, null, '', ' ', 'a'] }).length === 0);

// ─── Guards ──────────────────────────────────────────────────────────────────
check('no query is refused without calling the server', (await run({ queries: [] })).ok === false && calls.length === 0);
const phoneAction = await run({ queries: ['open WhatsApp'] });
check('"open WhatsApp" is a phone action, not a search', phoneAction.ok === false && /open_app/.test(phoneAction.instruction) && calls.length === 0, phoneAction);
check('one phone action among real searches stops the whole call', (await run({ queries: ['gold rate Mumbai', 'open WhatsApp'] })).ok === false && calls.length === 0);

// ─── A good answer ───────────────────────────────────────────────────────────
const first = await run({ queries: ['gold rate Mumbai 24 carat'], recency: 'day' });
check('the model gets the text and nothing else', first.ok === true && /Goodreturns, 15 Oct \(today\)/.test(first.results) && Object.keys(first).sort().join() === 'ok,results', first);
check('the server gets the searches, the freshness and the depth', calls.length === 1 && calls[0].body.queries.join() === 'gold rate Mumbai 24 carat' && calls[0].body.recency === 'day' && calls[0].body.depth === 'basic' && calls[0].body.query === 'gold rate Mumbai 24 carat' && calls[0].body.kind === 'news', calls[0]);
check('with the user token', calls[0].auth === 'Bearer user-token');
check('screen label is cleared afterwards', g.__label === '');
const again = await run({ queries: ['Gold rate  MUMBAI 24 carat'], recency: 'day' });
check('the same search again comes from memory', again.cached === true && calls.length === 1, again);
const other = await run({ queries: ['gold rate Mumbai 24 carat'], recency: 'week' });
check('a different freshness is a different search', other.ok === true && calls.length === 2, calls.length);
const three = await run({ queries: ['India top news', 'world news', 'business news India'], recency: 'day' });
check('three searches go in one call', three.ok === true && calls[calls.length - 1].body.queries.length === 3, calls[calls.length - 1]);
check('unknown freshness falls back to any', (await run({ queries: ['something brand new'], recency: 'yesterday' })).ok === true && calls[calls.length - 1].body.recency === 'any');

// ─── The loop guard (the minute's budget is used up now: four searches went out) ─────────────
const blocked = await run({ queries: ['a fifth search'] });
check('a fifth search within a minute is refused without calling the server', blocked.ok === false && /Search limit reached/.test(blocked.instruction) && !calls.some((c) => c.body?.queries?.[0] === 'a fifth search'), blocked);

// ─── A refined search is the thorough kind ───────────────────────────────────
fresh();
await run({ queries: ['Balasaheb Thorat'], recency: 'any' });
check('the first search is the ordinary kind', calls[calls.length - 1].body.depth === 'basic');
await run({ queries: ['Balasaheb Thorat MLA Sangamner'], recency: 'any' });
check('a search that repeats half the words of the last one is the thorough kind', calls[calls.length - 1].body.depth === 'advanced', calls[calls.length - 1].body);
await run({ queries: ['Karnataka chief minister'], recency: 'any' });
check('an unrelated search is the ordinary kind again', calls[calls.length - 1].body.depth === 'basic');
fresh();
await run({ queries: ['India top news'], recency: 'day' });
await run({ queries: ['India top news today headlines'], recency: 'day' });
check('news for today is never upgraded (it already runs two searches)', calls[calls.length - 1].body.depth === 'basic');

// ─── Things going wrong ──────────────────────────────────────────────────────
fresh();
mode = 'down';
const down = await run({ queries: ['cricket score india'], recency: 'day' });
check('offline: honest instruction, no throw', down.ok === false && /couldn't reach the internet/.test(down.instruction), down);
mode = 'limited';
const limited = await run({ queries: ['weather in Pune'], recency: 'day' });
check('rate limited: tells the model to answer itself', limited.ok === false && /answer from what you know/.test(limited.instruction), limited);
mode = 'failed';
const failed = await run({ queries: ['nothing works'], recency: 'any' });
check('the server found nothing and says so: its instruction reaches the model', failed.ok === false && /could not reach the internet/.test(failed.instruction), failed);
check('and a failure is not remembered as an answer', (await run({ queries: ['nothing works'], recency: 'any' })).cached !== true);
fresh(); // the failures above used up the minute's budget
mode = 'slow';
const t0 = Date.now();
const slow = await run({ queries: ['a question the server never answers'] });
check('a server that never answers is given up on in about ten seconds', slow.ok === false && Date.now() - t0 >= 9500 && Date.now() - t0 < 13000, { ms: Date.now() - t0, slow });

// ─── Warm-up ─────────────────────────────────────────────────────────────────
fresh();
mode = 'ok';
const before = calls.length;
web.warmWebSearch(async () => 'user-token');
await new Promise((r) => setTimeout(r, 20));
check('warm-up sends {warm:true} once', calls.length === before + 1 && calls[calls.length - 1].body.warm === true, calls.length - before);
web.warmWebSearch(async () => 'user-token');
await new Promise((r) => setTimeout(r, 20));
check('and not again within five minutes', calls.length === before + 1);

console.log(`${checks} checks passed`);
