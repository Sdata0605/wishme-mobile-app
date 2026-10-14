/**
 * AI calls: the assistant phones someone on the user's behalf, talks to them, and reports back.
 * This file is the app's side: validation, the server calls, and following a call until it ends.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabaseFetch } from '@/constants/supabase';

export type AiCallStatus =
  | 'queued'
  | 'scheduled'
  | 'ringing'
  | 'in-progress'
  | 'completed'
  | 'no-answer'
  | 'busy'
  | 'voicemail'
  | 'failed';

export interface AiCall {
  id: string;
  to_name: string | null;
  to_phone: string;
  purpose: string;
  details: string | null;
  status: AiCallStatus;
  scheduled_for: string | null;
  duration_seconds: number | null;
  transcript: string | null;
  summary: string | null;
  outcome: string | null;
  next_step: string | null;
  recording_url: string | null;
  error_message: string | null;
  /** Why the phone service ended the call (e.g. customer-did-not-answer). */
  ended_reason: string | null;
  created_at: string;
}

export const ACTIVE_STATUSES: AiCallStatus[] = ['queued', 'scheduled', 'ringing', 'in-progress'];
export const isActive = (s: AiCallStatus) => ACTIVE_STATUSES.includes(s);

const COLUMNS =
  'id,to_name,to_phone,purpose,details,status,scheduled_for,duration_seconds,transcript,summary,outcome,next_step,recording_url,error_message,ended_reason,created_at';

// ─── Phone numbers (same rules as the server, so the user hears problems early) ─

const EMERGENCY = new Set(['100', '101', '102', '108', '112', '181', '1070', '1077', '1078', '1091', '1098', '1363', '1930']);

export type NumberCheck = { ok: true; e164: string; spoken: string } | { ok: false; reason: string };

export function checkPhoneNumber(input: string): NumberCheck {
  const raw = (input ?? '').trim();
  if (EMERGENCY.has(raw.replace(/\D/g, ''))) {
    return { ok: false, reason: 'The assistant never calls emergency numbers. Please dial those yourself.' };
  }
  let d = raw.replace(/[^\d+]/g, '');
  if (d.startsWith('+')) {
    if (!d.startsWith('+91')) return { ok: false, reason: 'AI calls only work for Indian phone numbers for now.' };
    d = d.slice(3);
  } else if (d.startsWith('0091')) d = d.slice(4);
  else if (d.startsWith('91') && d.length === 12) d = d.slice(2);
  else if (d.startsWith('0') && d.length === 11) d = d.slice(1);

  if (!/^[2-9]\d{9}$/.test(d)) return { ok: false, reason: 'That does not look like a valid 10-digit Indian phone number.' };
  if (/^(19|18)/.test(d) || d.startsWith('900') || d.startsWith('909')) {
    return { ok: false, reason: 'That number cannot be called by the assistant.' };
  }
  // Only Indian numbers are accepted, so the country code is left out of what is read aloud.
  return { ok: true, e164: `+91${d}`, spoken: `${d.slice(0, 5)} ${d.slice(5)}` };
}

// ─── Server calls ────────────────────────────────────────────────────────────

export interface StartParams {
  name?: string;
  phone: string;
  purpose: string;
  details?: string;
  language?: string;
  scheduleAt?: string;
}

export async function startAiCall(
  accessToken: string,
  params: StartParams,
): Promise<{ ok: true; callId: string; status: string; scheduledFor: string | null } | { ok: false; error: string }> {
  try {
    const res = await supabaseFetch(
      '/functions/v1/ai-call-start',
      { method: 'POST', body: JSON.stringify({ ...params, confirmed: true }) },
      accessToken,
    );
    const j = (await res.json().catch(() => ({}))) as { error?: string; callId?: string; status?: string; scheduledFor?: string | null };
    if (!res.ok || !j.callId) return { ok: false, error: j.error ?? `The call could not be started (${res.status}).` };
    return { ok: true, callId: j.callId, status: j.status ?? 'queued', scheduledFor: j.scheduledFor ?? null };
  } catch {
    return { ok: false, error: 'Could not reach the server. Check the connection and try again.' };
  }
}

export async function fetchAiCall(accessToken: string, id: string): Promise<AiCall | null> {
  try {
    const res = await supabaseFetch(`/rest/v1/ai_calls?select=${COLUMNS}&id=eq.${encodeURIComponent(id)}&limit=1`, {}, accessToken);
    if (!res.ok) return null;
    const rows = (await res.json()) as AiCall[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function fetchLatestAiCall(accessToken: string): Promise<AiCall | null> {
  const list = await listAiCalls(accessToken, 1);
  return list[0] ?? null;
}

export async function listAiCalls(accessToken: string, limit = 30): Promise<AiCall[]> {
  try {
    const res = await supabaseFetch(`/rest/v1/ai_calls?select=${COLUMNS}&order=created_at.desc&limit=${limit}`, {}, accessToken);
    if (!res.ok) return [];
    return (await res.json()) as AiCall[];
  } catch {
    return [];
  }
}

// ─── Words for the assistant ─────────────────────────────────────────────────

export function whoLabel(call: Pick<AiCall, 'to_name' | 'to_phone'>) {
  return call.to_name || call.to_phone;
}

/** A short factual report the assistant can read out (or the UI can show). */
export function describeCall(call: AiCall, transcriptChars = 6000) {
  return {
    status: call.status,
    who: whoLabel(call),
    purpose: call.purpose,
    summary: call.summary,
    outcome: call.outcome,
    next_step: call.next_step,
    duration_seconds: call.duration_seconds,
    transcript: call.transcript ? call.transcript.slice(0, transcriptChars) : null,
    error: call.error_message,
  };
}

/**
 * What the assistant says out loud when a call ends, as plain text. Used when the voice engine
 * cannot be asked to word it itself (it reads this out exactly).
 */
export function spokenReport(call: AiCall): string {
  const who = whoLabel(call);
  if (call.status === 'no-answer') return `${who} did not pick up the call. Shall I try again, or would you like to call them yourself?`;
  if (call.status === 'busy') return `${who}'s line was busy. Shall I try again in a few minutes?`;
  if (call.status === 'failed') return `I could not complete the call to ${who}. ${call.error_message ?? ''} Shall I try again?`.replace(/\s+/g, ' ').trim();
  if (call.status === 'voicemail') return `The call to ${who} went to voicemail. ${call.summary ?? ''} Shall I try again later?`.replace(/\s+/g, ' ').trim();
  const parts = [`The call with ${who} has ended.`, call.summary ?? '', call.next_step ? `Next: ${call.next_step}` : ''];
  return parts.filter(Boolean).join(' ');
}

// ─── Following a call until it ends ──────────────────────────────────────────

const log: (...args: unknown[]) => void = __DEV__ ? (...args) => console.log('[aicall]', ...args) : () => {};

const WATCH_KEY = '@wishme/ai-calls-watching';
const FAST_MS = 6_000;
const SLOW_MS = 60_000;
const GIVE_UP_MS = 45 * 60_000;
/** A call placed right now is over well within this (the server caps calls at 4 minutes). */
const LIVE_MAX_MS = 7 * 60_000;
const LIVE_STATUSES: AiCallStatus[] = ['queued', 'ringing', 'in-progress'];
/** A call that is still only "queued" this long after it was requested has not started ringing. */
const STALL_MS = 75_000;

interface Watched {
  id: string;
  since: number;
}

/**
 * Follows calls until they end and then calls `onFinished`. The list is remembered, so a call that
 * finishes while the app is closed is still reported the next time it opens.
 *
 *  - `onLiveChange(true)` while a call is ringing or being spoken right now (not one booked for later),
 *    so the assistant can stay open; `onLiveChange(false)` once nothing is live any more.
 *  - `onProgress` fires whenever the call moves on (ringing, answered).
 */
export function createAiCallWatcher(opts: {
  getAccessToken: () => Promise<string | null | undefined>;
  onFinished: (call: AiCall) => void;
  onProgress?: (call: AiCall) => void;
  /** The call was requested but never started ringing, so the user should not keep waiting for it. */
  onStalled?: (call: AiCall) => void;
  onLiveChange?: (live: boolean) => void;
}) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const live = new Set<string>();
  const lastStatus = new Map<string, AiCallStatus>();
  const stalled = new Set<string>();
  let stopped = false;

  const setLive = (id: string, isLive: boolean) => {
    const before = live.size > 0;
    if (isLive) live.add(id);
    else live.delete(id);
    const after = live.size > 0;
    if (before !== after) opts.onLiveChange?.(after);
  };

  const load = async (): Promise<Watched[]> => {
    try {
      return JSON.parse((await AsyncStorage.getItem(WATCH_KEY)) ?? '[]') as Watched[];
    } catch {
      return [];
    }
  };
  const save = (list: Watched[]) => AsyncStorage.setItem(WATCH_KEY, JSON.stringify(list)).catch(() => {});
  const forget = async (id: string) => save((await load()).filter((w) => w.id !== id));

  const poll = async (w: Watched) => {
    if (stopped) return;
    const token = await opts.getAccessToken();
    const call = token ? await fetchAiCall(token, w.id) : null;
    if (stopped) return;

    if (call && !isActive(call.status)) {
      log(w.id.slice(0, 8), 'finished:', call.status, '| reason:', call.ended_reason ?? '-', '| error:', call.error_message ?? '-');
      timers.delete(w.id);
      lastStatus.delete(w.id);
      stalled.delete(w.id);
      setLive(w.id, false);
      await forget(w.id);
      opts.onFinished(call);
      return;
    }
    if (Date.now() - w.since > GIVE_UP_MS) {
      timers.delete(w.id);
      lastStatus.delete(w.id);
      setLive(w.id, false);
      await forget(w.id);
      return;
    }
    // Never hold the assistant open past the longest a call can last, even if the server can't be reached.
    const fresh = Date.now() - w.since < LIVE_MAX_MS;
    if (!fresh) setLive(w.id, false);
    if (!call) log(w.id.slice(0, 8), 'could not read the call (no login or no connection)');
    if (call) {
      if (fresh) setLive(w.id, LIVE_STATUSES.includes(call.status));
      if (lastStatus.get(w.id) !== call.status) {
        lastStatus.set(w.id, call.status);
        log(w.id.slice(0, 8), 'status:', call.status, '| reason:', call.ended_reason ?? '-', '| error:', call.error_message ?? '-');
        opts.onProgress?.(call);
      }
      if (call.status === 'queued' && !stalled.has(w.id) && Date.now() - w.since > STALL_MS) {
        stalled.add(w.id);
        log(w.id.slice(0, 8), 'still queued after', Math.round((Date.now() - w.since) / 1000), 's: the phone service has not started the call');
        opts.onStalled?.(call);
      }
    }
    // A call booked for later only needs an occasional look.
    const wait = call?.status === 'scheduled' ? SLOW_MS : FAST_MS;
    timers.set(w.id, setTimeout(() => void poll(w), wait));
  };

  const start = (w: Watched) => {
    if (timers.has(w.id)) return;
    timers.set(w.id, setTimeout(() => void poll(w), 1500));
  };

  return {
    /** `scheduled`: the call is booked for later, so the assistant has no reason to stay open for it. */
    async watch(id: string, watchOpts?: { scheduled?: boolean }) {
      stopped = false;
      const w = { id, since: Date.now() };
      if (!watchOpts?.scheduled) setLive(id, true);
      await save([...(await load()).filter((x) => x.id !== id), w]);
      start(w);
    },
    /** Picks up calls that were still going when the app was last closed. */
    async resume() {
      stopped = false;
      for (const w of await load()) start(w);
    },
    stop() {
      stopped = true;
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      lastStatus.clear();
      stalled.clear();
      if (live.size) {
        live.clear();
        opts.onLiveChange?.(false);
      }
    },
  };
}
