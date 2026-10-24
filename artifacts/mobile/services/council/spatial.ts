import type { Seat } from './types';

/**
 * Puts a voice in the room. Gemini speaks in 16-bit mono PCM at 24 kHz; this turns one line into a stereo WAV heard from
 * a seat around the listener, the way a real room sounds through earphones:
 *
 *   - equal-power panning between the ears,
 *   - the far ear hears the voice a fraction of a millisecond later (inter-aural time difference) and a little duller
 *     (head shadow),
 *   - a few early reflections off the walls, bouncing in from the other side of the room,
 *   - a short diffuse tail, so the voices sit in one shared space instead of inside the head,
 *   - distance: a far seat is quieter and carries more of the room than the direct voice.
 *
 * Everything is plain arithmetic over the samples, done once per line while the previous line is still playing.
 */
export const SAMPLE_RATE = 24_000;

/** Longest the far ear lags the near one, in seconds (a head is about 17 cm across). */
const MAX_ITD_S = 0.00065;
/** Silence before the voice and after it, so the reflections are not cut off. */
const PRE_ROLL_S = 0.04;
const TAIL_S = 0.28;

/** Wall reflections: delay in seconds, level (relative to the direct voice at room = 1). */
const EARLY = [
  { delay: 0.0131, gain: 0.30 },
  { delay: 0.0213, gain: 0.24 },
  { delay: 0.0297, gain: 0.19 },
  { delay: 0.0416, gain: 0.14 },
];
/** The diffuse tail: feedback combs, slightly different for each ear so the tail is wide. */
const COMBS_L = [0.0371, 0.0493];
const COMBS_R = [0.0409, 0.0547];
const COMB_FEEDBACK = 0.34;
const COMB_DAMP = 0.35;
const TAIL_LEVEL = 0.16;

export interface SpatialOptions {
  seat: Seat;
  /** 0 (a dry booth) to 1 (a hall). */
  room: number;
}

/** Mono 16-bit PCM bytes to floats in -1..1. */
function toFloats(pcm: Uint8Array): Float32Array {
  const n = pcm.length >> 1;
  const view = new DataView(pcm.buffer, pcm.byteOffset, n * 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = view.getInt16(i * 2, true) / 32768;
  return out;
}

/** Interleaved stereo floats to a WAV file's bytes. */
function toWav(left: Float32Array, right: Float32Array, sampleRate: number): Uint8Array {
  const frames = left.length;
  const dataBytes = frames * 4;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const str = (off: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  str(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 2, true); // stereo
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 4, true);
  v.setUint16(32, 4, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, dataBytes, true);
  let off = 44;
  for (let i = 0; i < frames; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    v.setInt16(off, Math.round(l * 32767), true);
    v.setInt16(off + 2, Math.round(r * 32767), true);
    off += 4;
  }
  return new Uint8Array(buf);
}

/** Lowers the whole line if any sample would clip. */
function normalise(left: Float32Array, right: Float32Array) {
  let peak = 0;
  for (let i = 0; i < left.length; i++) {
    const a = Math.abs(left[i]);
    const b = Math.abs(right[i]);
    if (a > peak) peak = a;
    if (b > peak) peak = b;
  }
  if (peak > 0.97) {
    const g = 0.97 / peak;
    for (let i = 0; i < left.length; i++) { left[i] *= g; right[i] *= g; }
  }
}

/** The same voice from the middle of the head: for the room switched off. */
export function renderPlainWav(pcm: Uint8Array, sampleRate = SAMPLE_RATE): Uint8Array {
  const x = toFloats(pcm);
  return toWav(x, x, sampleRate);
}

export function renderSpatialWav(pcm: Uint8Array, opts: SpatialOptions, sampleRate = SAMPLE_RATE): Uint8Array {
  const x = toFloats(pcm);
  const pan = Math.max(-1, Math.min(1, opts.seat.pan));
  const distance = Math.max(0, Math.min(1, opts.seat.distance));
  const room = Math.max(0, Math.min(1, opts.room));

  const pre = Math.round(PRE_ROLL_S * sampleRate);
  const frames = pre + x.length + Math.round(TAIL_S * sampleRate);
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);

  // Direct sound: equal-power pan, the far ear delayed and dulled.
  const theta = ((pan + 1) * Math.PI) / 4;
  const direct = 1 / (1 + 1.1 * distance);
  const gL = Math.cos(theta) * direct;
  const gR = Math.sin(theta) * direct;
  const itd = Math.round(Math.abs(pan) * MAX_ITD_S * sampleRate);
  const delayL = pan > 0 ? itd : 0;
  const delayR = pan < 0 ? itd : 0;
  // One-pole low-pass on the far ear: coefficient 1 passes everything, smaller dulls it more.
  const shadow = 1 - 0.62 * Math.abs(pan);
  let lpL = 0;
  let lpR = 0;
  for (let i = 0; i < x.length; i++) {
    const s = x[i];
    if (pan > 0) { lpL += shadow * (s - lpL); left[pre + i + delayL] += lpL * gL; right[pre + i] += s * gR; }
    else if (pan < 0) { lpR += shadow * (s - lpR); right[pre + i + delayR] += lpR * gR; left[pre + i] += s * gL; }
    else { left[pre + i] += s * gL; right[pre + i] += s * gR; }
  }

  if (room > 0) {
    // Early reflections come mostly from the wall on the other side, so a voice on the left is echoed from the right.
    const wet = room * (0.6 + 0.8 * distance);
    EARLY.forEach((tap, k) => {
      const d = Math.round(tap.delay * sampleRate);
      const side = k % 2 === 0 ? -pan : pan * 0.5;
      const th = ((side + 1) * Math.PI) / 4;
      const tl = Math.cos(th) * tap.gain * wet;
      const tr = Math.sin(th) * tap.gain * wet;
      for (let i = 0; i < x.length; i++) {
        const j = pre + i + d;
        if (j >= frames) break;
        left[j] += x[i] * tl;
        right[j] += x[i] * tr;
      }
    });

    // The tail: damped feedback combs fed by the mono voice, mixed low.
    const level = TAIL_LEVEL * room * (0.7 + 0.6 * distance);
    const comb = (delays: number[], out: Float32Array) => {
      for (const sec of delays) {
        const d = Math.round(sec * sampleRate);
        const buf = new Float32Array(d);
        let idx = 0;
        let damp = 0;
        for (let i = 0; i < frames; i++) {
          const inp = i - pre >= 0 && i - pre < x.length ? x[i - pre] : 0;
          const y = buf[idx];
          damp += COMB_DAMP * (y - damp);
          buf[idx] = inp + damp * COMB_FEEDBACK;
          out[i] += y * level / delays.length;
          idx = idx + 1 === d ? 0 : idx + 1;
        }
      }
    };
    comb(COMBS_L, left);
    comb(COMBS_R, right);
  }

  normalise(left, right);
  return toWav(left, right, sampleRate);
}

/**
 * Seats for a cast around the listener. The director sits straight ahead, a little back; the cast fans out from left to
 * right in front of the listener, the outer seats a touch further away, like the far ends of a table.
 */
export function seatsFor(count: number): Seat[] {
  if (count <= 0) return [];
  if (count === 1) return [{ pan: 0, distance: 0.25 }];
  const seats: Seat[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1); // 0..1 across the table
    const pan = -0.85 + 1.7 * t;
    const distance = 0.2 + 0.35 * Math.abs(pan);
    seats.push({ pan: Math.round(pan * 100) / 100, distance: Math.round(distance * 100) / 100 });
  }
  return seats;
}

export const DIRECTOR_SEAT: Seat = { pan: 0, distance: 0.45 };
