/**
 * AssistantEngine — one voice engine for the app, backed by Gemini Live or Sarvam.
 *
 * The admin chooses the engine in the admin panel. The server tells us which one is active
 * (and which to fall back to), and this class forwards everything to that engine. If the active
 * engine can't start, it quietly switches to the fallback.
 *
 * It has the same surface as GeminiLiveClient, so the rest of the app doesn't care which is in use.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/constants/supabase';
import {
  GeminiLiveClient,
  type GeminiLiveOptions,
  type LiveState,
} from '@/services/geminiLive/client';
import { SarvamLiveClient, type SarvamLiveOptions } from '@/services/sarvamLive/client';
import { warmWebSearch } from '@/services/assistant/webSearch';

export type EngineKind = 'gemini' | 'sarvam';

const log: (...args: unknown[]) => void = __DEV__ ? (...args) => console.log('[engine]', ...args) : () => {};

/** How long the server's choice is trusted before it is asked again. */
const RESOLVE_TTL_MS = 60_000;
/** The last choice the server made, kept on the phone so a tap never has to wait to find out which engine to use. */
const ENGINE_KEY = '@wishme/voice-engine';
/** The probe that asks which engine is active gives up after this long. */
const PROBE_TIMEOUT_MS = 3000;
/** On the very first run (nothing remembered) a tap waits at most this long for the answer. */
const FIRST_RUN_WAIT_MS = 2500;
/** If the engine in use is not actually listening this long after a tap, the other one takes over. */
const FIRST_CONNECT_DEADLINE_MS = 7000;

type Shared = Pick<
  GeminiLiveOptions,
  'getAccessToken' | 'onAuthRejected' | 'getSystemInstruction' | 'functionDeclarations' | 'onToolCall' | 'onState' | 'onTranscript' | 'onLevels' | 'onError'
>;

export interface EngineOptions extends Shared {
  /** Gemini voice id, e.g. "Kore". */
  getVoiceName: () => string;
  getGreetingPrompt: () => string;
  /** Sarvam speaker, e.g. "ritu". */
  getSarvamSpeaker: () => string;
  getLanguage: () => string;
  getGreetingLine: () => string;
}

export class AssistantEngine {
  private gemini: GeminiLiveClient;
  private sarvam: SarvamLiveClient;
  private active: EngineKind = 'gemini';
  private fallback: EngineKind | null = null;
  private resolvedAt = 0;
  /** When Sarvam last failed to start, so we don't make the user wait for it again straight away. */
  private sarvamFailedAt = 0;
  private wantWarm = false;
  private wantListening = false;
  private haveChoice = false;
  private deadline: ReturnType<typeof setTimeout> | null = null;
  /** Resolves once the remembered engine choice (if any) has been read. */
  private remembered: Promise<void>;

  constructor(private opts: EngineOptions) {
    this.remembered = AsyncStorage.getItem(ENGINE_KEY)
      .then((raw) => {
        if (!raw) return;
        const c = JSON.parse(raw) as { engine?: EngineKind; fallback?: EngineKind | null };
        if (c.engine === 'gemini' || c.engine === 'sarvam') {
          this.active = c.engine;
          this.fallback = c.fallback ?? null;
          this.haveChoice = true;
        }
      })
      .catch(() => {});
    // Only the active engine may report state, so the idle one never confuses the UI.
    const forwardState = (src: EngineKind) => (state: LiveState) => {
      if (src !== this.active) return;
      if (state === 'listening' || state === 'speaking') this.clearDeadline();
      this.opts.onState?.(state);
      // Gemini couldn't connect while the user is waiting: hand over to Sarvam if the admin allows it.
      if (src === 'gemini' && state === 'error' && this.wantListening && this.fallback === 'sarvam') {
        log('Gemini failed, falling back to Sarvam');
        void this.switchTo('sarvam', true);
      }
    };
    const forward = <T extends unknown[]>(src: EngineKind, fn?: (...args: T) => void) => (...args: T) => {
      if (src === this.active) fn?.(...args);
    };

    this.gemini = new GeminiLiveClient({
      getAccessToken: opts.getAccessToken,
      onAuthRejected: opts.onAuthRejected,
      getSystemInstruction: opts.getSystemInstruction,
      getVoiceName: opts.getVoiceName,
      getGreetingPrompt: opts.getGreetingPrompt,
      functionDeclarations: opts.functionDeclarations,
      onToolCall: opts.onToolCall,
      onState: forwardState('gemini'),
      onTranscript: forward('gemini', opts.onTranscript),
      onLevels: forward('gemini', opts.onLevels),
      onError: forward('gemini', opts.onError),
      onServerConfig: (cfg) => void this.applyServerConfig({ engine: cfg.engine, fallback: cfg.fallback, relayUrl: cfg.relayUrl }),
    });

    const sarvamOpts: SarvamLiveOptions = {
      getAccessToken: opts.getAccessToken,
      getSystemInstruction: opts.getSystemInstruction,
      getSpeaker: opts.getSarvamSpeaker,
      getLanguage: opts.getLanguage,
      getGreetingLine: opts.getGreetingLine,
      functionDeclarations: opts.functionDeclarations,
      onToolCall: opts.onToolCall,
      onState: forwardState('sarvam'),
      onTranscript: forward('sarvam', opts.onTranscript),
      onLevels: forward('sarvam', opts.onLevels),
      onError: forward('sarvam', opts.onError),
    };
    this.sarvam = new SarvamLiveClient(sarvamOpts);
  }

  private get current() {
    return this.active === 'sarvam' ? this.sarvam : this.gemini;
  }

  getState(): LiveState {
    return this.current.getState();
  }

  isRequestingPermission(): boolean {
    return this.gemini.isRequestingPermission() || this.sarvam.isRequestingPermission();
  }

  getActiveEngine(): EngineKind {
    return this.active;
  }

  // ─── Choosing the engine ───────────────────────────────────────────────────

  /** Asks the server which engine the admin has selected (no token is minted for this). */
  private async resolve(force = false) {
    if (!force && Date.now() - this.resolvedAt < RESOLVE_TTL_MS) return;
    try {
      const accessToken = await this.opts.getAccessToken();
      if (!accessToken) return;
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), PROBE_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(`${SUPABASE_URL}/functions/v1/voice-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ probe: true, supports: ['gemini', 'sarvam'] }),
          signal: abort.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as { engine?: EngineKind; fallback_engine?: EngineKind | null; relay_url?: string };
      await this.applyServerConfig({ engine: j.engine, fallback: j.fallback_engine ?? null, relayUrl: j.relay_url });
    } catch {
      // Can't ask: keep whatever we were using (Gemini by default), and try again soon.
      log('could not resolve the engine');
    }
  }

  /** Takes in what the server says about the active engine (from the probe, or riding back with a Gemini token). */
  private async applyServerConfig(cfg: { engine?: string; fallback: EngineKind | null; relayUrl?: string }) {
    try {
      this.resolvedAt = Date.now();
      this.fallback = cfg.fallback;
      if (cfg.relayUrl) this.sarvam.setRelayUrl(cfg.relayUrl);
      const next: EngineKind = cfg.engine === 'sarvam' ? 'sarvam' : 'gemini';
      this.haveChoice = true;
      void AsyncStorage.setItem(ENGINE_KEY, JSON.stringify({ engine: next, fallback: this.fallback })).catch(() => {});
      if (next !== this.active) {
        // Never swap engines under a conversation in progress (e.g. after a fallback).
        if (this.wantListening) log('engine change deferred until the conversation ends');
        else await this.switchTo(next, false);
      }
      log('active engine:', this.active, '| fallback:', this.fallback);
    } catch (e) {
      // Can't ask: keep whatever we were using (Gemini by default), and try again soon.
      log('could not resolve the engine:', e instanceof Error ? e.message : e);
    }
  }

  /** Switches engine, stopping the old one so only one holds the microphone and speaker. */
  private async switchTo(engine: EngineKind, startNow: boolean) {
    if (engine === this.active) return;
    const previous = this.current;
    // Switch first so the engine being stopped can't report its shutdown to the UI.
    this.active = engine;
    previous.shutdown();
    log('switched to', engine);
    if (this.wantWarm) this.current.warm();
    if (startNow && this.wantListening) {
      if (engine === 'sarvam') await this.sarvam.startListening();
      else await this.gemini.startListening();
    }
  }

  // ─── Same surface as GeminiLiveClient ──────────────────────────────────────

  warm() {
    this.wantWarm = true;
    // Warm the engine the server chose last time (a quick read from the phone), not a guess: warming the wrong one
    // would mint a token and open a socket just to throw them away.
    void this.remembered.then(() => {
      if (!this.wantWarm) return;
      this.current.warm();
      // Gemini's own token request carries the server's choice back with it, so a second request to the same cold function
      // (it raced the token request and was the source of the "slow to respond" aborts) is only needed when Sarvam is
      // remembered, or on the very first run when nothing is remembered.
      if (this.active === 'gemini' && this.haveChoice) return;
      void this.resolve(true).then(() => {
        if (this.wantWarm) this.current.warm();
      });
    });
  }

  private clearDeadline() {
    if (this.deadline) clearTimeout(this.deadline);
    this.deadline = null;
  }

  /** If the engine in use is not really listening soon after a tap, hand over to the other one instead of leaving the user waiting. */
  private armDeadline() {
    this.clearDeadline();
    this.deadline = setTimeout(() => {
      this.deadline = null;
      if (!this.wantListening) return;
      const s = this.getState();
      if (s === 'listening' || s === 'speaking') return;
      // Still working on the connection (fetching the token, opening the socket, retrying): wait for it. The engine is only
      // handed over when it has really given up (its state is no longer "connecting"), never part-way through a connect.
      if (s === 'connecting' && this.active === 'gemini') {
        log('still connecting, waiting for', this.active, 'instead of switching');
        this.armDeadline();
        return;
      }
      const other: EngineKind = this.active === 'gemini' ? 'sarvam' : 'gemini';
      if (this.fallback !== other) return;
      log('not listening after the deadline, switching to', other);
      void this.switchTo(other, true);
    }, FIRST_CONNECT_DEADLINE_MS);
  }

  async startListening() {
    // The conversation starts now. Only wait for the server's answer on the very first run; after that the choice it made
    // last time is used straight away and refreshed in the background.
    this.wantListening = true;
    const tEng = Date.now();
    log('engine.startListening | active', this.active, '| haveChoice', this.haveChoice, '| geminiState', this.gemini.getState());
    // Boot the web-search function now, so the first question that needs it does not wait for a cold start.
    warmWebSearch(this.opts.getAccessToken);
    await this.remembered;
    log('engine: remembered choice read after', Date.now() - tEng, 'ms');
    if (!this.haveChoice) await Promise.race([this.resolve(), new Promise<void>((r) => setTimeout(r, FIRST_RUN_WAIT_MS))]);
    else void this.resolve();
    log('engine: handing over to', this.active, 'after', Date.now() - tEng, 'ms');
    if (!this.wantListening) return;
    this.armDeadline();
    if (this.active === 'sarvam') {
      // Sarvam just failed and Gemini is allowed as a fallback: go straight to Gemini for a while.
      if (this.fallback === 'gemini' && Date.now() - this.sarvamFailedAt < 90_000) {
        log('skipping Sarvam (failed recently), using Gemini');
        await this.switchTo('gemini', false);
        this.gemini.warm();
        await this.gemini.startListening();
        return;
      }
      const ok = await this.sarvam.startListening(this.fallback === 'gemini');
      if (!ok && this.fallback === 'gemini' && this.wantListening) {
        this.sarvamFailedAt = Date.now();
        log('Sarvam could not start, falling back to Gemini');
        await this.switchTo('gemini', false);
        this.gemini.warm();
        await this.gemini.startListening();
      }
      return;
    }
    await this.gemini.startListening();
  }

  /** Sends typed text into the live conversation (used by the "try asking" chips). */
  sendText(text: string) {
    this.current.sendText(text);
  }

  /** The app went to the background: let the speaker and mic go (the connection is kept). */
  releaseAudio() {
    this.gemini.releaseAudioEngine();
  }

  stopListening() {
    this.wantListening = false;
    this.clearDeadline();
    this.current.stopListening();
  }

  shutdown() {
    this.wantWarm = false;
    this.wantListening = false;
    this.clearDeadline();
    this.resolvedAt = 0;
    this.gemini.shutdown();
    this.sarvam.shutdown();
  }

  refresh() {
    this.resolvedAt = 0;
    this.current.refresh();
  }

  /** True while a conversation is open (so a spoken report makes sense). */
  isConversing(): boolean {
    const s = this.getState();
    return s === 'listening' || s === 'speaking';
  }

  /** Tells the active assistant about an app event so it can speak up about it. */
  notify(text: string) {
    this.current.notify(text);
  }

  setIdleTimeout(ms: number) {
    this.gemini.setIdleTimeout(ms);
    this.sarvam.setIdleTimeout(ms);
  }

  /** Keeps the conversation open through silence, e.g. while an AI call is going on. */
  setHoldOpen(hold: boolean) {
    this.gemini.setHoldOpen(hold);
    this.sarvam.setHoldOpen(hold);
  }

  /** Which engine is talking right now. Only Gemini hears the user's voice. */
  get activeEngine(): EngineKind {
    return this.active;
  }

  /**
   * Switches the spoken language mid-conversation.
   *
   * Gemini speaks a wide range of languages with no help from us. Sarvam has a fixed set of Indian
   * voices, so it has to be handed a voice code — and if there is none, the caller is told so the
   * assistant can say it cannot rather than answering in the wrong language.
   */
  async setLanguage(language: { key: string; label: string; sarvamCode: string | null }): Promise<{ ok: boolean; error?: string }> {
    if (this.active === 'sarvam') {
      if (!language.sarvamCode) {
        return { ok: false, error: `The current voice cannot speak ${language.label}.` };
      }
      this.sarvam.setLanguage(language.sarvamCode);
      return { ok: true };
    }
    this.gemini.setLanguage(language.label);
    return { ok: true };
  }
}
