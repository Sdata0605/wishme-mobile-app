/**
 * Call logs: reading back the calls the assistant made.
 *
 * The call rows themselves come from `services/assistant/aiCalls`. This file adds the two things
 * the log screens need on top of that: the saved conversation, and a link to the audio.
 */

import { supabaseFetch } from '@/constants/supabase';
import type { AiCallStatus } from '@/services/assistant/aiCalls';

/** Plain words for each status, with the colour the list and the detail screen both use. */
export const STATUS_LABELS: Record<AiCallStatus, { label: string; colour: string }> = {
  queued: { label: 'Starting', colour: '#F59E0B' },
  scheduled: { label: 'Scheduled', colour: '#6366F1' },
  ringing: { label: 'Ringing', colour: '#F59E0B' },
  'in-progress': { label: 'On the call', colour: '#22C55E' },
  completed: { label: 'Done', colour: '#22C55E' },
  'no-answer': { label: 'No answer', colour: '#9CA3AF' },
  busy: { label: 'Line busy', colour: '#9CA3AF' },
  voicemail: { label: 'Voicemail', colour: '#9CA3AF' },
  failed: { label: 'Failed', colour: '#EF4444' },
};

/** What the call achieved, as the server records it. */
export const OUTCOME_LABELS: Record<string, string> = {
  success: 'Task done',
  partial: 'Partly done',
  declined: 'They said no',
  no_info: 'Nothing learned',
  callback_requested: 'They asked for a callback',
};

/** One turn of a conversation. `assistant` is the AI, `user` is the person who was called. */
export interface TranscriptLine {
  key: string;
  role: 'assistant' | 'user';
  message: string;
}

interface CallLineRow {
  id: number;
  role: 'assistant' | 'user';
  message: string;
  seq: number;
}

/**
 * The conversation as it was saved line by line while the call happened. Ordered by `seq`, because
 * the clock alone is not enough — two lines can land in the same millisecond.
 */
export async function listCallLines(accessToken: string, callId: string): Promise<TranscriptLine[]> {
  const res = await supabaseFetch(
    `/rest/v1/ai_call_lines?select=id,role,message,seq&call_id=eq.${encodeURIComponent(callId)}&order=seq.asc`,
    {},
    accessToken,
  );
  if (!res.ok) throw new Error(`The conversation could not be loaded (${res.status}).`);
  const rows = (await res.json()) as CallLineRow[];
  return rows.map((row) => ({ key: `line-${row.id}`, role: row.role, message: row.message }));
}

/**
 * Older calls were written as one block of text when they ended, before per-line saving existed.
 * Each line is prefixed "AI:" or "Them:", so they can still be shown as a conversation.
 */
export function parseTranscriptText(transcript: string): TranscriptLine[] {
  return transcript
    .split('\n')
    .map((raw) => raw.trim())
    .filter((raw) => raw.length > 0)
    .map((raw, index) => ({
      key: `text-${index}`,
      role: /^AI\s*:/i.test(raw) ? ('assistant' as const) : ('user' as const),
      message: raw.replace(/^(AI|Them|User|Assistant)\s*:\s*/i, ''),
    }));
}

/**
 * Why there is nothing to play. `missing` means no recording was ever made; `expired` means the
 * audio has been deleted but the written conversation is still there.
 */
export type RecordingProblem = 'missing' | 'expired' | 'error';

export type RecordingLink =
  | { ok: true; url: string }
  | { ok: false; problem: RecordingProblem; message: string };

/**
 * Asks the server for a short-lived link to one call's audio.
 *
 * The link is deliberately never stored or logged anywhere — a recording is a private
 * conversation, and the link is enough on its own to listen to it. Call this again every time the
 * user presses play.
 */
export async function fetchRecordingLink(accessToken: string, callId: string): Promise<RecordingLink> {
  try {
    const res = await supabaseFetch(
      '/functions/v1/ai-call-recording',
      { method: 'POST', body: JSON.stringify({ callId }) },
      accessToken,
    );

    if (res.status === 404) {
      return { ok: false, problem: 'missing', message: 'There is no recording of this call.' };
    }
    if (res.status === 410) {
      return {
        ok: false,
        problem: 'expired',
        message: 'The recording has been deleted, but the written conversation is still here.',
      };
    }

    const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || !body.url) {
      return {
        ok: false,
        problem: 'error',
        message: body.error ?? `The recording could not be prepared (${res.status}).`,
      };
    }
    return { ok: true, url: body.url };
  } catch {
    return {
      ok: false,
      problem: 'error',
      message: 'Could not reach the server. Check the connection and try again.',
    };
  }
}
