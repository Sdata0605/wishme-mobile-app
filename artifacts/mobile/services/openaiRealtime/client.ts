/**
 * OpenAI Realtime voice client: the same surface as GeminiLiveClient, so AssistantEngine can use either.
 *
 * The app never holds the OpenAI API key: the backend's `voice-token` function mints a short-lived client secret
 * (`ek_…`) and the app opens wss://api.openai.com/v1/realtime?model=<model> with it. Audio is 24 kHz PCM both ways; the
 * microphone module records at 16 kHz, so it is upsampled before sending. Tools are the same declarations the other
 * engines use (Gemini-style types are converted to JSON Schema).
 */
import {
  addExpoTwoWayAudioEventListener,
  initialize as initAudio,
  playPCMData,
  requestMicrophonePermissionsAsync,
  tearDown as tearDownAudio,
  toggleRecording,
} from '@speechmatics/expo-two-way-audio';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/constants/supabase';
import type { LiveState, LiveToolCall } from '@/services/geminiLive/client';
import { base64ToBytes, bytesToBase64, downsample24kTo16k, pcm16kDurationMs } from '@/services/geminiLive/pcm';
import { toRealtimeTools, upsample16kTo24k } from './convert';

const REALTIME_WS = 'wss://api.openai.com/v1/realtime';
const nativeAudio = requireOptionalNativeModule<{ flushPlayback?: () => void }>('ExpoTwoWayAudio');
const CAN_FLUSH = Platform.OS === 'android' && typeof nativeAudio?.flushPlayback === 'function';

const TOKEN_TIMEOUT_MS = 8000;
const SETUP_TIMEOUT_MS = 10_000;
const MAX_RECONNECT_DELAY_MS = 5000;
const TOOL_TIMEOUT_MS = 25_000;
const LISTEN_IDLE_TIMEOUT_MS = 45_000;
const PLAYBACK_LOOKAHEAD_MS = 250;
const EARLY_AUDIO_MAX_BYTES = 24_000 * 2 * 8; // 8 s of 24 kHz speech held while the speaker starts
const SPEECH_PEAK = 1500;
const DEFAULT_GREETING_PROMPT = 'The user just opened the assistant. Greet them in one short, warm sentence and ask how you can help.';

const log: (...args: unknown[]) => void = __DEV__ ? (...args) => console.log('[openai]', ...args) : () => {};

export interface OpenAIRealtimeOptions {
  getAccessToken: () => Promise<string | null | undefined> | string | null | undefined;
  onAuthRejected?: () => void;
  getSystemInstruction: () => string;
  getGreetingPrompt?: () => string;
  functionDeclarations?: unknown[];
  onToolCall?: (call: LiveToolCall) => Promise<Record<string, unknown>>;
  onState?: (state: LiveState) => void;
  onTranscript?: (role: 'user' | 'assistant', text: string, final: boolean) => void;
  onLevels?: (levels: { input: number; output: number }) => void;
  onError?: (message: string) => void;
  onServerConfig?: (config: { engine?: string; fallback: 'gemini' | 'sarvam' | null; relayUrl?: string }) => void;
}

class AuthRejectedError extends Error {
  constructor() {
    super('Please log in again to use the voice assistant.');
  }
}

export class OpenAIRealtimeClient {
  private ws: WebSocket | null = null;
  private state: LiveState = 'idle';
  private wantWarm = false;
  private wantListening = false;
  private socketReady = false;
  private audioReady = false;
  private requestingPermission = false;
  private greeted = false;
  private idleMs = LISTEN_IDLE_TIMEOUT_MS;
  private holdOpen = false;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private setupTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private lastSpeechTouch = 0;
  private subs: { remove: () => void }[] = [];
  private levels = { input: 0, output: 0 };
  private playQueue: Uint8Array[] = [];
  private playedUntil = 0;
  private pumpTimer: ReturnType<typeof setTimeout> | null = null;
  private earlyAudio: Uint8Array[] = [];
  private earlyAudioBytes = 0;
  private assistantText = '';
  /** A response is being generated right now (a new response.create would be refused). */
  private responseActive = false;
  /** Tool results were sent during the current response: ask for a follow-up once it finishes. */
  private toolOutputsPending = 0;
  private needFollowUp = false;

  constructor(private opts: OpenAIRealtimeOptions) {}

  getState() {
    return this.state;
  }

  isRequestingPermission() {
    return this.requestingPermission;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  warm() {
    if (this.wantWarm) return;
    this.wantWarm = true;
    this.reconnectAttempts = 0;
    void this.openSocket();
  }

  async startListening() {
    this.wantListening = true;
    this.greeted = false;
    if (!this.wantWarm) this.warm();
    if (!this.socketReady && !this.ws && this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      this.reconnectAttempts = 0;
      void this.openSocket();
    }
    try {
      this.requestingPermission = true;
      let perm;
      try {
        perm = await requestMicrophonePermissionsAsync();
      } finally {
        this.requestingPermission = false;
      }
      if (!perm.granted) throw new Error('Microphone permission is needed for the voice assistant.');
      if (!this.audioReady && this.socketReady) this.maybeGreet(true);
      if (!this.audioReady) {
        try {
          tearDownAudio();
        } catch {
          /* nothing was running */
        }
        const ok = await initAudio();
        if (ok === false) throw new Error('Could not start the audio engine. Close other audio apps or end any call and try again.');
        this.audioReady = true;
        this.subs.push(
          addExpoTwoWayAudioEventListener('onMicrophoneData', (e) => this.sendMic(e.data)),
          addExpoTwoWayAudioEventListener('onInputVolumeLevelData', (e) => this.emitLevels({ input: e.data })),
          addExpoTwoWayAudioEventListener('onOutputVolumeLevelData', (e) => this.emitLevels({ output: e.data })),
        );
      }
      if (!this.wantListening) {
        this.releaseAudio();
        return;
      }
      if (!toggleRecording(true)) throw new Error('Could not start the microphone.');
      this.touch();
      if (this.socketReady) {
        this.setState(this.flushEarlyAudio() ? 'speaking' : 'listening');
        this.maybeGreet();
      } else {
        this.setState('connecting');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not start listening.';
      this.wantListening = false;
      this.releaseAudio();
      this.opts.onError?.(message);
      this.setState(this.socketReady ? 'ready' : 'error');
    }
  }

  stopListening() {
    this.wantListening = false;
    this.clearPlayback();
    this.releaseAudio();
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    if (this.responseActive) this.send({ type: 'response.cancel' });
    this.emitLevels({ input: 0, output: 0 });
    this.setState(this.socketReady ? 'ready' : this.wantWarm ? 'connecting' : 'idle');
  }

  /** A fresh session in the background (changed persona or settings), unless a conversation is going on. */
  refresh() {
    if (!this.wantWarm || this.wantListening) return;
    if (this.ws) this.ws.close();
    else void this.openSocket();
  }

  shutdown() {
    this.wantWarm = false;
    this.wantListening = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.clearSetupTimer();
    this.clearPlayback();
    this.releaseAudio();
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    const ws = this.ws;
    this.ws = null;
    this.socketReady = false;
    ws?.close();
    this.setState('idle');
  }

  setIdleTimeout(ms: number) {
    this.idleMs = ms;
    this.touch();
  }

  setHoldOpen(hold: boolean) {
    this.holdOpen = hold;
    this.touch();
  }

  setLanguage(label: string) {
    this.addSystemNote(
      `Speak only in ${label} from now on, starting with your very next sentence, and keep doing so for the rest of this conversation even if the user mixes in other languages.`,
      false,
    );
  }

  /** Tells the assistant about an app event so it can speak up about it. */
  notify(text: string) {
    this.addSystemNote(`Notice from the app, not spoken by the user: ${text}`, true);
  }

  sendText(text: string) {
    this.send({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } });
    this.requestResponse();
  }

  // ─── Connection ────────────────────────────────────────────────────────────

  private async fetchToken(): Promise<{ token: string; model: string }> {
    const accessToken = await this.opts.getAccessToken();
    if (!accessToken) throw new Error('Please log in to use the voice assistant.');
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), TOKEN_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${SUPABASE_URL}/functions/v1/voice-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ want: 'openai', supports: ['openai', 'gemini', 'sarvam'] }),
        signal: abort.signal,
      });
    } catch {
      throw new Error('The voice service is slow to respond. Check your connection.');
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 401) {
      this.opts.onAuthRejected?.();
      throw new AuthRejectedError();
    }
    if (!res.ok) throw new Error(`Voice service unavailable (${res.status}).`);
    const data = (await res.json()) as { engine?: string; token?: string; model?: string; fallback_engine?: string | null; relay_url?: string };
    this.opts.onServerConfig?.({
      engine: data.engine,
      fallback: data.fallback_engine === 'gemini' || data.fallback_engine === 'sarvam' ? data.fallback_engine : null,
      relayUrl: data.relay_url,
    });
    if (data.engine !== 'openai' || !data.token || !data.model) throw new Error('OpenAI voice is not available right now.');
    return { token: data.token, model: data.model };
  }

  private async openSocket() {
    if (this.ws || !this.wantWarm) return;
    this.setState(this.wantListening ? 'connecting' : this.state === 'idle' ? 'connecting' : this.state);
    let creds: { token: string; model: string };
    try {
      creds = await this.fetchToken();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Voice service unavailable.';
      log('token failed:', message);
      if (this.wantListening) this.opts.onError?.(message);
      this.setState('error');
      if (!(e instanceof AuthRejectedError)) this.scheduleReconnect();
      return;
    }
    if (!this.wantWarm || this.ws) return;
    // React Native's WebSocket takes headers as a third argument (browsers cannot, hence the cast).
    const WS = WebSocket as unknown as new (url: string, protocols: string[] | null, options: { headers: Record<string, string> }) => WebSocket;
    const ws = new WS(`${REALTIME_WS}?model=${encodeURIComponent(creds.model)}`, null, { headers: { Authorization: `Bearer ${creds.token}` } });
    this.ws = ws;
    this.socketReady = false;
    this.clearSetupTimer();
    this.setupTimer = setTimeout(() => {
      log('setup timed out');
      ws.close();
    }, SETUP_TIMEOUT_MS);
    ws.onopen = () => {
      this.send({
        type: 'session.update',
        session: {
          type: 'realtime',
          instructions: this.opts.getSystemInstruction(),
          tools: toRealtimeTools(this.opts.functionDeclarations),
          tool_choice: 'auto',
          audio: {
            input: {
              format: { type: 'audio/pcm', rate: 24000 },
              turn_detection: { type: 'semantic_vad' },
              transcription: { model: 'whisper-1' },
            },
            output: { format: { type: 'audio/pcm', rate: 24000 } },
          },
        },
      });
    };
    ws.onmessage = (e) => {
      try {
        this.onEvent(JSON.parse(String(e.data)) as RealtimeEvent);
      } catch (err) {
        log('bad event', err);
      }
    };
    ws.onerror = () => log('socket error');
    ws.onclose = (e) => {
      log('socket closed', e.code, e.reason);
      if (this.ws !== ws) return;
      this.ws = null;
      this.socketReady = false;
      this.responseActive = false;
      this.clearSetupTimer();
      if (this.wantWarm) {
        if (this.wantListening) this.setState('connecting');
        this.scheduleReconnect();
      } else {
        this.setState('idle');
      }
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || !this.wantWarm) return;
    const delay = Math.min(MAX_RECONNECT_DELAY_MS, 500 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.openSocket();
    }, delay);
  }

  private clearSetupTimer() {
    if (this.setupTimer) clearTimeout(this.setupTimer);
    this.setupTimer = null;
  }

  // ─── Server events ─────────────────────────────────────────────────────────

  private onEvent(ev: RealtimeEvent) {
    switch (ev.type) {
      case 'session.updated':
        if (!this.socketReady) {
          this.socketReady = true;
          this.reconnectAttempts = 0;
          this.clearSetupTimer();
          log('session ready');
          if (this.wantListening && this.audioReady) {
            this.setState('listening');
            this.maybeGreet();
          } else if (this.wantListening) {
            this.maybeGreet(true);
          } else {
            this.setState('ready');
          }
        }
        return;
      case 'response.created':
        this.responseActive = true;
        this.assistantText = '';
        return;
      case 'response.output_audio.delta':
        if (ev.delta) {
          this.enqueueAudio(base64ToBytes(ev.delta));
          if (this.audioReady && this.wantListening) this.setState('speaking');
        }
        return;
      case 'response.output_audio_transcript.delta':
        if (ev.delta) {
          this.assistantText += ev.delta;
          this.opts.onTranscript?.('assistant', this.assistantText, false);
        }
        return;
      case 'response.output_audio_transcript.done':
        this.opts.onTranscript?.('assistant', ev.transcript ?? this.assistantText, true);
        this.assistantText = '';
        return;
      case 'conversation.item.input_audio_transcription.completed':
        if (ev.transcript?.trim()) this.opts.onTranscript?.('user', ev.transcript.trim(), true);
        return;
      case 'input_audio_buffer.speech_started':
        // The user talks over the assistant: the server stops its answer, the phone stops playing it.
        this.clearPlayback();
        this.touch();
        if (this.wantListening) this.setState('listening');
        return;
      case 'response.function_call_arguments.done':
        void this.runTool(ev);
        return;
      case 'response.done':
        this.responseActive = false;
        if (this.needFollowUp && this.toolOutputsPending === 0) {
          this.needFollowUp = false;
          this.requestResponse();
        }
        this.settleAfterSpeech();
        return;
      case 'error': {
        const message = ev.error?.message ?? 'Voice error';
        log('server error:', ev.error?.code, message);
        // An answer that was already finished cannot be cancelled: harmless.
        if (ev.error?.code === 'response_cancel_not_active') return;
        if (!this.socketReady && this.wantListening) this.opts.onError?.(message);
        return;
      }
      default:
    }
  }

  private async runTool(ev: RealtimeEvent) {
    const callId = ev.call_id ?? '';
    const name = ev.name ?? '';
    let args: Record<string, unknown> = {};
    try {
      args = ev.arguments ? (JSON.parse(ev.arguments) as Record<string, unknown>) : {};
    } catch {
      args = {};
    }
    this.toolOutputsPending += 1;
    this.needFollowUp = true;
    this.touch();
    let result: Record<string, unknown>;
    try {
      const call = this.opts.onToolCall?.({ id: callId, name, args }) ?? Promise.resolve({ ok: false, error: 'No tools here.' });
      result = await Promise.race([
        call,
        new Promise<Record<string, unknown>>((resolve) => setTimeout(() => resolve({ ok: false, error: 'That took too long.' }), TOOL_TIMEOUT_MS)),
      ]);
    } catch (e) {
      result = { ok: false, error: e instanceof Error ? e.message : 'The action failed.' };
    }
    this.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(result) } });
    this.toolOutputsPending -= 1;
    if (this.toolOutputsPending === 0 && !this.responseActive && this.needFollowUp) {
      this.needFollowUp = false;
      this.requestResponse();
    }
  }

  private requestResponse() {
    if (this.responseActive) {
      this.needFollowUp = true;
      return;
    }
    this.responseActive = true;
    this.send({ type: 'response.create' });
  }

  private addSystemNote(text: string, respond: boolean) {
    this.send({ type: 'conversation.item.create', item: { type: 'message', role: 'system', content: [{ type: 'input_text', text }] } });
    if (respond) this.requestResponse();
  }

  private maybeGreet(early = false) {
    if (this.greeted || !this.wantListening || !this.socketReady || (!this.audioReady && !early)) return;
    this.greeted = true;
    this.addSystemNote(this.opts.getGreetingPrompt?.() ?? DEFAULT_GREETING_PROMPT, true);
  }

  // ─── Audio ─────────────────────────────────────────────────────────────────

  private sendMic(pcm16k: Uint8Array) {
    if (pcm16k.length >= 2) {
      const view = new DataView(pcm16k.buffer, pcm16k.byteOffset, pcm16k.length - (pcm16k.length % 2));
      let peak = 0;
      for (let i = 0; i < view.byteLength; i += 8) peak = Math.max(peak, Math.abs(view.getInt16(i, true)));
      if (peak > SPEECH_PEAK && Date.now() - this.lastSpeechTouch > 1500) {
        this.lastSpeechTouch = Date.now();
        this.touch();
      }
    }
    if (!this.socketReady || this.ws?.readyState !== WebSocket.OPEN) return;
    this.send({ type: 'input_audio_buffer.append', audio: bytesToBase64(upsample16kTo24k(pcm16k)) });
  }

  private enqueueAudio(pcm24k: Uint8Array) {
    if (!this.audioReady) {
      if (this.wantListening && this.greeted && this.earlyAudioBytes < EARLY_AUDIO_MAX_BYTES) {
        this.earlyAudio.push(pcm24k);
        this.earlyAudioBytes += pcm24k.length;
      }
      return;
    }
    if (CAN_FLUSH) {
      playPCMData(pcm24k);
      return;
    }
    this.playQueue.push(downsample24kTo16k(pcm24k));
    this.pump();
  }

  private flushEarlyAudio(): boolean {
    const held = this.earlyAudio;
    this.earlyAudio = [];
    this.earlyAudioBytes = 0;
    if (!held.length || !this.audioReady) return false;
    for (const chunk of held) this.enqueueAudio(chunk);
    return true;
  }

  private pump() {
    if (this.pumpTimer) return;
    const now = Date.now();
    if (this.playedUntil < now) this.playedUntil = now;
    while (this.playQueue.length && this.playedUntil - now < PLAYBACK_LOOKAHEAD_MS) {
      const chunk = this.playQueue.shift()!;
      playPCMData(chunk);
      this.playedUntil += pcm16kDurationMs(chunk);
    }
    if (this.playQueue.length) {
      this.pumpTimer = setTimeout(() => {
        this.pumpTimer = null;
        this.pump();
      }, 50);
    }
  }

  /** After an answer, go back to "listening" once the speaker has played it out. */
  private settleAfterSpeech() {
    if (this.state !== 'speaking') return;
    const wait = CAN_FLUSH ? 600 : Math.max(0, this.playedUntil - Date.now()) + 50;
    setTimeout(() => {
      if (this.state === 'speaking' && !this.responseActive) this.setState(this.wantListening ? 'listening' : 'ready');
    }, wait);
  }

  private clearPlayback() {
    this.playQueue = [];
    if (this.pumpTimer) clearTimeout(this.pumpTimer);
    this.pumpTimer = null;
    this.playedUntil = 0;
    if (CAN_FLUSH && this.audioReady) {
      try {
        nativeAudio!.flushPlayback!();
      } catch {
        /* ignore */
      }
    }
  }

  private send(payload: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(payload));
  }

  private emitLevels(partial: Partial<{ input: number; output: number }>) {
    this.levels = { ...this.levels, ...partial };
    this.opts.onLevels?.(this.levels);
  }

  private touch() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    if (!this.wantListening || this.holdOpen) return;
    this.idleTimer = setTimeout(() => this.stopListening(), this.idleMs);
  }

  private setState(state: LiveState) {
    if (this.state === state) return;
    log('state', this.state, '->', state);
    this.state = state;
    this.opts.onState?.(state);
  }

  private releaseAudio() {
    this.earlyAudio = [];
    this.earlyAudioBytes = 0;
    this.subs.forEach((s) => s.remove());
    this.subs = [];
    if (!this.audioReady) return;
    try {
      toggleRecording(false);
    } catch {
      /* already down */
    }
    try {
      tearDownAudio();
    } catch {
      /* ignore */
    }
    this.audioReady = false;
  }
}

interface RealtimeEvent {
  type: string;
  delta?: string;
  transcript?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  error?: { code?: string; message?: string };
}
