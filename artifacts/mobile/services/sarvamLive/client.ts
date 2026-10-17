/**
 * SarvamLiveClient — real-time voice conversation through the `sarvam-voice` Supabase relay.
 *
 *   mic (16 kHz PCM, echo-cancelled) ──► relay ──► Sarvam speech-to-text → chat model → text-to-speech
 *   speaker (24 kHz PCM) ◄──────────────────────── relay
 *
 * Unlike the Gemini client there is no always-on connection: a Supabase function can't idle for
 * long, so the relay session starts when the user taps and ends when they close the assistant.
 * Tools (open a screen, tap, call...) still run here on the phone: the relay forwards the model's
 * tool calls and we send the results back.
 *
 * It exposes the same surface as GeminiLiveClient so the provider can use either.
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
import { SUPABASE_WS_URL } from '@/constants/supabase';
import { parseOpenAppCommand } from '@/services/assistant/appCommand';
import { getAppIndex } from '@/services/assistant/installedApps';
import { base64ToBytes, bytesToBase64, downsample24kTo16k } from '@/services/geminiLive/pcm';
import type { LiveState, LiveToolCall } from '@/services/geminiLive/client';

const log: (...args: unknown[]) => void = __DEV__ ? (...args) => console.log('[sarvam]', ...args) : () => {};

const nativeAudio = requireOptionalNativeModule<{ flushPlayback?: () => void }>('ExpoTwoWayAudio');
const CAN_FLUSH = Platform.OS === 'android' && typeof nativeAudio?.flushPlayback === 'function';

const CONNECT_TIMEOUT_MS = 8_000;
const FAST_CONNECT_TIMEOUT_MS = 6_000;
const TOOL_TIMEOUT_MS = 25_000;
const MAX_RECONNECTS = 3;
const LISTEN_IDLE_TIMEOUT_MS = 45_000;
const SPEECH_PEAK = 1500;
const HISTORY_LINES = 10;
/** The idle standby connection sends a tiny message this often so no gateway on the way closes it for being quiet. */
const STANDBY_PING_MS = 25_000;
/** After this many standby connections in a row that died within seconds, stop opening new ones until the next warm-up. */
const STANDBY_MAX_FAST_FAILS = 4;

interface Standby {
  ws: WebSocket;
  born: number;
  authSent: boolean;
  ping: ReturnType<typeof setInterval> | null;
}

export interface SarvamLiveOptions {
  /** Supabase user access token, refreshed if stale. */
  getAccessToken: () => Promise<string | null | undefined> | string | null | undefined;
  getSystemInstruction: () => string;
  /** Sarvam speaker name, e.g. "ritu". */
  getSpeaker: () => string;
  /** 'auto' | 'english' | 'hindi' | 'hinglish' */
  getLanguage: () => string;
  /** The exact opening sentence, spoken straight away when the session starts. */
  getGreetingLine: () => string;
  functionDeclarations?: unknown[];
  onToolCall?: (call: LiveToolCall) => Promise<Record<string, unknown>>;
  onState?: (state: LiveState) => void;
  onTranscript?: (role: 'user' | 'assistant', text: string, final: boolean) => void;
  onLevels?: (levels: { input: number; output: number }) => void;
  onError?: (message: string) => void;
}

export class SarvamLiveClient {
  private state: LiveState = 'idle';
  private ws: WebSocket | null = null;
  private relayUrl = '';
  private wantWarm = false;
  private wantListening = false;
  private relayReady = false;
  private audioReady = false;
  private greeted = false;
  private subs: { remove: () => void }[] = [];
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private idleMs = LISTEN_IDLE_TIMEOUT_MS;
  /** While true (an AI call is in progress) silence never switches the microphone off. */
  private holdOpen = false;
  private lastSpeechTouch = 0;
  private levels = { input: 0, output: 0 };
  private tailTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnects = 0;
  /** Replies older than this belong to an answer the user already interrupted. */
  private minGen = 0;
  private lastAudioAt = 0;
  /** Microphone audio captured while reconnecting, replayed once the relay is back (so nothing you say is lost). */
  private micBuffer: string[] = [];
  private suppressErrors = false;
  private requestingPermission = false;
  // Diagnostics (dev log): is microphone audio actually reaching the relay?
  private micSent = 0;
  private micPeak = 0;
  private micLogAt = 0;
  private history: { role: 'user' | 'assistant'; text: string }[] = [];
  private pendingUser = '';
  private pendingAssistant = '';
  private lastQuickOpen = { app: '', at: 0 };
  /** A relay connection that is already open and logged in, waiting for the user's tap (see openStandby). */
  private standby: Standby | null = null;
  private standbyFastFails = 0;
  private standbyTimer: ReturnType<typeof setTimeout> | null = null;
  /** When the user tapped, to log how long the assistant took to start listening. */
  private tapAt = 0;

  constructor(private opts: SarvamLiveOptions) {}

  getState() {
    return this.state;
  }

  /** True while the system microphone permission dialog is up (the app briefly looks backgrounded). */
  isRequestingPermission() {
    return this.requestingPermission;
  }

  setRelayUrl(url: string) {
    this.relayUrl = url;
  }

  // ─── Public API (same shape as GeminiLiveClient) ───────────────────────────

  /**
   * No conversation is kept running in advance, but a relay connection is opened and logged in ahead of the tap
   * (a "standby"), so the tap only has to send the session setup: no function boot, no TLS and WebSocket handshake and
   * no login check on the way to the first word.
   */
  warm() {
    this.wantWarm = true;
    if (!this.wantListening) this.setState('ready');
    this.standbyFastFails = 0;
    void this.openStandby();
  }

  private relayWsUrl() {
    return this.relayUrl || `${SUPABASE_WS_URL}/functions/v1/sarvam-voice`;
  }

  private wakeRelay() {
    // A plain request is answered "expected a WebSocket" straight away, but it boots the function.
    fetch(this.relayWsUrl().replace(/^ws/, 'http'), { method: 'GET' }).catch(() => {});
  }

  /** Opens and logs in a relay connection that waits for the user's tap. Quietly does nothing if it can't. */
  private async openStandby() {
    if (this.standby || this.ws || !this.wantWarm) return;
    let token: string | null | undefined;
    try {
      token = await this.opts.getAccessToken();
    } catch {
      token = null;
    }
    if (!token) {
      this.wakeRelay();
      return;
    }
    if (this.standby || this.ws || !this.wantWarm) return;

    const ws = new WebSocket(this.relayWsUrl());
    const entry: Standby = { ws, born: Date.now(), authSent: false, ping: null };
    this.standby = entry;
    ws.onopen = () => {
      log('standby open');
      ws.send(JSON.stringify({ type: 'auth', token }));
      entry.authSent = true;
      entry.ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('{"type":"ping"}');
      }, STANDBY_PING_MS);
    };
    ws.onmessage = (ev) => {
      // Only a refusal matters here (a bad login): the next connect will report it properly.
      try {
        if (JSON.parse(String(ev.data)).type === 'error') this.discardStandby(entry);
      } catch {
        /* not JSON */
      }
    };
    const lost = () => {
      const wasCurrent = this.standby === entry;
      this.discardStandby(entry, false);
      if (!wasCurrent) return;
      // One that dies within seconds, again and again, means something is wrong: stop retrying until the next warm-up.
      this.standbyFastFails = Date.now() - entry.born < 10_000 ? this.standbyFastFails + 1 : 0;
      if (this.wantWarm && !this.wantListening) this.scheduleStandby(Math.min(30_000, 1500 * 2 ** this.standbyFastFails));
    };
    ws.onclose = lost;
    ws.onerror = lost;
  }

  private scheduleStandby(delayMs: number) {
    if (this.standbyTimer || this.standbyFastFails >= STANDBY_MAX_FAST_FAILS) return;
    this.standbyTimer = setTimeout(() => {
      this.standbyTimer = null;
      void this.openStandby();
    }, delayMs);
  }

  private discardStandby(entry: Standby, close = true) {
    if (entry.ping) clearInterval(entry.ping);
    entry.ping = null;
    if (this.standby === entry) this.standby = null;
    if (close) {
      entry.ws.onclose = null;
      entry.ws.onerror = null;
      entry.ws.onmessage = null;
      try {
        entry.ws.close();
      } catch {
        /* already closed */
      }
    }
  }

  /** Hands over the standby connection (still opening or open) for the session to use, or null if there is none. */
  private takeStandby(): Standby | null {
    const s = this.standby;
    if (!s || s.ws.readyState > WebSocket.OPEN) return null;
    if (s.ping) clearInterval(s.ping);
    s.ping = null;
    this.standby = null;
    s.ws.onclose = null;
    s.ws.onerror = null;
    s.ws.onmessage = null;
    s.ws.onopen = null;
    return s;
  }

  /**
   * Starts listening. Resolves true once the relay is ready, false if it could not start.
   * With `suppressErrors` the failure is not shown to the user (the caller will try a fallback).
   */
  async startListening(suppressErrors = false): Promise<boolean> {
    log('startListening');
    this.tapAt = Date.now();
    this.wantWarm = true;
    this.wantListening = true;
    this.greeted = false;
    this.reconnects = 0;
    this.minGen = 0;
    this.suppressErrors = suppressErrors;
    this.history = [];
    this.setState('connecting');
    try {
      this.requestingPermission = true;
      let perm;
      try {
        perm = await requestMicrophonePermissionsAsync();
      } finally {
        this.requestingPermission = false;
      }
      if (!perm.granted) throw new Error('Microphone permission is needed for the voice assistant.');

      // Let both finish before deciding: if the connection fails first, the audio engine would otherwise finish
      // starting after the clean-up ran and be left running with nobody listening to it.
      const [audio, relay] = await Promise.allSettled([this.initAudioEngine(), this.connect(true)]);
      if (audio.status === 'rejected' || relay.status === 'rejected') {
        this.releaseAudio();
        throw (audio.status === 'rejected' ? audio.reason : (relay as PromiseRejectedResult).reason);
      }
      if (!this.wantListening) {
        this.releaseAudio();
        return false;
      }
      const recording = toggleRecording(true);
      log('audio ready, recording =', recording);
      if (!recording) throw new Error('Could not start the microphone.');
      this.touch();
      this.setState('listening');
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not start the voice assistant.';
      log('startListening failed:', message);
      this.teardownSession();
      // When a fallback engine will take over, stay quiet: showing "ready" would make the panel close.
      if (!this.suppressErrors) {
        this.opts.onError?.(message);
        this.setState('error');
      }
      return false;
    } finally {
      this.suppressErrors = false;
    }
  }

  stopListening() {
    this.wantListening = false;
    this.teardownSession();
    this.emitLevels({ input: 0, output: 0 });
    this.setState(this.wantWarm ? 'ready' : 'idle');
  }

  shutdown() {
    this.wantWarm = false;
    this.wantListening = false;
    if (this.standbyTimer) clearTimeout(this.standbyTimer);
    this.standbyTimer = null;
    if (this.standby) this.discardStandby(this.standby);
    this.teardownSession();
    this.setState('idle');
  }

  /** The persona is read at the start of every session, so there is nothing to restart. */
  refresh() {}

  setIdleTimeout(ms: number) {
    this.idleMs = ms;
    this.touch();
  }

  /** Typed text and app notices wait here until the relay is up, instead of being dropped. */
  private pendingFrames: Record<string, unknown>[] = [];

  private sendOrQueue(frame: Record<string, unknown>) {
    if (this.relayReady && this.ws?.readyState === WebSocket.OPEN) this.send(frame);
    else if (this.wantListening) this.pendingFrames.push(frame);
  }

  sendText(text: string) {
    this.sendOrQueue({ type: 'text', text });
  }

  /** Keeps the conversation open through silence (used while the assistant is on a phone call for the user). */
  setHoldOpen(hold: boolean) {
    this.holdOpen = hold;
    this.touch();
  }

  /**
   * Switches the voice to another language. Sarvam synthesises per language, so the relay has to
   * rebuild its speech connection — hence a code (for example "ta-IN") rather than a name.
   */
  setLanguage(code: string) {
    this.send({ type: 'set_language', language: code });
  }

  /** Tells the assistant about an app event; it speaks up about it when it is next quiet. */
  notify(text: string) {
    this.sendOrQueue({ type: 'notify', text });
  }

  // ─── Connection ────────────────────────────────────────────────────────────

  private async initAudioEngine() {
    if (this.audioReady) return;
    // After a JavaScript reload the native engine can still be running but wired to the old, dead
    // JavaScript: you'd hear replies but the microphone would never reach us. Always start it fresh.
    try {
      tearDownAudio();
    } catch {
      /* nothing was running */
    }
    const ok = await initAudio();
    if (ok === false) {
      throw new Error('Could not start the audio engine. Close other audio apps or end any call and try again.');
    }
    this.audioReady = true;
    this.subs.push(
      addExpoTwoWayAudioEventListener('onMicrophoneData', (e) => this.sendMic(e.data)),
      addExpoTwoWayAudioEventListener('onInputVolumeLevelData', (e) => this.emitLevels({ input: e.data })),
      addExpoTwoWayAudioEventListener('onOutputVolumeLevelData', (e) => this.emitLevels({ output: e.data })),
    );
  }

  /** Opens the relay socket, logs in, sends the session setup and waits for "ready". */
  private async connect(first: boolean): Promise<void> {
    const token = await this.opts.getAccessToken();
    if (!token) throw new Error('Please log in to use the voice assistant.');
    const url = this.relayWsUrl();
    // A connection that was opened and logged in ahead of the tap saves the function boot, the handshake and the login check.
    const adopted = this.takeStandby();

    await new Promise<void>((resolve, reject) => {
      const ws = adopted?.ws ?? new WebSocket(url);
      this.ws = ws;
      this.relayReady = false;
      let settled = false;
      const done = (err?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err) {
          // A socket that did not make it must not be left half open (it would be reused or leak).
          ws.onclose = null;
          ws.onmessage = null;
          if (this.ws === ws) {
            this.ws = null;
            this.relayReady = false;
          }
          try {
            ws.close();
          } catch {
            /* already closed */
          }
          reject(err);
        } else resolve();
      };
      // With the other engine ready to take over, don't make the user wait long for this one.
      const timer = setTimeout(() => done(new Error('The voice service took too long to answer.')), this.suppressErrors ? FAST_CONNECT_TIMEOUT_MS : CONNECT_TIMEOUT_MS);

      // Logs in (unless the standby already did) and sends the session setup.
      const begin = () => {
        if (!adopted?.authSent) ws.send(JSON.stringify({ type: 'auth', token }));
        ws.send(
          JSON.stringify({
            type: 'start',
            system: this.opts.getSystemInstruction(),
            tools: this.opts.functionDeclarations ?? [],
            voice: this.opts.getSpeaker(),
            language: this.opts.getLanguage(),
            greeting: first && !this.greeted ? this.opts.getGreetingLine() : undefined,
            history: this.history,
          }),
        );
        this.greeted = true;
      };
      ws.onopen = () => {
        log('socket open');
        begin();
      };
      ws.onmessage = (ev) => {
        const raw = typeof ev.data === 'string' ? ev.data : '';
        if (!raw) return;
        let m: Record<string, any>;
        try {
          m = JSON.parse(raw);
        } catch {
          return;
        }
        if (m.type === 'ready') {
          this.relayReady = true;
          // A new relay session numbers its replies from 0 again, so forget the old interruption marks.
          this.minGen = 0;
          // Replay what was said while we were reconnecting.
          for (const frame of this.micBuffer) ws.send(JSON.stringify({ type: 'audio', data: frame }));
          this.micBuffer = [];
          const queued = this.pendingFrames;
          this.pendingFrames = [];
          for (const frame of queued) ws.send(JSON.stringify(frame));
          done();
        }
        if (m.type === 'error' && !this.relayReady) done(new Error(String(m.message ?? 'The voice service refused the connection.')));
        this.handleMessage(m);
      };
      ws.onerror = () => done(new Error('Could not reach the voice service.'));
      ws.onclose = (ev) => {
        log('socket closed', (ev as { code?: number }).code);
        const wasReady = this.relayReady;
        if (this.ws === ws) {
          this.ws = null;
          this.relayReady = false;
        }
        done(new Error('The voice service closed the connection.'));
        if (wasReady && this.wantListening) void this.reconnect();
      };
      if (adopted && ws.readyState === WebSocket.OPEN) {
        log('using the standby connection');
        begin();
      }
    });
  }

  /** Supabase caps a function at about 6 minutes: reconnect and carry the conversation on. */
  private async reconnect() {
    if (this.reconnects >= MAX_RECONNECTS) {
      this.opts.onError?.('Voice connection lost. Please tap the orb to try again.');
      this.wantListening = false;
      this.teardownSession();
      this.setState('error');
      return;
    }
    this.reconnects += 1;
    log('reconnecting, attempt', this.reconnects);
    this.setState('connecting');
    this.flushHistory();
    try {
      await this.connect(false);
      this.reconnects = 0;
      if (this.wantListening) this.setState('listening');
    } catch {
      if (this.wantListening) setTimeout(() => void this.reconnect(), 600 * this.reconnects);
    }
  }

  // ─── Incoming messages ─────────────────────────────────────────────────────

  private handleMessage(m: Record<string, any>) {
    switch (m.type) {
      case 'audio':
        // A chunk from before the latest interruption: discard it.
        if (typeof m.g === 'number' && m.g < this.minGen) break;
        if (typeof m.data === 'string' && this.audioReady && this.wantListening) {
          this.lastAudioAt = Date.now();
          const pcm = base64ToBytes(m.data);
          playPCMData(CAN_FLUSH ? pcm : downsample24kTo16k(pcm));
          this.setState('speaking');
          this.speakingTail();
        }
        break;

      case 'transcript': {
        const text = String(m.text ?? '');
        if (!text) break;
        this.touch();
        if (m.role === 'user') {
          // Only finished utterances: partial recognitions replace each other, so they are skipped.
          if (m.final) {
            log('you said:', text);
            this.pendingUser += text;
            this.opts.onTranscript?.('user', text, false);
            void this.tryQuickOpen(text);
          }
        } else {
          this.pendingAssistant += text;
          this.opts.onTranscript?.('assistant', text, false);
        }
        break;
      }

      case 'tool_call':
        void this.runTool({ id: String(m.id), name: String(m.name), args: (m.args ?? {}) as Record<string, unknown> });
        break;

      case 'interrupted':
        log('INTERRUPTED');
        if (typeof m.g === 'number') this.minGen = Math.max(this.minGen, m.g);
        this.clearPlayback();
        this.opts.onTranscript?.('assistant', '', true); // the old answer is over: the next words start fresh
        this.flushHistory();
        this.setState('listening');
        break;

      case 'vad':
        // The user started talking. If the assistant is still playing, stop the speaker right now,
        // without waiting for the server (audio already sent keeps playing for several seconds).
        if (m.event === 'start' && this.wantListening && (this.state === 'speaking' || this.levels.output > 0.02 || Date.now() - this.lastAudioAt < 2000)) {
          log('user spoke over the assistant: stopping playback');
          this.clearPlayback();
          this.setState('listening');
          this.send({ type: 'interrupt' });
        }
        break;

      case 'turn_complete':
        this.opts.onTranscript?.('assistant', '', true);
        this.flushHistory();
        this.speakingTail();
        break;

      case 'goaway':
        // The relay is about to hit its time limit: swap to a fresh session right away.
        log('goaway: refreshing the session');
        this.ws?.close();
        break;

      case 'metrics':
        log('metrics', JSON.stringify(m));
        break;

      case 'error':
        if (this.relayReady) {
          log('relay error:', m.message);
          if (!this.suppressErrors) this.opts.onError?.(String(m.message ?? 'The voice service had a problem.'));
        }
        break;
    }
  }

  /**
   * "Open WhatsApp" needs no thinking, so it does not wait for the language model: the moment the speech
   * recogniser hands over the finished sentence, the app is launched. That round trip (relay, model, tool call
   * back to the phone) took several seconds, which is why opening an app felt slow. Anything that is not a plain
   * open-app command is left to the model as before.
   */
  private async tryQuickOpen(text: string) {
    if (!this.opts.onToolCall || !this.wantListening) return;
    const command = parseOpenAppCommand(text, getAppIndex());
    if (!command) return;
    const now = Date.now();
    if (command.app.label === this.lastQuickOpen.app && now - this.lastQuickOpen.at < 4000) return; // a repeated final
    this.lastQuickOpen = { app: command.app.label, at: now };
    log('quick open:', command.app.label, '<-', text);
    try {
      await this.opts.onToolCall({ id: `quick_${now}`, name: 'open_app', args: { app_name: command.app.label } });
    } catch (e) {
      log('quick open failed:', e instanceof Error ? e.message : e);
    }
  }

  private async runTool(call: LiveToolCall) {
    log('tool call', call.name, JSON.stringify(call.args));
    let result: Record<string, unknown>;
    try {
      const timeout = new Promise<Record<string, unknown>>((resolve) =>
        setTimeout(() => resolve({ ok: false, error: 'That took too long and was stopped.' }), TOOL_TIMEOUT_MS),
      );
      result = this.opts.onToolCall ? await Promise.race([this.opts.onToolCall(call), timeout]) : { error: 'No tools are available.' };
    } catch (e) {
      result = { error: e instanceof Error ? e.message : 'Tool failed.' };
    }
    log('tool result', call.name, JSON.stringify(result).slice(0, 200));
    this.send({ type: 'tool_result', id: call.id, result });
  }

  // ─── Audio ─────────────────────────────────────────────────────────────────

  private sendMic(pcm: Uint8Array) {
    if (!this.relayReady || this.ws?.readyState !== WebSocket.OPEN) {
      // Reconnecting: keep the last few seconds so the start of a sentence isn't lost.
      if (this.wantListening && this.audioReady) {
        this.micBuffer.push(bytesToBase64(pcm));
        if (this.micBuffer.length > 120) this.micBuffer.shift();
      }
      return;
    }
    if (pcm.length >= 2) {
      const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.length - (pcm.length % 2));
      let peak = 0;
      for (let i = 0; i < view.byteLength; i += 8) {
        const v = Math.abs(view.getInt16(i, true));
        if (v > peak) peak = v;
      }
      if (peak > this.micPeak) this.micPeak = peak;
      // The user talking counts as activity, so the idle timer doesn't cut in mid-conversation.
      if (peak > SPEECH_PEAK && Date.now() - this.lastSpeechTouch > 1500) {
        this.lastSpeechTouch = Date.now();
        this.touch();
      }
    }
    this.send({ type: 'audio', data: bytesToBase64(pcm) });
    this.micSent += 1;
    const now = Date.now();
    if (now - this.micLogAt > 3000) {
      log('mic: sent', this.micSent, 'chunks, loudest', this.micPeak);
      this.micSent = 0;
      this.micPeak = 0;
      this.micLogAt = now;
    }
  }

  private clearPlayback() {
    if (CAN_FLUSH && this.audioReady) {
      try {
        nativeAudio!.flushPlayback!();
      } catch {
        /* ignore */
      }
    }
  }

  /** The player has no "finished" callback: once the reply is complete, wait for the level to drop. */
  private speakingTail() {
    if (this.tailTimer) clearTimeout(this.tailTimer);
    this.tailTimer = setTimeout(() => {
      this.tailTimer = null;
      if (this.state !== 'speaking') return;
      if (this.levels.output < 0.02) this.setState(this.wantListening ? 'listening' : 'ready');
      else this.speakingTail();
    }, 450);
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  private send(payload: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(payload));
  }

  private flushHistory() {
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
    if (this.tapAt && (state === 'listening' || state === 'speaking')) {
      log('tap -> listening in', Date.now() - this.tapAt, 'ms');
      this.tapAt = 0;
    }
    this.state = state;
    this.opts.onState?.(state);
  }

  /** Ends the relay session and releases the microphone and speaker. */
  private teardownSession() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    if (this.tailTimer) clearTimeout(this.tailTimer);
    this.tailTimer = null;
    const ws = this.ws;
    this.ws = null;
    this.relayReady = false;
    this.micBuffer = [];
    this.pendingFrames = [];
    if (ws) {
      try {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'end' }));
        ws.close();
      } catch {
        /* already closed */
      }
      // The conversation's connection is spent: have the next one ready for the next tap.
      if (this.wantWarm && !this.wantListening) this.scheduleStandby(400);
    }
    this.releaseAudio();
  }

  private releaseAudio() {
    this.subs.forEach((s) => s.remove());
    this.subs = [];
    if (!this.audioReady) return;
    this.clearPlayback();
    try {
      toggleRecording(false);
    } catch {
      /* engine already down */
    }
    try {
      tearDownAudio();
    } catch {
      /* ignore */
    }
    this.audioReady = false;
  }
}
