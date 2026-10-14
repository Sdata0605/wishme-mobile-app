/**
 * PCM helpers for the Gemini Live pipeline.
 *
 * Gemini Live sends audio as 16-bit mono PCM at 24 kHz, while the native
 * two-way audio module (with echo cancellation) plays 16 kHz, so replies are
 * downsampled here. Microphone audio is already 16 kHz and is sent as-is.
 */

export const MIC_SAMPLE_RATE = 16000;
export const GEMINI_OUTPUT_SAMPLE_RATE = 24000;

const B64_CHUNK = 0x8000;

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += B64_CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + B64_CHUNK));
  }
  return btoa(bin);
}

/** Linear-interpolation downsample of 16-bit LE mono PCM from 24 kHz to 16 kHz. */
export function downsample24kTo16k(input: Uint8Array): Uint8Array {
  const inSamples = input.length >> 1;
  const outSamples = Math.floor((inSamples * MIC_SAMPLE_RATE) / GEMINI_OUTPUT_SAMPLE_RATE);
  const inView = new DataView(input.buffer, input.byteOffset, inSamples * 2);
  const out = new Uint8Array(outSamples * 2);
  const outView = new DataView(out.buffer);
  const step = GEMINI_OUTPUT_SAMPLE_RATE / MIC_SAMPLE_RATE;

  for (let i = 0; i < outSamples; i++) {
    const pos = i * step;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const a = inView.getInt16(idx * 2, true);
    const b = idx + 1 < inSamples ? inView.getInt16((idx + 1) * 2, true) : a;
    outView.setInt16(i * 2, Math.round(a + (b - a) * frac), true);
  }
  return out;
}

/** Duration in ms of 16 kHz 16-bit mono PCM. */
export function pcm16kDurationMs(bytes: Uint8Array): number {
  return (bytes.length / 2 / MIC_SAMPLE_RATE) * 1000;
}

export function decodeUtf8(data: ArrayBuffer): string {
  if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(data);
  const bytes = new Uint8Array(data);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return decodeURIComponent(escape(s));
}
