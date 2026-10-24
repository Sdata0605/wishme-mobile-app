/**
 * Self-check for the agent room's pure parts: the spatial renderer (a voice placed at a seat becomes a stereo WAV that
 * really leans to that side) and the director's plan parsing (tolerant JSON, distinct voices, resolved speakers).
 * No network, no React Native:
 *
 *   node --experimental-strip-types scripts/council.selfcheck.ts
 */
import { register } from 'node:module';

// The app's `@/` alias and extensionless imports, for plain Node.
const root = new URL('../', import.meta.url).href;
register(
  'data:text/javascript,' +
    encodeURIComponent(String.raw`
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) specifier = ${JSON.stringify(root)} + specifier.slice(2);
  try {
    return await next(specifier, context);
  } catch (error) {
    if ((specifier.startsWith('.') || specifier.startsWith('file:')) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      try { return await next(specifier + '.ts', context); } catch {}
      return next(specifier + '.tsx', context);
    }
    throw error;
  }
}`),
);
// Voice samples are `require()`d assets in persona.ts; here they are nothing.
(globalThis as any).require = () => 0;

const spatial: any = await import(new URL('../services/council/spatial.ts', import.meta.url).href);
const director: any = await import(new URL('../services/council/director.ts', import.meta.url).href);
const types: any = await import(new URL('../services/council/types.ts', import.meta.url).href);

let n = 0;
const ok = (name: string, c: boolean, d?: unknown) => {
  n++;
  if (!c) throw new Error('FAILED ' + name + (d !== undefined ? ' ' + JSON.stringify(d) : ''));
};
const near = (a: number, b: number, eps: number) => Math.abs(a - b) <= eps;

// ─── Seats ───────────────────────────────────────────────────────────────────
const seats4 = spatial.seatsFor(4);
ok('four seats', seats4.length === 4);
ok('first seat is far left', seats4[0].pan < -0.8);
ok('last seat is far right', seats4[3].pan > 0.8);
ok('seats are symmetric', near(seats4[0].pan, -seats4[3].pan, 0.01) && near(seats4[1].pan, -seats4[2].pan, 0.01));
ok('outer seats are further away', seats4[0].distance > seats4[1].distance);
ok('one seat sits in the middle', spatial.seatsFor(1)[0].pan === 0);
ok('no seats for nobody', spatial.seatsFor(0).length === 0);
ok('director sits ahead', spatial.DIRECTOR_SEAT.pan === 0);

// ─── Rendering ───────────────────────────────────────────────────────────────
const SR = spatial.SAMPLE_RATE;
ok('24 kHz', SR === 24000);
function tone(seconds: number, hz: number): Uint8Array {
  const n = Math.round(seconds * SR);
  const out = new Uint8Array(n * 2);
  const v = new DataView(out.buffer);
  for (let i = 0; i < n; i++) v.setInt16(i * 2, Math.round(Math.sin((2 * Math.PI * hz * i) / SR) * 12000), true);
  return out;
}
function readWav(wav: Uint8Array) {
  const v = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  const channels = v.getUint16(22, true);
  const rate = v.getUint32(24, true);
  const dataBytes = v.getUint32(40, true);
  const frames = dataBytes / 4;
  let l2 = 0, r2 = 0, peak = 0, nan = false;
  for (let i = 0; i < frames; i++) {
    const l = v.getInt16(44 + i * 4, true) / 32768;
    const r = v.getInt16(46 + i * 4, true) / 32768;
    if (Number.isNaN(l) || Number.isNaN(r)) nan = true;
    l2 += l * l; r2 += r * r;
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
  }
  return { riff: tag(0), wave: tag(8), fmt: tag(12), data: tag(36), channels, rate, frames, total: wav.length, dataBytes, rmsL: Math.sqrt(l2 / frames), rmsR: Math.sqrt(r2 / frames), peak, nan };
}
/** Speech is broadband: a deterministic noise burst, so the per-ear comb delays average out instead of resonating. */
function noise(seconds: number): Uint8Array {
  const n = Math.round(seconds * SR);
  const out = new Uint8Array(n * 2);
  const v = new DataView(out.buffer);
  let seed = 12345;
  for (let i = 0; i < n; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    v.setInt16(i * 2, Math.round(((seed / 0x7fffffff) * 2 - 1) * 9000), true);
  }
  return out;
}
const rel = (a: number, b: number, pct: number) => Math.abs(a - b) <= Math.max(a, b) * pct;
const voice = noise(0.6);
const leftWav = readWav(spatial.renderSpatialWav(voice, { seat: { pan: -0.8, distance: 0.3 }, room: 0.7 }));
ok('valid WAV header', leftWav.riff === 'RIFF' && leftWav.wave === 'WAVE' && leftWav.fmt === 'fmt ' && leftWav.data === 'data', leftWav);
ok('stereo at 24 kHz', leftWav.channels === 2 && leftWav.rate === SR);
ok('header length matches the data', leftWav.total === 44 + leftWav.dataBytes);
ok('pre-roll and tail were added', leftWav.frames > voice.length / 2 + 0.25 * SR);
ok('no NaN samples', !leftWav.nan);
ok('never clips', leftWav.peak <= 0.971);
ok('a voice on the left is louder in the left ear', leftWav.rmsL > leftWav.rmsR * 1.5, { l: leftWav.rmsL, r: leftWav.rmsR });

const rightWav = readWav(spatial.renderSpatialWav(voice, { seat: { pan: 0.8, distance: 0.3 }, room: 0.7 }));
ok('a voice on the right is louder in the right ear', rightWav.rmsR > rightWav.rmsL * 1.5, { l: rightWav.rmsL, r: rightWav.rmsR });
ok('left and right seats mirror each other', rel(rightWav.rmsR, leftWav.rmsL, 0.08) && rel(rightWav.rmsL, leftWav.rmsR, 0.08), { leftWav, rightWav });

const centre = readWav(spatial.renderSpatialWav(voice, { seat: { pan: 0, distance: 0.2 }, room: 0.7 }));
ok('a voice ahead is about equal in both ears', rel(centre.rmsL, centre.rmsR, 0.08), { l: centre.rmsL, r: centre.rmsR });

const far = readWav(spatial.renderSpatialWav(voice, { seat: { pan: 0, distance: 1 }, room: 0.7 }));
ok('a far seat is quieter', far.rmsL < centre.rmsL);

const dry = readWav(spatial.renderSpatialWav(voice, { seat: { pan: -0.8, distance: 0.3 }, room: 0 }));
ok('no room means nothing reaches the far ear but the shadowed direct sound', dry.rmsR < leftWav.rmsR);

const plain = readWav(spatial.renderPlainWav(voice));
ok('plain render is identical in both ears', near(plain.rmsL, plain.rmsR, 1e-6) && plain.frames === voice.length / 2);
const sine = readWav(spatial.renderSpatialWav(tone(0.5, 440), { seat: { pan: -0.5, distance: 0.3 }, room: 0.7 }));
ok('a pure tone renders cleanly too', !sine.nan && sine.peak <= 0.971 && sine.rmsL > sine.rmsR);
ok('empty audio renders an empty but valid file', readWav(spatial.renderSpatialWav(new Uint8Array(0), { seat: { pan: 0, distance: 0 }, room: 0.5 })).riff === 'RIFF');

// ─── Director parsing ────────────────────────────────────────────────────────
ok('json inside fences', director.extractJson('Here you go:\n```json\n{"a": 1}\n```').a === 1);
ok('json inside prose', director.extractJson('Sure. {"turns": [{"speaker": "x", "cue": "y"}]} Done.').turns.length === 1);
let threw = false;
try { director.extractJson('no json here'); } catch { threw = true; }
ok('no json throws', threw);

const scenario = {
  scenario: 'A tenancy dispute over a leaking roof and unpaid rent.',
  agentCount: 4,
  roles: ['Counsel for the landlord', 'Counsel for the tenant', 'Judge', 'Decision bench'],
  directorRole: 'Court clerk',
  userPart: 'Law student in the gallery',
  language: 'English',
  spatial: true,
};
const identity = { name: 'Nova', voice: 'Kore', userName: 'Dhanush' };

const prompt = director.castPrompt(identity, scenario);
ok('cast prompt asks for the right number of agents', prompt.includes('Exactly 4 agents'));
ok("cast prompt never offers the director's own voice", !prompt.includes('Kore (') && prompt.includes('Puck ('));
ok('cast prompt carries the roles', prompt.includes('Counsel for the tenant'));

const raw = {
  title: 'Sharma v. Rao',
  setting: 'A civil court in Bengaluru',
  cast: [
    { name: 'Anita Sharma', role: 'Counsel for the landlord', goal: 'Win arrears', style: 'Formal', voice: 'Kore', gender: 'female' },
    { name: 'Vikram Rao', role: 'Counsel for the tenant', goal: 'Defend the tenant', style: 'Sharp', voice: 'Puck', gender: 'male' },
    { name: 'Justice Meera Iyer', role: 'Judge', goal: 'Decide fairly', style: 'Measured', voice: 'Puck', gender: 'female' },
  ],
  turns: [
    { speaker: 'director', cue: 'Open the hearing.' },
    { speaker: 'Anita Sharma', cue: 'Opening statement.' },
    { speaker: 'anita sharma', cue: 'Should be dropped: same speaker twice.' },
    { speaker: 'Vikram', cue: 'Reply.' },
    { speaker: 'Judge', cue: 'Ask a question.' },
    { speaker: 'Nobody Known', cue: 'Dropped: unknown speaker.' },
    { speaker: 'The clerk', cue: 'Close.' },
  ],
  decisionBy: 'Justice Meera Iyer',
};
const plan = director.parsePlan(raw, scenario, identity);
ok('cast topped up to the requested count', plan.cast.length === 4, plan.cast.map((c: any) => c.name));
ok('fourth agent took the fourth role', plan.cast[3].role === 'Decision bench');
const voices = plan.cast.map((c: any) => c.voice);
ok("the director's voice is never reused", !voices.includes('Kore'), voices);
ok('all voices are distinct', new Set(voices).size === voices.length, voices);
ok('a female agent keeps a female voice when hers was taken', plan.cast[2].gender === 'female' && voices[2] !== 'Puck');
ok('ids are slugs', plan.cast[0].id === 'anita-sharma-1');
ok('seats assigned', plan.cast.every((c: any) => typeof c.seat.pan === 'number'));
ok('decision maker resolved by name', plan.decisionBy === plan.cast[2].id);
const speakers = plan.turns.map((t: any) => t.speaker);
ok('turns: director, by name, by first name, by role, by "clerk" as director', JSON.stringify(speakers) === JSON.stringify([types.DIRECTOR_ID, plan.cast[0].id, plan.cast[1].id, plan.cast[2].id, types.DIRECTOR_ID]), speakers);

const noTurns = director.parsePlan({ ...raw, turns: [] }, scenario, identity);
ok('missing turns fall back to a sound order', noTurns.turns.length >= 6 && noTurns.turns[0].speaker === types.DIRECTOR_ID && noTurns.turns[noTurns.turns.length - 1].speaker === types.DIRECTOR_ID);
ok('fallback has nobody twice in a row', noTurns.turns.every((t: any, i: number) => i === 0 || t.speaker !== noTurns.turns[i - 1].speaker));

threw = false;
try { director.parsePlan({ cast: [] }, scenario, identity); } catch { threw = true; }
ok('an empty cast is refused', threw);

const d = director.parseDecision({ summary: 'S', decision: 'D', keyPoints: ['a', 'b', '', 3], nextSteps: 'nope' });
ok('decision parsed tolerantly (blank and non-text points dropped)', d.summary === 'S' && d.decision === 'D' && d.keyPoints.length === 2 && d.nextSteps.length === 0, d);

const agentPrompt = director.agentSystemPrompt(plan.cast[1], plan, scenario, identity);
ok('agent prompt names the others and the user', agentPrompt.includes('Anita Sharma') && agentPrompt.includes('Dhanush') && !agentPrompt.includes('Vikram Rao (Counsel for the tenant);'));
const tp = director.turnPrompt([{ name: 'Nova', text: 'Welcome.' }], 'Reply now.', 'Vikram Rao', true);
ok('turn prompt carries the room and the cue', tp.includes('Nova: Welcome.') && tp.includes('Reply now.'));

console.log(`council self-check: ${n} checks passed`);
