import * as FileSystem from 'expo-file-system/legacy';
import * as Speech from 'expo-speech';
import ttsFile, { type DeviceVoice } from '@/modules/tts-file';
import { base64ToBytes } from '@/services/geminiLive/pcm';
import { ROOM_LOCALES } from './presets';
import type { CastMember } from './types';

/**
 * The free voices: the phone's own text-to-speech engine. On Android the native tts-file module writes each line to a
 * WAV file, which the room then places at the speaker's seat exactly like a Gemini voice. Elsewhere (or in a build
 * without the module) the line is simply spoken by expo-speech, with no room sound.
 */

export interface PhoneVoice {
  /** The engine's voice name, or undefined for the engine's default for `language`. */
  voiceName?: string;
  language: string;
  pitch: number;
  rate: number;
}

export interface PcmClip {
  /** 16-bit mono PCM. */
  pcm: Uint8Array;
  sampleRate: number;
}

export const canSynthesizeToFile = (): boolean => ttsFile !== null;

let voicesCache: DeviceVoice[] | null = null;

/** Every voice the phone has, once. Empty when the engine cannot list them. */
export async function deviceVoices(): Promise<DeviceVoice[]> {
  if (voicesCache) return voicesCache;
  try {
    if (ttsFile) {
      voicesCache = await ttsFile.getVoices();
    } else {
      const list = await Speech.getAvailableVoicesAsync();
      voicesCache = list.map((v) => ({ name: v.identifier, language: v.language, quality: 300, latency: 300, requiresNetwork: false, features: [] }));
    }
  } catch {
    voicesCache = [];
  }
  return voicesCache;
}

/**
 * Voices for a locale: the Indian tag first (en-IN, hi-IN…), then the same language from any region, and within those
 * the most natural first: highest quality, and the engine's online voices before its offline ones (Google's "network"
 * voices are the natural-sounding ones; the room needs the internet anyway).
 */
function voicesFor(all: DeviceVoice[], locale: string): DeviceVoice[] {
  const lang = locale.split('-')[0].toLowerCase();
  const norm = (t: string) => t.replace('_', '-').toLowerCase();
  const usable = all.filter((v) => !v.features.includes('notInstalled'));
  const exact = usable.filter((v) => norm(v.language) === locale.toLowerCase());
  const same = usable.filter((v) => norm(v.language).split('-')[0] === lang && !exact.includes(v));
  const rank = (a: DeviceVoice, b: DeviceVoice) => b.quality - a.quality || Number(b.requiresNetwork) - Number(a.requiresNetwork) || a.name.localeCompare(b.name);
  return [...exact.sort(rank), ...same.sort(rank)];
}

/** A rough guess from Google's voice names ("en-in-x-ene-local": the letters after x- name the speaker). */
function guessGender(v: DeviceVoice): 'female' | 'male' | null {
  const n = v.name.toLowerCase();
  if (/female|#female/.test(n)) return 'female';
  if (/male|#male/.test(n)) return 'male';
  return null;
}

/**
 * Gives the director and each cast member a phone voice: different voices where the phone has them for the language,
 * and where it has only one, different pitches and paces so the people still sound apart. Men lower, women higher.
 */
export async function assignPhoneVoices(language: string, cast: CastMember[], directorGender: 'female' | 'male' = 'female'): Promise<Map<string, PhoneVoice>> {
  const locale = ROOM_LOCALES[language] ?? 'en-IN';
  const all = await deviceVoices();
  const pool = voicesFor(all, locale);
  const out = new Map<string, PhoneVoice>();
  const used = new Set<string>();
  const take = (gender: 'female' | 'male'): string | undefined => {
    const fit = pool.find((v) => !used.has(v.name) && guessGender(v) === gender) ?? pool.find((v) => !used.has(v.name) && guessGender(v) === null) ?? pool.find((v) => !used.has(v.name));
    if (!fit) return undefined;
    used.add(fit.name);
    return fit.name;
  };
  // Pitch and pace steps, so repeats of one engine voice are still told apart. Kept close to natural: a voice pushed
  // far from 1.0 starts to sound like a machine.
  const femalePitch = [1.04, 1.12, 0.98, 1.18];
  const malePitch = [0.9, 0.84, 0.95, 0.8];
  const rates = [0.97, 0.93, 1.0, 0.9, 1.03, 0.95];
  let f = 0;
  let m = 0;
  const voiceFor = (gender: 'female' | 'male', i: number): PhoneVoice => {
    const name = take(gender);
    const own = name !== undefined && pool.length > 1;
    const pitch = gender === 'female' ? femalePitch[(own ? 0 : f++) % femalePitch.length] : malePitch[(own ? 0 : m++) % malePitch.length];
    return { voiceName: name, language: locale, pitch: own ? pitch : pitch, rate: rates[i % rates.length] };
  };
  out.set('director', { ...voiceFor(directorGender, 0), rate: 0.98 });
  cast.forEach((c, i) => out.set(c.id, voiceFor(c.gender, i + 1)));
  return out;
}

let fileNo = 0;

/** Reads a RIFF WAV into 16-bit mono PCM: stereo is averaged, 8-bit widened, other layouts refused. */
export function wavToPcm16Mono(wav: Uint8Array): PcmClip | null {
  if (wav.length < 44) return null;
  const v = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;
  let off = 12;
  let channels = 1;
  let sampleRate = 0;
  let bits = 16;
  let format = 1;
  let dataOff = -1;
  let dataLen = 0;
  while (off + 8 <= wav.length) {
    const id = tag(off);
    let size = v.getUint32(off + 4, true);
    if (id === 'fmt ') {
      format = v.getUint16(off + 8, true);
      channels = v.getUint16(off + 10, true);
      sampleRate = v.getUint32(off + 12, true);
      bits = v.getUint16(off + 22, true);
    } else if (id === 'data') {
      dataOff = off + 8;
      // Some engines write the length before they know it: trust the file's real size.
      if (size === 0 || size === 0xffffffff || dataOff + size > wav.length) size = wav.length - dataOff;
      dataLen = size;
      break;
    }
    off += 8 + size + (size & 1);
  }
  if (dataOff < 0 || !sampleRate || (format !== 1 && format !== 0xfffe) || (bits !== 16 && bits !== 8)) return null;
  const bytesPerSample = bits / 8;
  const frames = Math.floor(dataLen / (bytesPerSample * channels));
  const out = new Uint8Array(frames * 2);
  const ov = new DataView(out.buffer);
  for (let i = 0; i < frames; i++) {
    let acc = 0;
    for (let c = 0; c < channels; c++) {
      const p = dataOff + (i * channels + c) * bytesPerSample;
      acc += bits === 16 ? v.getInt16(p, true) : (v.getUint8(p) - 128) << 8;
    }
    ov.setInt16(i * 2, Math.round(acc / channels), true);
  }
  return { pcm: out, sampleRate };
}

/** Speaks the line into a file with the phone's engine and returns its samples, or null where that is not possible. */
export async function synthesizeToPcm(text: string, voice: PhoneVoice, dir: string): Promise<PcmClip | null> {
  if (!ttsFile) return null;
  const path = `${dir}tts-${++fileNo}.wav`;
  try {
    await ttsFile.synthesize({ text, voiceName: voice.voiceName, language: voice.language, pitch: voice.pitch, rate: voice.rate, path });
    const b64 = await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.Base64 });
    return wavToPcm16Mono(base64ToBytes(b64));
  } catch {
    return null;
  } finally {
    void FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
  }
}

/** The fallback: the phone speaks the line itself (no room sound). Resolves when it has finished or was stopped. */
export function speakPlain(text: string, voice: PhoneVoice): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    try {
      Speech.speak(text, { language: voice.language, voice: voice.voiceName, pitch: voice.pitch, rate: voice.rate, onDone: finish, onStopped: finish, onError: finish });
    } catch {
      finish();
    }
  });
}

export const stopPlain = () => { void Speech.stop(); };
