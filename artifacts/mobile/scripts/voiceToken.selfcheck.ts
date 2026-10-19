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
const make = () => {
  const c: any = new GeminiLiveClient({ getAccessToken: async () => 'jwt', onAuthRejected: () => authRejected++ });
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
c.spare = { data: { ...okBody, token: 'old-spare' }, at: Date.now() - 16 * 60_000 };
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

console.log(`${checks} checks passed`);
