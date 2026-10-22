import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import { useSyncExternalStore } from 'react';

/**
 * The music player on Home: two playlists streamed from places that need no account or key, and one shared sound so
 * the music keeps going when Home scrolls away or another tab opens.
 *
 * - "Free & open": Creative Commons music from Jamendo, found through Openverse (api.openverse.org, anonymous use
 *   allows 200 requests a day, so the list is cached for 12 hours). Only licences that allow commercial use are kept
 *   (CC BY, BY-SA, BY-ND, CC0, public domain); the tracks are streamed unchanged and the card shows the credit.
 * - "AI made": music people have published on the Internet Archive under an open licence and tagged as AI-generated.
 *   The search is noisy, so only items with a public-domain or CC BY / BY-SA licence and real MP3 files are used.
 */
export type Playlist = 'open' | 'ai';

export interface Track {
  id: string;
  title: string;
  artist: string;
  /** Short licence label, e.g. "CC BY-SA 3.0" or "Public domain". */
  license: string;
  licenseUrl?: string;
  /** The audio stream. */
  url: string;
  /** Where the track lives on the web, for the credit link. */
  pageUrl: string;
  source: 'Jamendo' | 'Internet Archive';
  durationMs?: number;
  artwork?: string;
}

export type RadioStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface RadioState {
  playlist: Playlist;
  tracks: Track[];
  index: number;
  status: RadioStatus;
  positionMs: number;
  durationMs: number;
  message: string;
}

const HEADERS = { 'User-Agent': 'WishMe/1.0 (Android)' };
const CACHE_MS = 12 * 60 * 60 * 1000;
const MIN_MS = 45_000;
const MAX_MS = 9 * 60_000;

function moodFor(now = new Date()): string {
  const h = now.getHours();
  return h < 11 ? 'morning' : h < 15 ? 'happy upbeat' : h < 19 ? 'focus' : 'calm piano';
}

/** Jamendo titles and names arrive HTML-escaped ("Angus &amp; Friends"). */
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m)
    .trim();
}

function shuffle<T>(a: T[]): T[] {
  const out = a.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function getJson(url: string, timeoutMs = 12_000): Promise<unknown> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: HEADERS, signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// ---------- Free & open: Openverse → Jamendo ----------

interface OvResult {
  id: string;
  title: string;
  creator?: string;
  license: string;
  license_version?: string;
  license_url?: string;
  url: string;
  foreign_landing_url?: string;
  duration?: number;
  thumbnail?: string;
}

function ccLabel(license: string, version?: string): string {
  const l = license.toLowerCase();
  if (l === 'cc0') return 'CC0';
  if (l === 'pdm') return 'Public domain';
  return `CC ${l.toUpperCase()}${version ? ` ${version}` : ''}`;
}

async function openverse(q: string): Promise<Track[]> {
  const u = `https://api.openverse.org/v1/audio/?q=${encodeURIComponent(q)}&category=music&source=jamendo&license_type=commercial&page_size=20`;
  const j = (await getJson(u)) as { results?: OvResult[] };
  return (j.results ?? [])
    .filter((r) => r.url && (!r.duration || (r.duration >= MIN_MS && r.duration <= MAX_MS)))
    .map((r) => ({
      id: `ov:${r.id}`,
      title: decode(r.title || 'Untitled'),
      artist: decode(r.creator || 'Unknown artist'),
      license: ccLabel(r.license, r.license_version),
      licenseUrl: r.license_url,
      url: r.url,
      pageUrl: r.foreign_landing_url || `https://openverse.org/audio/${r.id}`,
      source: 'Jamendo' as const,
      durationMs: r.duration,
      artwork: r.thumbnail,
    }));
}

async function fetchOpenTracks(): Promise<Track[]> {
  let tracks = await openverse(moodFor());
  if (tracks.length < 6) tracks = tracks.concat(await openverse('instrumental'));
  const seen = new Set<string>();
  return shuffle(tracks.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true))));
}

// ---------- AI made: Internet Archive ----------

interface IaDoc { identifier: string; title?: string; creator?: string | string[]; licenseurl?: string }
interface IaFile { name: string; title?: string; length?: string | number; source?: string; format?: string }
interface IaMeta { metadata?: { title?: string; creator?: string | string[]; licenseurl?: string }; files?: IaFile[] }

const IA_QUERY =
  'mediatype:audio AND licenseurl:* AND subject:("ai music" OR "ai generated music" OR "ai-generated music" OR "ai generated" OR "ai-generated" OR "generative music" OR "suno ai" OR "udio ai") AND NOT subject:(podcast OR podcasts OR interview OR audiobook)';
const IA_FALLBACK_ITEMS = ['the-festival-of-termina'];

function iaLicense(url?: string): string | null {
  if (!url) return null;
  if (/publicdomain/i.test(url)) return 'Public domain';
  const m = /licenses\/(by(?:-sa)?)\/([\d.]+)/i.exec(url);
  if (m) return `CC ${m[1].toUpperCase()} ${m[2]}`;
  return null; // NC or ND from the Archive: skip, the licence is not certain enough
}

function first(v?: string | string[]): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

async function iaItemTracks(id: string, doc?: IaDoc): Promise<Track[]> {
  const meta = (await getJson(`https://archive.org/metadata/${encodeURIComponent(id)}`)) as IaMeta;
  const license = iaLicense(meta.metadata?.licenseurl ?? doc?.licenseurl);
  if (!license) return [];
  const artist = first(meta.metadata?.creator) ?? first(doc?.creator) ?? 'Unknown artist';
  const album = meta.metadata?.title ?? doc?.title ?? id;
  const files = (meta.files ?? []).filter((f) => /\.mp3$/i.test(f.name));
  // Prefer the uploader's own MP3s over the Archive's re-encodes, then keep songs of a sensible length.
  const originals = files.filter((f) => f.source === 'original');
  const chosen = (originals.length ? originals : files)
    .map((f) => ({ f, ms: Math.round(Number(f.length) * 1000) || 0 }))
    .filter(({ ms }) => ms === 0 || (ms >= MIN_MS && ms <= MAX_MS))
    .slice(0, 3);
  return chosen.map(({ f, ms }) => ({
    id: `ia:${id}/${f.name}`,
    title: decode((f.title && f.title.trim()) || f.name.replace(/\.mp3$/i, '').replace(/^\d+[\s._-]+/, '')),
    artist: decode(artist === album ? artist : `${artist} · ${album}`),
    license,
    licenseUrl: meta.metadata?.licenseurl ?? doc?.licenseurl,
    url: `https://archive.org/download/${encodeURIComponent(id)}/${encodeURIComponent(f.name)}`,
    pageUrl: `https://archive.org/details/${encodeURIComponent(id)}`,
    source: 'Internet Archive' as const,
    durationMs: ms || undefined,
    artwork: `https://archive.org/services/img/${encodeURIComponent(id)}`,
  }));
}

async function fetchAiTracks(): Promise<Track[]> {
  let docs: IaDoc[] = [];
  try {
    const u = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(IA_QUERY)}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=licenseurl&sort[]=downloads+desc&rows=30&output=json`;
    const j = (await getJson(u, 15_000)) as { response?: { docs?: IaDoc[] } };
    docs = (j.response?.docs ?? []).filter((d) => iaLicense(d.licenseurl));
  } catch {
    docs = [];
  }
  const ids = docs.slice(0, 8).map((d) => d.identifier);
  for (const f of IA_FALLBACK_ITEMS) if (!ids.includes(f)) ids.push(f);
  const results = await Promise.allSettled(ids.map((id) => iaItemTracks(id, docs.find((d) => d.identifier === id))));
  const tracks = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  return shuffle(tracks);
}

// ---------- cache ----------

interface Cached { at: number; mood: string; tracks: Track[] }

async function loadTracks(playlist: Playlist): Promise<Track[]> {
  const key = `home_radio_${playlist}_v1`;
  const mood = playlist === 'open' ? moodFor() : '';
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const c = JSON.parse(raw) as Cached;
      if (Date.now() - c.at < CACHE_MS && c.mood === mood && c.tracks.length) return shuffle(c.tracks);
    }
  } catch {
    // ignore a bad cache
  }
  const tracks = playlist === 'open' ? await fetchOpenTracks() : await fetchAiTracks();
  if (tracks.length) void AsyncStorage.setItem(key, JSON.stringify({ at: Date.now(), mood, tracks } satisfies Cached));
  return tracks;
}

// ---------- the player ----------

let state: RadioState = { playlist: 'open', tracks: [], index: 0, status: 'idle', positionMs: 0, durationMs: 0, message: '' };
const listeners = new Set<() => void>();
let sound: Audio.Sound | null = null;
let loadSeq = 0;
let audioModeSet = false;

function set(patch: Partial<RadioState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

async function ensureAudioMode() {
  if (audioModeSet) return;
  audioModeSet = true;
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true, shouldDuckAndroid: true, allowsRecordingIOS: false });
  } catch {
    // playback still works with the default mode
  }
}

async function unload() {
  const s = sound;
  sound = null;
  if (s) {
    try { s.setOnPlaybackStatusUpdate(null); await s.unloadAsync(); } catch { /* already gone */ }
  }
}

async function playIndex(index: number, skipsLeft = 3): Promise<void> {
  const track = state.tracks[index];
  if (!track) return;
  const seq = ++loadSeq;
  await unload();
  set({ index, status: 'loading', positionMs: 0, durationMs: track.durationMs ?? 0, message: '' });
  try {
    await ensureAudioMode();
    const { sound: s } = await Audio.Sound.createAsync({ uri: track.url, headers: HEADERS }, { shouldPlay: true, progressUpdateIntervalMillis: 500 });
    if (seq !== loadSeq) { await s.unloadAsync().catch(() => {}); return; }
    sound = s;
    s.setOnPlaybackStatusUpdate((st: AVPlaybackStatus) => {
      if (seq !== loadSeq) return;
      if (!st.isLoaded) {
        if (st.error) void skip(index, skipsLeft - 1);
        return;
      }
      if (st.didJustFinish) { void radio.next(); return; }
      set({
        positionMs: st.positionMillis,
        durationMs: st.durationMillis ?? state.durationMs,
        status: st.isPlaying ? 'playing' : st.isBuffering && !st.isPlaying && state.status !== 'paused' ? 'loading' : state.status === 'paused' ? 'paused' : 'playing',
      });
    });
    set({ status: 'playing' });
  } catch {
    if (seq === loadSeq) await skip(index, skipsLeft - 1);
  }
}

async function skip(from: number, skipsLeft: number) {
  if (skipsLeft <= 0 || state.tracks.length < 2) {
    set({ status: 'error', message: 'This track would not play. Tap next to try another.' });
    return;
  }
  await playIndex((from + 1) % state.tracks.length, skipsLeft);
}

async function ensureTracks(): Promise<boolean> {
  if (state.tracks.length) return true;
  set({ status: 'loading', message: '' });
  try {
    const tracks = await loadTracks(state.playlist);
    if (!tracks.length) {
      set({ status: 'error', message: 'No music found right now. Check the connection and try again.' });
      return false;
    }
    set({ tracks, index: 0, status: 'idle' });
    return true;
  } catch {
    set({ status: 'error', message: 'Could not reach the music library. Check the connection and try again.' });
    return false;
  }
}

export const radio = {
  async toggle() {
    if (state.status === 'playing') {
      try { await sound?.pauseAsync(); } catch { /* ignore */ }
      set({ status: 'paused' });
      return;
    }
    if (state.status === 'paused' && sound) {
      set({ status: 'playing' });
      try { await sound.playAsync(); } catch { await playIndex(state.index); }
      return;
    }
    if (state.status === 'loading') return;
    if (!(await ensureTracks())) return;
    await playIndex(state.index);
  },
  async next() {
    if (!(await ensureTracks())) return;
    await playIndex((state.index + 1) % state.tracks.length);
  },
  async prev() {
    if (!(await ensureTracks())) return;
    if (state.positionMs > 5000 && sound) { try { await sound.setPositionAsync(0); } catch { /* ignore */ } return; }
    await playIndex((state.index - 1 + state.tracks.length) % state.tracks.length);
  },
  async setPlaylist(p: Playlist) {
    if (p === state.playlist) return;
    const wasPlaying = state.status === 'playing' || state.status === 'loading';
    loadSeq++;
    await unload();
    set({ playlist: p, tracks: [], index: 0, status: 'idle', positionMs: 0, durationMs: 0, message: '' });
    if (!(await ensureTracks())) return;
    if (wasPlaying) await playIndex(0);
  },
  async pause() {
    if (state.status !== 'playing') return;
    try { await sound?.pauseAsync(); } catch { /* ignore */ }
    set({ status: 'paused' });
  },
  async retry() {
    loadSeq++;
    await unload();
    set({ tracks: [], index: 0, status: 'idle', positionMs: 0, durationMs: 0, message: '' });
    if (await ensureTracks()) await playIndex(0);
  },
  /** Warm the list so the first tap plays at once. */
  async preload() {
    if (state.status === 'idle' && !state.tracks.length) await ensureTracks();
  },
};

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function useRadio(): RadioState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function fmtMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`;
}
