/**
 * GeminiLiveClient — real-time voice session with the Gemini Live API.
 *
 *   mic (16 kHz PCM, echo-cancelled) ──► Gemini Live (WebSocket, ephemeral token)
 *   speaker (PCM) ◄───────────────────── Gemini Live
 *
 * The connection is "warmed" in the background (token + WebSocket + setup) so that
 * tapping the assistant button only has to switch the microphone on.
 * The app never holds the Gemini API key: the `voice-token` Supabase function
 * checks the logged-in user and mints a short-lived, single-use token.
 */

import {
  addExpoTwoWayAudioEventListener,
  getMicrophonePermissionsAsync,
  initialize as initAudio,
  playPCMData,
  requestMicrophonePermissionsAsync,
  tearDown as tearDownAudio,
  toggleRecording,
} from '@speechmatics/expo-two-way-audio';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/constants/supabase';
import {
  base64ToBytes,
  bytesToBase64,
  decodeUtf8,
  downsample24kTo16k,
  pcm16kDurationMs,
} from './pcm';

const LIVE_WS_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';

/** Patched Android build plays Gemini's native 24 kHz and can flush queued audio. */
const nativeAudio = requireOptionalNativeModule<{ flushPlayback?: () => void }>('ExpoTwoWayAudio');
const CAN_FLUSH = Platform.OS === 'android' && typeof nativeAudio?.flushPlayback === 'function';

/** Without a native flush, keep only this much audio queued so barge-in stays snappy. */
const PLAYBACK_LOOKAHEAD_MS = 250;
const MAX_RECONNECT_DELAY_MS = 5000;
const MAX_LISTENING_RECONNECTS = 8;
/** A mic chunk louder than this counts as the user speaking (keeps the session alive). */
const SPEECH_PEAK = 1500;
const HISTORY_LINES = 10;
/** Longest a single tool may run before Gemini is told it failed. */
const TOOL_TIMEOUT_MS = 25_000;
/** Back to "ready" (socket stays warm) after this long without any speech. */
const LISTEN_IDLE_TIMEOUT_MS = 45_000;

// Diagnostics go to the Metro log in dev builds only; release builds pay nothing for them.
const log: (...args: unknown[]) => void = __DEV__
  ? (...args) => console.log('[live]', ...args)
  : () => {};

const DEFAULT_GREETING_PROMPT =
  '[The user just opened the assistant] Say exactly "Hello." and nothing more, then wait for the user to speak.';

/** How long to wait for the token, for the socket to finish its setup, and for the first reply to the greeting. */
const TOKEN_TIMEOUT_MS = 6000;
const SETUP_TIMEOUT_MS = 8000;
const GREETING_REPLY_TIMEOUT_MS = 6000;

/** Set when the live model refuses a setup that includes Google Search twice in a row, so it is left out after that. */
let searchDisabled = false;

export type LiveState = 'idle' | 'connecting' | 'ready' | 'listening' | 'speaking' | 'error';

export interface LiveToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface GeminiLiveOptions {
  /** Supabase user access token, refreshed if stale (the anon key is rejected by voice-token). */
  getAccessToken: () => Promise<string | null | undefined> | string | null | undefined;
  /** Built fresh on every (re)connect so it can include today's date etc. */
  getSystemInstruction: () => string;
  /** The Gemini voice to speak with (read on every (re)connect, so a changed voice is picked up). */
  getVoiceName?: () => string;
  /** Spoken greeting trigger sent when the user opens the assistant. */
  getGreetingPrompt?: () => string;
  /** Gemini function declarations the assistant is allowed to call. */
  functionDeclarations?: unknown[];
  /** Runs a tool in the app and returns a JSON-serialisable result for Gemini. */
  onToolCall?: (call: LiveToolCall) => Promise<Record<string, unknown>>;
  onState?: (state: LiveState) => void;
  onTranscript?: (role: 'user' | 'assistant', text: string, final: boolean) => void;
  /** 0..1 microphone / speaker loudness, used to animate the assistant. */
  onLevels?: (levels: { input: number; output: number }) => void;
  onError?: (message: string) => void;
}

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private state: LiveState = 'idle';
  private wantWarm = false;
  private socketReady = false;
  private wantListening = false;
  private greeted = false;
  private idleMs = LISTEN_IDLE_TIMEOUT_MS;
  /** While true (an AI call is in progress) silence never switches the microphone off. */
  private holdOpen = false;
  private lastSpeechTouch = 0;
  /** True once the current socket finished setup (used to tell a dead resume handle from a drop). */
  private setupDone = false;
  /** Recent lines of the conversation, replayed to Gemini if a fresh session has to replace a dead one. */
  private history: { role: 'user' | 'assistant'; text: string }[] = [];
  private pendingUser = '';
  private pendingAssistant = '';
  // Diagnostics (visible in the Metro log as [live] lines)
  private micChunks = 0;
  private micPeak = 0;
  private micLogAt = 0;
  private lastUserWordAt = 0;
  private lastInterruptAt = 0;
  private turnFirstAudio = false;
  private requestingPermission = false;
  private audioReady = false;
  private subs: { remove: () => void }[] = [];
  private resumeHandle: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private setupWatchdog: ReturnType<typeof setTimeout> | null = null;
  private greetTimer: ReturnType<typeof setTimeout> | null = null;
  private greetAt = 0;
  private lastContentAt = 0;
  private earlyCloses = 0;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private model = 'gemini-3.8-live';
  private levels = { input: 0, output: 0 };

  // Paced playback, only used where the native player can't flush (iOS).
  private playQueue: Uint8Array[] = [];
  private playedUntil = 0;
  private pumpTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private opts: GeminiLiveOptions) {}

  getState() {
    return this.state;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /** Opens the connection in the background so the first tap is instant. */
  warm() {
    if (this.wantWarm) return;
    this.wantWarm = true;
    this.reconnectAttempts = 0;
    void this.openSocket();
  }

  /** True while the system microphone permission dialog is up (the app briefly looks backgrounded). */
  isRequestingPermission() {
    return this.requestingPermission;
  }

  /** Switches the microphone on (opening the socket first if it isn't ready yet). */
  async startListening() {
    log('startListening, socketReady =', this.socketReady);
    this.wantListening = true;
    this.greeted = false;
    if (!this.wantWarm) this.warm();
    // The user is waiting: do not sit out a back-off delay, connect now.
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

      if (!this.audioReady) {
        // Start from a clean native engine (see the Sarvam client): a stale one survives JavaScript reloads.
        try {
          tearDownAudio();
        } catch {
          /* nothing was running */
        }
        const ok = await initAudio();
        // The native engine swallows failures (e.g. audio focus denied) and returns false.
        if (ok === false) throw new Error('Could not start the audio engine. Close other audio apps or end any call and try again.');
        this.audioReady = true;
        this.subs.push(
          addExpoTwoWayAudioEventListener('onMicrophoneData', (e) => this.sendMic(e.data)),
          addExpoTwoWayAudioEventListener('onInputVolumeLevelData', (e) =>
            this.emitLevels({ input: e.data }),
          ),
          addExpoTwoWayAudioEventListener('onAudioInterruption', (e) =>
            log('AUDIO FOCUS EVENT from system:', e.data),
          ),
          addExpoTwoWayAudioEventListener('onOutputVolumeLevelData', (e) =>
            this.emitLevels({ output: e.data }),
          ),
        );
      }
      if (!this.wantListening) {
        // The user closed the assistant while the engine was still starting: don't leave it
        // running (it holds audio focus and the call-audio mode).
        this.releaseAudio();
        return;
      }
      const recording = toggleRecording(true);
      log('audio ready, recording =', recording);
      if (!recording) throw new Error('Could not start the microphone.');
      this.touch();
      if (this.socketReady) {
        this.setState('listening');
        this.maybeGreet();
      } else {
        this.setState('connecting');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not start listening.';
      log('startListening failed:', message);
      this.wantListening = false;
      this.releaseAudio();
      // Report the error first so the UI knows not to close the panel.
      this.opts.onError?.(message);
      this.setState(this.socketReady ? 'ready' : 'error');
    }
  }

  /** Asks Gemini to say its spoken hello once the mic and speaker are both ready. */
  private maybeGreet() {
    if (this.greeted || !this.wantListening || !this.socketReady || !this.audioReady) return;
    this.greeted = true;
    log('greeting');
    this.lastUserWordAt = 0; // timings below are measured from the user's last word of THIS session
    this.greetAt = Date.now();
    this.send({ realtimeInput: { text: this.opts.getGreetingPrompt?.() ?? DEFAULT_GREETING_PROMPT } });
    // A socket that looks open but is dead would leave the user in silence: if nothing comes back, reconnect and greet again.
    if (this.greetTimer) clearTimeout(this.greetTimer);
    this.greetTimer = setTimeout(() => {
      this.greetTimer = null;
      if (!this.wantListening || this.lastContentAt >= this.greetAt) return;
      log('no reply to the greeting, reconnecting');
      this.greeted = false;
      this.dropSocket();
      this.scheduleReconnect();
    }, GREETING_REPLY_TIMEOUT_MS);
  }

  /** Mic off and audio released, but the connection stays warm for the next tap. */
  stopListening() {
    this.wantListening = false;
    this.lastUserWordAt = 0;
    this.clearPlayback();
    this.releaseAudio();
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    this.emitLevels({ input: 0, output: 0 });
    this.setState(this.socketReady ? 'ready' : this.wantWarm ? 'connecting' : 'idle');
  }

  /**
   * Starts a brand-new session in the background so changed persona settings (voice, name,
   * personality) take effect. Does nothing while a conversation is in progress.
   */
  refresh() {
    if (!this.wantWarm || this.wantListening) return;
    this.resumeHandle = null;
    this.history = [];
    const ws = this.ws;
    if (ws) {
      ws.close(); // onclose reconnects with a fresh session
    } else {
      void this.openSocket();
    }
  }

  /** Closes everything (logout / app backgrounded). */
  shutdown() {
    this.wantWarm = false;
    this.wantListening = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.setupWatchdog) clearTimeout(this.setupWatchdog);
    this.setupWatchdog = null;
    if (this.greetTimer) clearTimeout(this.greetTimer);
    this.greetTimer = null;
    this.clearPlayback();
    this.releaseAudio();
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    const ws = this.ws;
    this.ws = null;
    this.socketReady = false;
    ws?.close();
    this.resumeHandle = null;
    this.setState('idle');
  }

  /** How long silence is tolerated before the mic switches off (longer while the user works on screen). */
  setIdleTimeout(ms: number) {
    this.idleMs = ms;
    this.touch();
  }

  /** Keeps the conversation open through silence (used while the assistant is on a phone call for the user). */
  setHoldOpen(hold: boolean) {
    this.holdOpen = hold;
    this.touch();
  }

  /**
   * Switches the spoken language. Gemini handles the language itself, so this is simply an
   * instruction — there is no voice to swap and no reconnection needed.
   */
  setLanguage(label: string) {
    this.send({
      realtimeInput: {
        text: `[Instruction from the app, not spoken by the user] Speak only in ${label} from now on, starting with your very next sentence, and keep doing so for the rest of this conversation even if the user mixes in other languages.`,
      },
    });
  }

  /** Tells the assistant about an app event so it can speak up about it. */
  notify(text: string) {
    this.send({ realtimeInput: { text: `[Notice from the app, not spoken by the user] ${text}` } });
  }

  /** Lets the app send typed text into the live conversation. */
  sendText(text: string) {
    this.send({ realtimeInput: { text } });
  }

  // ─── Connection ────────────────────────────────────────────────────────────

  private async fetchToken(): Promise<string> {
    const accessToken = await this.opts.getAccessToken();
    if (!accessToken) throw new Error('Please log in to use the voice assistant.');

    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), TOKEN_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${SUPABASE_URL}/functions/v1/voice-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        signal: abort.signal,
      });
    } catch {
      throw new Error('The voice service is slow to respond. Check your connection.');
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new Error(`Voice service unavailable (${res.status}).`);
    const data = await res.json();
    if (!data.token) throw new Error('Voice service returned no token.');
    this.model = data.model;
    return data.token as string;
  }

  private async openSocket() {
    if (!this.wantWarm || this.ws) return;
    if (!this.wantListening) this.setState('connecting');
    let token: string;
    try {
      token = await this.fetchToken();
    } catch (e) {
      log('token fetch failed:', e instanceof Error ? e.message : e);
      this.scheduleReconnect(e instanceof Error ? e.message : undefined);
      return;
    }
    if (!this.wantWarm || this.ws) return;

    const ws = new WebSocket(`${LIVE_WS_URL}?access_token=${encodeURIComponent(token)}`);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    const openedAt = Date.now();
    ws.onopen = () => {
      log('socket open', this.resumeHandle ? '(resuming)' : '(fresh session)');
      this.send(this.buildSetup());
    };
    // A handshake that never completes must not leave "connecting" up for ever: give up on it and start over.
    if (this.setupWatchdog) clearTimeout(this.setupWatchdog);
    this.setupWatchdog = setTimeout(() => {
      this.setupWatchdog = null;
      if (this.ws !== ws || this.setupDone) return;
      log('setup timed out, starting over');
      this.earlyClose();
      this.dropSocket();
      if (this.wantWarm) this.scheduleReconnect();
    }, SETUP_TIMEOUT_MS);
    ws.onmessage = (ev) => this.handleMessage(ev.data);
    ws.onerror = () => {
      /* onclose follows and decides whether to retry */
    };
    ws.onclose = (ev) => {
      log(
        'socket closed',
        (ev as { code?: number }).code,
        (ev as { reason?: string }).reason ?? '',
        '| lived',
        Date.now() - openedAt,
        'ms | setup done:',
        this.ws === ws ? this.setupDone : 'stale socket',
      );
      if (this.ws !== ws) return;
      if (this.setupWatchdog) clearTimeout(this.setupWatchdog);
      this.setupWatchdog = null;
      if (!this.setupDone) this.earlyClose();
      if (this.greetAt > this.lastContentAt) this.greeted = false;
      this.ws = null;
      this.socketReady = false;
      this.clearPlayback();
      this.flushHistoryLines();
      // A socket that dies before finishing setup while resuming means the server no longer
      // accepts that resume handle. Retrying it forever is what left the assistant deaf, so
      // drop it and start a fresh session on the next attempt.
      if (!this.setupDone && this.resumeHandle) {
        log('dropping the stale resume handle, next attempt starts fresh');
        this.resumeHandle = null;
      }
      this.setupDone = false;
      if (this.wantWarm) this.scheduleReconnect();
    };
  }

  /** Closes the current socket without letting its own close handler run, so the caller decides what happens next. */
  private dropSocket() {
    const ws = this.ws;
    this.ws = null;
    this.socketReady = false;
    this.setupDone = false;
    if (ws) {
      ws.onclose = null;
      ws.onmessage = null;
      try {
        ws.close();
      } catch {
        /* already closed */
      }
    }
  }

  /** A socket that died before finishing setup. Twice in a row with Google Search in the setup means the model dislikes it. */
  private earlyClose() {
    this.earlyCloses += 1;
    if (this.earlyCloses >= 2 && !searchDisabled) {
      searchDisabled = true;
      log('setup keeps failing: leaving Google Search out');
    }
  }

  private scheduleReconnect(errorMessage?: string) {
    if (!this.wantWarm || this.reconnectTimer) return;
    this.reconnectAttempts += 1;
    if (this.wantListening && this.reconnectAttempts > MAX_LISTENING_RECONNECTS) {
      // The user is waiting and we can't recover: say so instead of pretending to listen.
      this.opts.onError?.(errorMessage ?? 'Voice connection lost. Please tap the orb to retry.');
      this.wantListening = false;
      this.releaseAudio();
      this.setState('error');
      return;
    }
    // Never show "Listening" while the line is actually down.
    this.setState('connecting');
    const delay = Math.min(MAX_RECONNECT_DELAY_MS, 300 * 2 ** (this.reconnectAttempts - 1));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.openSocket();
    }, delay);
  }

  /** After a fresh (non-resumed) reconnect, remind the model what was just said so it carries on. */
  private systemInstructionWithHistory() {
    const base = this.opts.getSystemInstruction();
    if (this.resumeHandle || !this.history.length) return base;
    const lines = this.history.map((h) => `${h.role === 'user' ? 'User' : 'You'}: ${h.text}`).join('\n');
    return `${base}\n\nThe connection was interrupted and has just been restored. Do NOT greet again. Continue naturally from this recent conversation:\n${lines}`;
  }

  /** Moves the transcript of the turn in progress into the rolling history. */
  private flushHistoryLines() {
    const push = (role: 'user' | 'assistant', text: string) => {
      const t = text.trim();
      if (t) this.history.push({ role, text: t.slice(0, 220) });
    };
    push('user', this.pendingUser);
    push('assistant', this.pendingAssistant);
    this.pendingUser = '';
    this.pendingAssistant = '';
    if (this.history.length > HISTORY_LINES) this.history = this.history.slice(-HISTORY_LINES);
  }

  private buildSetup() {
    const setup: Record<string, unknown> = {
      model: `models/${this.model}`,
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: this.opts.getVoiceName?.() ?? 'Kore' } },
        },
      },
      systemInstruction: { parts: [{ text: this.systemInstructionWithHistory() }] },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      // Tuned for responsiveness: end the user's turn quickly, and don't treat faint
      // noise or the assistant's own echo as the user starting to talk.
      realtimeInputConfig: {
        automaticActivityDetection: {
          startOfSpeechSensitivity: 'START_SENSITIVITY_LOW',
          endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH',
          prefixPaddingMs: 40,
          silenceDurationMs: 400,
        },
      },
      // Lets long conversations run past the default audio session limit.
      contextWindowCompression: { slidingWindow: {} },
      sessionResumption: this.resumeHandle ? { handle: this.resumeHandle } : {},
    };
    // Google Search lets it answer anything fresh (news, weather, scores); the app's own tools sit beside it.
    const tools: Record<string, unknown>[] = [];
    if (!searchDisabled) tools.push({ googleSearch: {} });
    if (this.opts.functionDeclarations?.length) tools.push({ functionDeclarations: this.opts.functionDeclarations });
    if (tools.length) setup.tools = tools;
    return { setup };
  }

  // ─── Incoming messages ─────────────────────────────────────────────────────

  private handleMessage(raw: unknown) {
    let msg: any;
    try {
      const text = typeof raw === 'string' ? raw : decodeUtf8(raw as ArrayBuffer);
      msg = JSON.parse(text);
    } catch {
      return;
    }

    if (msg.setupComplete) {
      if (this.setupWatchdog) clearTimeout(this.setupWatchdog);
      this.setupWatchdog = null;
      this.earlyCloses = 0;
      this.reconnectAttempts = 0;
      this.socketReady = true;
      this.setupDone = true;
      log('setupComplete');
      this.setState(this.wantListening ? 'listening' : 'ready');
      this.maybeGreet();
      return;
    }

    if (msg.sessionResumptionUpdate) {
      // Only keep handles Gemini says can actually be resumed from (not mid-generation ones).
      const { newHandle, resumable } = msg.sessionResumptionUpdate;
      if (newHandle && resumable !== false) this.resumeHandle = newHandle;
    }

    if (msg.goAway) {
      // Server is about to close; reconnect (quietly) with the resumption handle.
      this.ws?.close();
      return;
    }

    if (msg.toolCall?.functionCalls) {
      void this.runTools(msg.toolCall.functionCalls as LiveToolCall[]);
    }

    const sc = msg.serverContent;
    if (!sc) return;
    this.lastContentAt = Date.now();
    this.touch();

    if (sc.interrupted) {
      this.lastInterruptAt = Date.now();
      log('INTERRUPTED by server VAD');
      this.clearPlayback();
      this.setState('listening');
    }

    if (sc.inputTranscription?.text) {
      this.lastUserWordAt = Date.now();
      this.turnFirstAudio = false;
      log('you said:', sc.inputTranscription.text);
      this.pendingUser += sc.inputTranscription.text;
      this.opts.onTranscript?.('user', sc.inputTranscription.text, false);
    }
    if (sc.outputTranscription?.text) {
      this.pendingAssistant += sc.outputTranscription.text;
      this.opts.onTranscript?.('assistant', sc.outputTranscription.text, false);
    }

    for (const part of sc.modelTurn?.parts ?? []) {
      const data = part.inlineData?.data;
      if (data) {
        if (!this.turnFirstAudio) {
          this.turnFirstAudio = true;
          log(
            'first audio of reply, ms since your last word:',
            this.lastUserWordAt ? Date.now() - this.lastUserWordAt : 'n/a',
            '| ms since last interrupt:',
            this.lastInterruptAt ? Date.now() - this.lastInterruptAt : 'n/a',
          );
        }
        this.enqueueAudio(base64ToBytes(data));
        if (this.wantListening) this.setState('speaking');
      }
    }

    if (sc.turnComplete) {
      log('turnComplete');
      this.turnFirstAudio = false;
      this.flushHistoryLines();
      this.opts.onTranscript?.('assistant', '', true);
      if (CAN_FLUSH) {
        // Native player has no "finished" callback; the output level dropping to 0 ends it.
        this.speakingTail();
      } else if (!this.playQueue.length) {
        this.setState(this.wantListening ? 'listening' : 'ready');
      }
    }
  }

  private async runTools(calls: LiveToolCall[]) {
    const functionResponses = await Promise.all(
      calls.map(async (call) => {
        let response: Record<string, unknown>;
        log('tool call', call.name, JSON.stringify(call.args));
        try {
          // A tool that never finishes must not leave Gemini waiting (and the user in silence).
          const timeout = new Promise<Record<string, unknown>>((resolve) =>
            setTimeout(() => resolve({ ok: false, error: 'That took too long and was stopped.' }), TOOL_TIMEOUT_MS),
          );
          response = this.opts.onToolCall
            ? await Promise.race([this.opts.onToolCall(call), timeout])
            : { error: 'No tools are available.' };
        } catch (e) {
          response = { error: e instanceof Error ? e.message : 'Tool failed.' };
        }
        log('tool result', call.name, JSON.stringify(response).slice(0, 300));
        return { id: call.id, name: call.name, response };
      }),
    );
    this.send({ toolResponse: { functionResponses } });
  }

  // ─── Audio out ─────────────────────────────────────────────────────────────

  private tailTimer: ReturnType<typeof setTimeout> | null = null;

  private speakingTail() {
    if (this.tailTimer) clearTimeout(this.tailTimer);
    this.tailTimer = setTimeout(() => {
      this.tailTimer = null;
      if (this.state === 'speaking' && this.levels.output < 0.02) {
        this.setState(this.wantListening ? 'listening' : 'ready');
      } else if (this.state === 'speaking') {
        this.speakingTail();
      }
    }, 400);
  }

  private enqueueAudio(pcm24k: Uint8Array) {
    if (!this.audioReady) return; // assistant spoke while mic/speaker engine is off
    if (CAN_FLUSH) {
      playPCMData(pcm24k);
      return;
    }
    this.playQueue.push(downsample24kTo16k(pcm24k));
    if (this.pumpTimer) {
      clearTimeout(this.pumpTimer);
      this.pumpTimer = null;
    }
    this.pump();
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
    } else {
      const remaining = Math.max(0, this.playedUntil - Date.now());
      this.pumpTimer = setTimeout(() => {
        this.pumpTimer = null;
        if (!this.playQueue.length && this.state === 'speaking') {
          this.setState(this.wantListening ? 'listening' : 'ready');
        }
      }, remaining + 50);
    }
  }

  private clearPlayback() {
    this.playQueue = [];
    if (this.pumpTimer) {
      clearTimeout(this.pumpTimer);
      this.pumpTimer = null;
    }
    this.playedUntil = 0;
    if (CAN_FLUSH && this.audioReady) {
      try {
        nativeAudio!.flushPlayback!();
      } catch {
        /* ignore */
      }
    }
  }

  // ─── Audio in ──────────────────────────────────────────────────────────────

  private sendMic(pcm: Uint8Array) {
    // Every 2 s: how much audio we are sending and how loud it is (0..32767).
    if (pcm.length >= 2) {
      const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.length - (pcm.length % 2));
      let chunkPeak = 0;
      for (let i = 0; i < view.byteLength; i += 8) {
        const v = Math.abs(view.getInt16(i, true));
        if (v > chunkPeak) chunkPeak = v;
      }
      if (chunkPeak > this.micPeak) this.micPeak = chunkPeak;
      // The user talking counts as activity, so the idle timer doesn't cut in mid-conversation.
      if (chunkPeak > SPEECH_PEAK && Date.now() - this.lastSpeechTouch > 1500) {
        this.lastSpeechTouch = Date.now();
        this.touch();
      }
    }
    this.micChunks += 1;
    const now = Date.now();
    if (now - this.micLogAt > 2000) {
      log('mic: chunks', this.micChunks, 'peak', this.micPeak, 'socketReady', this.socketReady);
      this.micChunks = 0;
      this.micPeak = 0;
      this.micLogAt = now;
    }
    if (!this.socketReady || this.ws?.readyState !== WebSocket.OPEN) return;
    this.send({
      realtimeInput: { audio: { data: bytesToBase64(pcm), mimeType: 'audio/pcm;rate=16000' } },
    });
  }

  private send(payload: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(payload));
  }

  private emitLevels(partial: Partial<{ input: number; output: number }>) {
    this.levels = { ...this.levels, ...partial };
    this.opts.onLevels?.(this.levels);
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /** Stops listening after a stretch of silence so an open mic can't burn credits. */
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
    this.subs.forEach((s) => s.remove());
    this.subs = [];
    if (this.tailTimer) clearTimeout(this.tailTimer);
    this.tailTimer = null;
    if (!this.audioReady) return;
    try {
      toggleRecording(false);
    } catch {
      /* audio engine may already be down */
    }
    try {
      tearDownAudio();
    } catch {
      /* ignore */
    }
    this.audioReady = false;
  }
}

/** True if the user already granted the microphone (used to decide if we can start instantly). */
export async function hasMicPermission(): Promise<boolean> {
  try {
    return (await getMicrophonePermissionsAsync()).granted;
  } catch {
    return false;
  }
}
