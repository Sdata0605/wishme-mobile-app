/**
 * Self-check for how the Gemini client gets its voice token (no real network): backup requests, no restart on a slow answer,
 * a 401 signing the user out, and the spare token for reconnects.
 *
 *   node --experimental-transform-types scripts/voiceToken.selfcheck.ts
 */

import { register } from 'node:module';

const FAKES: Record<string, string> = {
  '@speechmatics/expo-two-way-audio': `
    export const addExpoTwoWayAudioEventListener = () => ({ remove() {} });
    export const getMicrophonePermissionsAsync = async () => ({ granted: true });
    export const initialize = async () => true;
    export const playPCMData = () => {};
    export const requestMicrophonePermissionsAsync = async () => ({ granted: true });
    export const tearDown = () => {};
    export const toggleRecording = () => true;`,
  expo: `export const requireOptionalNativeModule = () => null;`,
  'react-native': `export const Platform = { OS: 'android' };`,
  '@/constants/supabase': `export const SUPABASE_URL = 'https://example.supabase.co'; export const SUPABASE_ANON_KEY = 'anon';`,
  '@/services/bootLog': `export const bootStamp = () => 'app+0s';`,
  '@react-native-async-storage/async-storage': `
    const store = (globalThis.__store ??= new Map());
    export default {
      getItem: async (k) => (store.has(k) ? store.get(k) : null),
      setItem: async (k, v) => { store.set(k, v); },
      removeItem: async (k) => { store.delete(k); },
    };`,
};
register('data:text/javascript,' + encodeURIComponent(`
  const FAKES = ${JSON.stringify(FAKES)};
  export async function resolve(specifier, context, next) {
    if (specifier in FAKES) return { url: 'fake:' + encodeURIComponent(specifier), shortCircuit: true };
    try { return await next(specifier, context); } catch (e) { if (specifier.startsWith('.') && !/\\.[cm]?[jt]s$/.test(specifier)) return next(specifier + '.ts', context); throw e; }
  }
  export async function load(url, context, next) {
    if (url.startsWith('fake:')) return { format: 'module', source: FAKES[decodeURIComponent(url.slice(5))], shortCircuit: true };
    return next(url, context);
  }`));

(globalThis as Record<string, unknown>).__DEV__ = false;
const { GeminiLiveClient } = await import(new URL('../services/geminiLive/client.ts', import.meta.url).href);

let checks = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  checks++;
  if (!ok) throw new Error(`FAILED: ${name}${detail === undefined ? '' : `\n  got: ${JSON.stringify(detail)}`}`);
}

type Plan = { after: number; status?: number; fail?: boolean };
let plans: Plan[] = [];
let sent: { body: Record<string, unknown>; at: number }[] = [];
let t0 = 0;
const okBody = { engine: 'gemini', token: 'tok-1', model: 'gemini-x', fallback_engine: 'sarvam', relay_url: 'wss://r', timing: { total_ms: 500 } };

(globalThis as Record<string, any>).fetch = (url: string, init: { body: string; signal: AbortSignal }) => {
  const plan = plans[sent.length] ?? plans[plans.length - 1];
  sent.push({ body: JSON.parse(init.body), at: Date.now() - t0 });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (plan.fail) return reject(new Error('network'));
      const status = plan.status ?? 200;
      resolve({ status, ok: status >= 200 && status < 300, json: async () => (status === 200 ? okBody : {}) });
    }, plan.after);
    init.signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new Error('aborted'));
    });
  });
};

let authRejected = 0;
let currentUser: string | undefined = 'u1';
const make = () => {
  const c: any = new GeminiLiveClient({ getAccessToken: async () => 'jwt', getUserId: () => currentUser, onAuthRejected: () => authRejected++ });
  c.wantWarm = true;
  return c;
};
const run = async (p: Plan[]) => {
  plans = p;
  sent = [];
  t0 = Date.now();
  const c = make();
  let token = '';
  let error = '';
  try {
    token = await c.fetchToken();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  return { c, token, error, ms: Date.now() - t0 };
};

// 1. A quick answer: one request only.
let r = await run([{ after: 100 }]);
check('a quick answer needs one request', r.token === 'tok-1' && sent.length === 1 && r.ms < 600, { ...r, n: sent.length });
check('the request asks for a Gemini token and says it is not a spare', sent[0].body.want === 'gemini' && sent[0].body.spare === false);

// 2. The first request is slow: a backup joins at 1.2 s and the first good answer wins, with nothing restarted.
r = await run([{ after: 4000 }, { after: 300 }]);
check('a slow first request is helped by a backup, not cancelled', r.token === 'tok-1' && sent.length === 2 && sent[1].at >= 1100 && sent[1].at < 1700, sent);
check('it finished well before the slow request would have', r.ms > 1400 && r.ms < 2200, r.ms);

// 3. A failed first request: the next one starts at once.
r = await run([{ after: 50, fail: true }, { after: 100 }]);
check('a failed request is replaced straight away', r.token === 'tok-1' && sent.length === 2 && sent[1].at < 600, sent);

// 4. Everything fails: it gives up after the limit, with the honest message.
r = await run([{ after: 20, status: 500 }]);
check('four failures end it', r.token === '' && sent.length === 4 && /unavailable \(500\)/.test(r.error), { n: sent.length, e: r.error });
r = await run([{ after: 20, fail: true }]);
check('a dead network says the service is slow', /slow to respond/.test(r.error) && sent.length === 4, { n: sent.length, e: r.error });

// 5. A refused login signs the user out of the voice service and stops.
authRejected = 0;
r = await run([{ after: 50, status: 401 }]);
check('a 401 tells the app and ends the attempt', authRejected === 1 && /login has ended/.test(r.error) && sent.length === 1, { authRejected, e: r.error });

// 6. A spare token is used with no request at all.
plans = [{ after: 100 }];
sent = [];
let c = make();
c.spare = { data: { ...okBody, token: 'spare-tok' }, at: Date.now() };
const tok = await c.fetchToken();
check('a spare token is used without a request', tok === 'spare-tok' && sent.length === 0, { tok, n: sent.length });
check('and it is used only once', c.spare === null);

// 7. A spare that is too old is ignored.
sent = [];
c = make();
c.spare = { data: { ...okBody, token: 'old-spare' }, at: Date.now() - 12 * 3600_000 };
const fresh = await c.fetchToken();
check('an old spare is replaced by a fresh token', fresh === 'tok-1' && sent.length === 1, { fresh, n: sent.length });

// 8. Fetching the spare asks for a spare and keeps it.
sent = [];
plans = [{ after: 50 }];
c = make();
c.ensureSpare();
await new Promise((res) => setTimeout(res, 400));
check('the spare request is marked as a spare and is kept', sent[0]?.body.spare === true && c.spare?.data.token === 'tok-1', { body: sent[0]?.body, spare: !!c.spare });
c.shutdown();
check('shutting down forgets the spare', c.spare === null);

// 9. The spare is also saved on the phone, so the next launch needs no request.
const store = (globalThis as Record<string, any>).__store as Map<string, string>;
store.clear();
sent = [];
plans = [{ after: 50 }];
c = make();
c.ensureSpare();
await new Promise((res) => setTimeout(res, 400));
const savedRaw = store.get('gemini_live_saved_token_v1');
const saved = savedRaw ? JSON.parse(savedRaw) : null;
check('a made spare is saved on the phone for this user', saved?.sub === 'u1' && saved?.data?.token === 'tok-1' && typeof saved?.at === 'number', saved);
check('the saved token does not keep the server timing', saved && !('timing' in saved.data));
c.shutdown(); // stops the refresh timer, which would keep this script running

// 10. A new launch (a new client) connects with it, with no request, and the saved copy is removed (it is single-use).
sent = [];
const launch = make();
const first = await launch.fetchToken();
check('a new launch uses the saved token without a request', first === 'tok-1' && sent.length === 0, { first, n: sent.length });
await new Promise((res) => setTimeout(res, 50));
check('and it is removed from the phone once used', !store.has('gemini_live_saved_token_v1'));

// 11. Someone else's token is never used.
store.set('gemini_live_saved_token_v1', JSON.stringify({ data: { ...okBody, token: 'theirs' }, at: Date.now(), sub: 'u2' }));
sent = [];
const other = await make().fetchToken();
check("another person's saved token is ignored", other === 'tok-1' && sent.length === 1, { other, n: sent.length });
store.set('gemini_live_saved_token_v1', JSON.stringify({ data: { ...okBody, token: 'anon' }, at: Date.now(), sub: 'u1' }));
currentUser = undefined;
sent = [];
check('with nobody known yet it is not used', (await make().fetchToken()) === 'tok-1' && sent.length === 1);
currentUser = 'u1';

// 12. A saved token that is too old is not used.
store.set('gemini_live_saved_token_v1', JSON.stringify({ data: { ...okBody, token: 'stale' }, at: Date.now() - 12 * 3600_000, sub: 'u1' }));
sent = [];
check('a token older than the window is replaced by a fresh one', (await make().fetchToken()) === 'tok-1' && sent.length === 1);

// 13. Logout forgets it.
store.set('gemini_live_saved_token_v1', JSON.stringify({ data: okBody, at: Date.now(), sub: 'u1' }));
c = make();
c.forgetSavedToken();
await new Promise((res) => setTimeout(res, 50));
check('logout removes the saved token', !store.has('gemini_live_saved_token_v1') && c.spare === null);

console.log(`${checks} checks passed`);
