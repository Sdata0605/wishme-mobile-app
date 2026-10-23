import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/constants/supabase';
import { decodeUtf8 } from '@/services/geminiLive/pcm';

/**
 * One question about one picture, answered by Gemini. The app never holds the Gemini key: it asks the backend's
 * voice-token function for a short-lived token (the same one the voice assistant uses), opens a Live session of its
 * own in text mode, sends the picture and the question, collects the answer and closes. The token is single-use, so
 * every question costs one token request, which can take a few seconds.
 */
const LIVE_WS_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';

const SYSTEM = [
  'You are WishMe, a helpful assistant inside an Indian lifestyle app. The user shows you one photo and asks about it.',
  'Answer in plain, friendly language, in the language the question is written in. Be specific about what is in the picture.',
  'If asked for a price, give an estimate in rupees with a range and say it is an estimate. If the picture is unclear, say what you can see and what you cannot.',
  'Keep answers short: a few sentences, or a short list when listing things. No markdown headings.',
].join(' ');

interface TokenReply { engine?: string; token?: string; model?: string; error?: string }

async function fetchToken(accessToken: string, timeoutMs: number): Promise<{ token: string; model: string }> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/voice-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ want: 'gemini', supports: ['gemini'], spare: false }),
      signal: ctl.signal,
    });
    const data = (await r.json().catch(() => ({}))) as TokenReply;
    if (!r.ok) throw new Error(data.error || `voice-token answered ${r.status}`);
    if (data.engine !== 'gemini' || !data.token) throw new Error('Gemini is not available right now.');
    return { token: data.token, model: data.model || 'gemini-3.8-live' };
  } finally {
    clearTimeout(t);
  }
}

export interface AskOptions {
  accessToken: string;
  /** JPEG, base64, no data: prefix. Keep it around 1024 px on the long side. */
  base64Jpeg: string;
  question: string;
  onStatus?: (status: string) => void;
  /** Partial answer text as it streams in. */
  onPartial?: (text: string) => void;
  timeoutMs?: number;
}

export function askAboutImage(opts: AskOptions): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 45_000;
  return new Promise<string>((resolve, reject) => {
    let ws: WebSocket | null = null;
    let answer = '';
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws?.close(); } catch { /* ignore */ }
      if (err) reject(err); else resolve(answer.trim());
    };
    const timer = setTimeout(() => finish(answer ? undefined : new Error('Gemini took too long to answer.')), timeoutMs);

    opts.onStatus?.('Connecting…');
    fetchToken(opts.accessToken, Math.min(20_000, timeoutMs - 5_000))
      .then(({ token, model }) => {
        if (settled) return;
        const socket = new WebSocket(`${LIVE_WS_URL}?access_token=${encodeURIComponent(token)}`);
        ws = socket;
        socket.binaryType = 'arraybuffer';
        socket.onopen = () => {
          socket.send(JSON.stringify({
            setup: {
              model: `models/${model}`,
              generationConfig: { responseModalities: ['TEXT'] },
              systemInstruction: { parts: [{ text: SYSTEM }] },
            },
          }));
        };
        socket.onmessage = (ev) => {
          let msg: any;
          try {
            const text = typeof ev.data === 'string' ? ev.data : decodeUtf8(ev.data as ArrayBuffer);
            msg = JSON.parse(text);
          } catch {
            return;
          }
          if (msg.setupComplete) {
            opts.onStatus?.('Looking at the picture…');
            socket.send(JSON.stringify({ realtimeInput: { video: { mimeType: 'image/jpeg', data: opts.base64Jpeg } } }));
            socket.send(JSON.stringify({ clientContent: { turns: [{ role: 'user', parts: [{ text: opts.question }] }], turnComplete: true } }));
            return;
          }
          const sc = msg.serverContent;
          if (!sc) {
            if (msg.error) finish(new Error(String(msg.error?.message ?? 'Gemini returned an error.')));
            return;
          }
          for (const part of sc.modelTurn?.parts ?? []) {
            if (typeof part.text === 'string') {
              answer += part.text;
              opts.onPartial?.(answer);
            }
          }
          if (sc.turnComplete) finish();
        };
        socket.onerror = () => finish(answer ? undefined : new Error('The connection to Gemini failed.'));
        socket.onclose = (ev) => {
          if (settled) return;
          if (answer) finish();
          else finish(new Error(ev.reason ? `Gemini closed the connection: ${ev.reason}` : 'Gemini closed the connection before answering.'));
        };
      })
      .catch((e: unknown) => finish(e instanceof Error ? e : new Error(String(e))));
  });
}
