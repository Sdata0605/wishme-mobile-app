import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/constants/supabase';
import { base64ToBytes, decodeUtf8 } from '@/services/geminiLive/pcm';

/**
 * One Gemini Live session used as a request/response channel: a system instruction, a voice, and `generate()` calls that
 * each send one prompt and collect the whole reply (text, and the 24 kHz PCM audio when the session speaks).
 *
 * The app never holds the Gemini key. The backend's voice-token function mints a short-lived, single-use token for every
 * connection, which can take a few seconds, so a session stays open between turns and only reconnects when Google closes
 * it (idle, lifetime limit, a goAway). A session that reconnected has lost its memory, so callers pass both an incremental
 * prompt and a full one and the session sends whichever fits.
 */
const LIVE_WS_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';

const TOKEN_TIMEOUT_MS = 20_000;
const SETUP_TIMEOUT_MS = 10_000;
/** A prefetched token is trusted for this long (the server mints them for about 20 minutes). */
const TOKEN_MAX_AGE_MS = 8 * 60_000;

interface TokenReply { engine?: string; token?: string; model?: string; error?: string }
interface Token { token: string; model: string; at: number }

export async function mintLiveToken(accessToken: string, timeoutMs = TOKEN_TIMEOUT_MS): Promise<Token> {
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
    if (r.status === 401) throw new Error('Your login has ended. Please sign in again.');
    if (!r.ok) throw new Error(data.error || `The voice service answered ${r.status}.`);
    if (data.engine !== 'gemini' || !data.token) throw new Error('Gemini is not available right now.');
    return { token: data.token, model: data.model || 'gemini-3.8-live', at: Date.now() };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('The voice service took too long to answer.');
    throw e;
  } finally {
    clearTimeout(t);
  }
}

export interface LiveSessionOptions {
  getAccessToken: () => Promise<string | null | undefined>;
  systemInstruction: string;
  /** 'audio' speaks (and transcribes what it said); 'text' only writes. */
  mode: 'audio' | 'text';
  /** Gemini prebuilt voice, audio mode only. */
  voice?: string;
  /** Shown in logs. */
  label?: string;
  onStatus?: (status: string) => void;
}

export interface LiveReply {
  text: string;
  /** 16-bit mono PCM at 24 kHz, or null in text mode. */
  pcm: Uint8Array | null;
}

export interface GeneratePrompt {
  /** What to send when the session still remembers the earlier turns. */
  incremental: string;
  /** What to send when the session is new or was reconnected and remembers nothing. */
  full: string;
}

const log: (...args: unknown[]) => void = __DEV__ ? (...args) => console.log('[council]', ...args) : () => {};

export class LiveSession {
  private ws: WebSocket | null = null;
  private ready = false;
  /** True until the first prompt has gone over the current socket. */
  private fresh = true;
  private closed = false;
  private goingAway = false;
  private queue: Promise<unknown> = Promise.resolve();
  private connecting: Promise<void> | null = null;
  private tokenAhead: Promise<Token> | null = null;
  /** The handler for the reply being collected right now. */
  private onMessage: ((msg: any) => void) | null = null;
  private onDrop: ((reason: string) => void) | null = null;
  private readonly opts: LiveSessionOptions;

  constructor(opts: LiveSessionOptions) {
    this.opts = opts;
  }

  /** Asks for the next connection's token now, so the first turn does not wait for it. */
  prefetch() {
    if (this.closed || this.ws || this.tokenAhead) return;
    this.tokenAhead = (async () => {
      const access = await this.opts.getAccessToken();
      if (!access) throw new Error('Sign in to use the agent room.');
      return mintLiveToken(access);
    })();
    this.tokenAhead.catch(() => { this.tokenAhead = null; });
  }

  /** Sends one prompt and resolves with the whole reply. Calls are run one after another. */
  generate(prompt: GeneratePrompt, timeoutMs = 75_000): Promise<LiveReply> {
    const run = this.queue.then(() => this.generateNow(prompt, timeoutMs));
    this.queue = run.catch(() => undefined);
    return run;
  }

  close() {
    this.closed = true;
    this.dropSocket('closed by the app');
  }

  private async generateNow(prompt: GeneratePrompt, timeoutMs: number): Promise<LiveReply> {
    if (this.closed) throw new Error('This session is closed.');
    // One retry on a fresh connection when the socket died before anything came back.
    for (let attempt = 0; ; attempt++) {
      if (this.goingAway) this.dropSocket('server asked to reconnect');
      await this.connect();
      const text = this.fresh ? prompt.full : prompt.incremental;
      this.fresh = false;
      try {
        return await this.collect(text, timeoutMs);
      } catch (e) {
        const err = e as Error & { retryable?: boolean };
        if (attempt === 0 && err.retryable) {
          log(this.opts.label, 'retrying on a new connection:', err.message);
          this.dropSocket(err.message);
          continue;
        }
        throw e;
      }
    }
  }

  private connect(): Promise<void> {
    if (this.ws && this.ready) return Promise.resolve();
    if (this.connecting) return this.connecting;
    this.connecting = this.open().finally(() => { this.connecting = null; });
    return this.connecting;
  }

  private async takeToken(): Promise<Token> {
    const ahead = this.tokenAhead;
    this.tokenAhead = null;
    if (ahead) {
      try {
        const t = await ahead;
        if (Date.now() - t.at < TOKEN_MAX_AGE_MS) return t;
      } catch {
        /* fall through to a fresh request */
      }
    }
    const access = await this.opts.getAccessToken();
    if (!access) throw new Error('Sign in to use the agent room.');
    return mintLiveToken(access);
  }

  private async open(): Promise<void> {
    this.opts.onStatus?.('Connecting…');
    const { token, model } = await this.takeToken();
    if (this.closed) throw new Error('This session is closed.');
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(`${LIVE_WS_URL}?access_token=${encodeURIComponent(token)}`);
      socket.binaryType = 'arraybuffer';
      let settled = false;
      const watchdog = setTimeout(() => finish(new Error('The voice service did not finish setting up.')), SETUP_TIMEOUT_MS);
      const finish = (err?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(watchdog);
        if (err) {
          try { socket.close(); } catch { /* ignore */ }
          if (this.ws === socket) this.ws = null;
          reject(err);
        } else {
          resolve();
        }
      };
      this.ws = socket;
      this.ready = false;
      this.fresh = true;
      this.goingAway = false;
      socket.onopen = () => {
        const generationConfig: Record<string, unknown> = { responseModalities: [this.opts.mode === 'audio' ? 'AUDIO' : 'TEXT'] };
        if (this.opts.mode === 'audio') {
          generationConfig.speechConfig = { voiceConfig: { prebuiltVoiceConfig: { voiceName: this.opts.voice || 'Kore' } } };
        }
        const setup: Record<string, unknown> = {
          model: `models/${model}`,
          generationConfig,
          systemInstruction: { parts: [{ text: this.opts.systemInstruction }] },
          contextWindowCompression: { slidingWindow: {} },
        };
        if (this.opts.mode === 'audio') setup.outputAudioTranscription = {};
        socket.send(JSON.stringify({ setup }));
      };
      socket.onmessage = (ev) => {
        let msg: any;
        try {
          msg = JSON.parse(typeof ev.data === 'string' ? ev.data : decodeUtf8(ev.data as ArrayBuffer));
        } catch {
          return;
        }
        if (msg.setupComplete) {
          this.ready = true;
          log(this.opts.label, 'session ready');
          finish();
          return;
        }
        if (msg.goAway) {
          // Google will close this socket soon: finish the current turn, then reconnect for the next one.
          this.goingAway = true;
          return;
        }
        if (msg.error && !settled) {
          finish(new Error(String(msg.error?.message ?? 'The voice service returned an error.')));
          return;
        }
        this.onMessage?.(msg);
      };
      socket.onerror = () => {
        if (!settled) finish(new Error('Could not reach the voice service.'));
        else this.onDrop?.('connection error');
      };
      socket.onclose = (ev) => {
        const reason = ev.reason ? `closed: ${ev.reason}` : `closed (${ev.code})`;
        if (!settled) finish(new Error(`The voice service ${reason}.`));
        if (this.ws === socket) {
          this.ws = null;
          this.ready = false;
          if (!this.closed) this.prefetch();
        }
        this.onDrop?.(reason);
      };
    });
  }

  private collect(text: string, timeoutMs: number): Promise<LiveReply> {
    return new Promise<LiveReply>((resolve, reject) => {
      const socket = this.ws;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        const err = new Error('The connection was lost.') as Error & { retryable?: boolean };
        err.retryable = true;
        reject(err);
        return;
      }
      let out = '';
      let transcript = '';
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      let gotAnything = false;
      let done = false;
      const finish = (err?: Error & { retryable?: boolean }) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        this.onMessage = null;
        this.onDrop = null;
        if (err) {
          reject(err);
          return;
        }
        let pcm: Uint8Array | null = null;
        if (this.opts.mode === 'audio') {
          pcm = new Uint8Array(bytes);
          let off = 0;
          for (const c of chunks) { pcm.set(c, off); off += c.length; }
        }
        resolve({ text: (this.opts.mode === 'audio' ? transcript || out : out || transcript).trim(), pcm });
      };
      const timer = setTimeout(() => {
        if (gotAnything) finish();
        else finish(new Error('The reply took too long.'));
      }, timeoutMs);
      this.onMessage = (msg) => {
        const sc = msg.serverContent;
        if (!sc) return;
        for (const part of sc.modelTurn?.parts ?? []) {
          if (typeof part.text === 'string') { out += part.text; gotAnything = true; }
          const data = part.inlineData?.data;
          if (typeof data === 'string' && data) {
            const b = base64ToBytes(data);
            chunks.push(b);
            bytes += b.length;
            gotAnything = true;
          }
        }
        if (typeof sc.outputTranscription?.text === 'string') { transcript += sc.outputTranscription.text; gotAnything = true; }
        if (sc.turnComplete) finish();
      };
      this.onDrop = (reason) => {
        if (gotAnything) finish();
        else {
          const err = new Error(`The connection ${reason}.`) as Error & { retryable?: boolean };
          err.retryable = true;
          finish(err);
        }
      };
      try {
        socket.send(JSON.stringify({ clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true } }));
      } catch {
        const err = new Error('Could not send to the voice service.') as Error & { retryable?: boolean };
        err.retryable = true;
        finish(err);
      }
    });
  }

  private dropSocket(reason: string) {
    const socket = this.ws;
    this.ws = null;
    this.ready = false;
    this.goingAway = false;
    if (socket) {
      log(this.opts.label, 'dropping socket:', reason);
      try { socket.close(); } catch { /* ignore */ }
    }
  }
}
