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

import { bootStamp } from '@/services/bootLog';
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
const LISTEN_IDLE_TIMEOUT_MS = 90_000;

// Diagnostics go to the Metro log in dev builds only; release builds pay nothing for them.
/** When the user last tapped the mic (0 = not since the last answer): every log line shows the time since it. */
let tapMark = 0;
const stamp = () => `${bootStamp()}${tapMark ? ` tap+${Date.now() - tapMark}ms` : ''}`;
const log: (...args: unknown[]) => void = __DEV__
  ? (...args) => console.log(`[live ${stamp()}]`, ...args)
  : () => {};

const DEFAULT_GREETING_PROMPT =
  '[The user just opened the assistant] Say exactly "Hello." and nothing more, then wait for the user to speak.';

/** How long to wait for the token, for the socket to finish its setup, and for the first reply to the greeting. */
const TOKEN_TIMEOUT_MS = 6000;
/** A second token request goes out in parallel when the first has not answered after this long. */
const TOKEN_HEDGE_MS = 1200;
const SETUP_TIMEOUT_MS = 8000;
const GREETING_REPLY_TIMEOUT_MS = 6000;
/** The audio engine stays up this long after the last conversation, then is let go (it holds audio focus). */
const AUDIO_KEEP_MS = 120_000;

/**
 * Gemini's live audio ends its turn after roughly 25 to 50 seconds of speech and waits, even when the answer is not finished
 * (a long story, a long explanation). When a long turn ends like that, the app quietly asks it to carry on. Every limit below
 * exists so this can never loop: a few continues per request, a time cap, a progress check, and it stops the moment the user
 * speaks, a tool runs, or the conversation closes.
 */
const AUTO_CONTINUE = true;
/** Only a turn that played at least this long can have hit the model's own length limit. */
const AUTO_CONTINUE_MIN_AUDIO_MS = 20_000;
const AUTO_CONTINUE_MAX = 5;
/** A continuation shorter than this means the answer was already complete. */
const AUTO_CONTINUE_MIN_PROGRESS_MS = 5_000;
const AUTO_CONTINUE_MIN_PROGRESS_CHARS = 80;
const AUTO_CONTINUE_CAP_MS = 5 * 60_000;
const AUTO_CONTINUE_MAX_CAP_MS = 15 * 60_000;
/** If nothing at all comes back after the request to continue, forget that it was sent. */
const AUTO_CONTINUE_SILENCE_MS = 15_000;
const CONTINUE_PROMPT =
  '[Instruction from the app, not spoken by the user] If your answer to the last request from the user is not finished, carry on from exactly where you stopped: no introduction, no repeating, no asking whether to continue. If it is already finished, say nothing.';

/**
 * Like a person: when the user goes quiet after the assistant has finished speaking, it speaks up now and then in different
 * words (a check-in, an offer, a suggestion), a few times, then says one soft closing line and ends the conversation. A goodbye
 * from the user gets one short farewell and the conversation then closes. Nothing is said while the panel is minimised, a tool
 * or a call is running, or the user is talking.
 */
const NUDGES = true;
const NUDGE_AFTER_MS = 15_000;
const NUDGE_MAX = 3;
const NUDGE_ANGLES = [
  "Gently check in: say you are here and they can ask you anything.",
  "Ask in a few words how you can help them right now.",
  "Offer something specific and useful, for example today's latest news, the weather, or something you remember about the user, and ask if they would like it.",
  "Mention one thing you can do for them that they may not know about, in a single short line.",
];
const nudgePrompt = (angle: string) =>
  "[Instruction from the app, not spoken by the user] The user has been quiet for a while. Say ONE short, natural, friendly line to invite them to speak, in the language they have been speaking. " + angle + " Do not repeat anything you have already said in this conversation and do not mention this instruction. Then wait.";
const FINAL_NUDGE_PROMPT =
  "[Instruction from the app, not spoken by the user] The user is still quiet. Say ONE short, warm line, in the language they have been speaking, saying you will be around whenever they need you. No question and no offer. Then stop.";
/** Short farewells only: a long sentence that merely contains "bye" is not one. */
const GOODBYE = /\b(bye|goodbye|good bye|good night|see you|see ya|talk to you later|that is all|that's all|thats all|nothing else|nothing more|no thanks|no thank you|all done)\b|^\W*(?:(?:no|nope)\W+)?nothing(?:\W+(?:else|more))?\W*$|अलविदा|बाय|बस इतना|कुछ नहीं चाहिए|शुक्रिया बस/i;
const isGoodbye = (text: string) => {
  const t = text.trim();
  return t.length > 0 && t.length <= 60 && GOODBYE.test(t);
};

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20 };
/** How long the user asked it to go on for ("for ten minutes"), plus a minute of margin; the normal cap when they named none. */
function continueCapFor(request: string): number {
  const m = /(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty)\s*(?:minutes?|mins?)/i.exec(request);
  if (!m) return AUTO_CONTINUE_CAP_MS;
  const n = Number(m[1]) || NUMBER_WORDS[m[1].toLowerCase()] || 0;
  return Math.min(AUTO_CONTINUE_MAX_CAP_MS, Math.max(AUTO_CONTINUE_CAP_MS, (n + 1) * 60_000));
}
/** Reply audio that arrives while the speaker is still starting is kept (up to ~2 s at 24 kHz) and played once it is up. */
const EARLY_AUDIO_MAX_BYTES = 96_000;

export type LiveState = 'idle' | 'connecting' | 'ready' | 'listening' | 'speaking' | 'error';

export interface LiveToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

class AuthRejectedError extends Error {
  constructor() {
    super('Your login has ended. Please sign in again.');
  }
}

export interface GeminiLiveOptions {
  /** Supabase user access token, refreshed if stale (the anon key is rejected by voice-token). */
  getAccessToken: () => Promise<string | null | undefined> | string | null | undefined;
  /** The server refused the login (401): the app checks it and signs the user out if it really has ended. */
  onAuthRejected?: () => void;
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
  /** The server's answer to "which engine is active" rides back with every token, so the app needs no separate question. */
  onServerConfig?: (config: { engine?: string; fallback: 'gemini' | 'sarvam' | null; relayUrl?: string }) => void;
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
  // Why a reply stopped (development logs): how much audio the current reply has received and what the mic heard meanwhile.
  private replyStartAt = 0;
  private replyBytes = 0;
  private replyChunks = 0;
  private lastChunkAt = 0;
  private replyMicPeak = 0;
  private replyLoudChunks = 0;
  // Automatic continue (see AUTO_CONTINUE)
  private autoContinues = 0;
  private requestStartAt = 0;
  private requestCapMs = AUTO_CONTINUE_CAP_MS;
  private continuePending = false;
  private continueWatchdog: ReturnType<typeof setTimeout> | null = null;
  private prevTurnText = '';
  private lastUserSpeechAt = 0;
  private toolsRunning = 0;
  // Silence nudges and goodbyes (see NUDGES)
  private nudgeCount = 0;
  private nudgeTimer: ReturnType<typeof setTimeout> | null = null;
  private nudgesEnabled = true;
  private closeAfterReply = false;
  private nudgeBase = Math.floor(Math.random() * NUDGE_ANGLES.length);
  private requestingPermission = false;
  private audioReady = false;
  /** True once the microphone permission is known to be granted (so a tap never has to ask again). */
  private micGranted = false;
  /** The audio engine's start in progress, shared by the early start and the tap. */
  private audioPrep: Promise<boolean> | null = null;
  /** Bumped whenever the engine is released, so a start that finishes after that knows it is stale. */
  private audioEpoch = 0;
  private audioReleaseTimer: ReturnType<typeof setTimeout> | null = null;
  private subs: { remove: () => void }[] = [];
  private resumeHandle: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private setupWatchdog: ReturnType<typeof setTimeout> | null = null;
  private greetTimer: ReturnType<typeof setTimeout> | null = null;
  private greetAt = 0;
  private lastContentAt = 0;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  /** When the user tapped, to log how long the assistant took to start listening. */
  private tapAt = 0;
  private setupSentAtGlobal = 0;
  private earlyAudio: Uint8Array[] = [];
  private earlyAudioBytes = 0;
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
    // The speaker and mic engine start together with the connection (when the permission is already granted), so the tap
    // finds both ready. It may pause the user's music; that is accepted.
    log('warm() called | wantWarm', this.wantWarm, '| ws', this.ws ? this.ws.readyState : 'none', '| socketReady', this.socketReady, '| state', this.state);
    const already = this.wantWarm;
    this.wantWarm = true;
    void this.prewarmAudio();
    if (already) return;
    this.reconnectAttempts = 0;
    void this.openSocket();
  }

  /** True while the system microphone permission dialog is up (the app briefly looks backgrounded). */
  isRequestingPermission() {
    return this.requestingPermission;
  }

  /** Switches the microphone on (opening the socket first if it isn't ready yet). */
  async startListening() {
    tapMark = Date.now();
    this.nudgeCount = 0;
    this.closeAfterReply = false;
    this.nudgeBase = Math.floor(Math.random() * NUDGE_ANGLES.length);
    log(
      '=== TAP === socketReady', this.socketReady, '| ws', this.ws ? this.ws.readyState : 'none (0 connecting, 1 open)', '| setupDone', this.setupDone,
      '| wantWarm', this.wantWarm, '| state', this.state, '| reconnectTimer', !!this.reconnectTimer, '| reconnectAttempts', this.reconnectAttempts,
      '| audioReady', this.audioReady, '| resumeHandle', !!this.resumeHandle,
    );
    this.tapAt = Date.now();
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
      if (this.audioReleaseTimer) clearTimeout(this.audioReleaseTimer);
      this.audioReleaseTimer = null;
      if (!this.micGranted) {
        this.requestingPermission = true;
        let perm;
        log('mic permission: asking');
        try {
          perm = await requestMicrophonePermissionsAsync();
        } finally {
          this.requestingPermission = false;
        }
        log('mic permission: answered, granted =', perm.granted);
        if (!perm.granted) throw new Error('Microphone permission is needed for the voice assistant.');
        this.micGranted = true;
      } else {
        log('mic permission: already granted, not asking');
      }

      // The spoken hello takes a moment to come back, and the audio engine takes a moment to start: do both at once.
      // Whatever the model says before the speaker is up is kept and played as soon as it is (see enqueueAudio).
      if (this.socketReady) this.maybeGreet(true);

      if (!this.audioReady) {
        log('audio engine: not started early, starting now');
        const ok = await this.prepareAudio();
        // The native engine swallows failures (e.g. audio focus denied) and returns false.
        if (!ok && this.wantListening) throw new Error('Could not start the audio engine. Close other audio apps or end any call and try again.');
      } else {
        log('audio engine: already running (started early)');
      }
      if (!this.wantListening) {
        // The user closed the assistant while the engine was still starting: the mic stays off.
        this.idleAudio();
        return;
      }
      const recording = toggleRecording(true);
      log('audio ready, recording =', recording, '| socketReady', this.socketReady, '| greeted', this.greeted, '| early audio held', this.earlyAudioBytes, 'bytes');
      if (!recording) throw new Error('Could not start the microphone.');
      this.touch();
      if (this.socketReady) {
        // If the greeting already started talking, play what was held back and show it as speaking.
        this.setState(this.flushEarlyAudio() ? 'speaking' : 'listening');
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

  /** Starts the audio engine (once, shared), with the listeners for mic data and levels. False if the phone refused it. */
  private prepareAudio(): Promise<boolean> {
    if (this.audioReady) return Promise.resolve(true);
    if (this.audioPrep) return this.audioPrep;
    const epoch = this.audioEpoch;
    this.audioPrep = (async () => {
      try {
        // Start from a clean native engine (see the Sarvam client): a stale one survives JavaScript reloads.
        try {
          tearDownAudio();
        } catch {
          /* nothing was running */
        }
        log('audio engine: starting');
        const ok = await initAudio();
        log('audio engine: started, ok =', ok, '| socketReady now', this.socketReady);
        if (ok === false) return false;
        if (epoch !== this.audioEpoch) {
          // Released (logout, background, a stop) while it was starting: do not leave it running.
          try {
            tearDownAudio();
          } catch {
            /* ignore */
          }
          return false;
        }
        this.audioReady = true;
        this.subs.push(
          addExpoTwoWayAudioEventListener('onMicrophoneData', (e) => this.sendMic(e.data)),
          addExpoTwoWayAudioEventListener('onInputVolumeLevelData', (e) => this.emitLevels({ input: e.data })),
          addExpoTwoWayAudioEventListener('onAudioInterruption', (e) => log('AUDIO FOCUS EVENT from system:', e.data)),
          addExpoTwoWayAudioEventListener('onOutputVolumeLevelData', (e) => this.emitLevels({ output: e.data })),
        );
        return true;
      } catch (e) {
        log('audio engine: failed to start:', e instanceof Error ? e.message : e);
        return false;
      } finally {
        this.audioPrep = null;
      }
    })();
    return this.audioPrep;
  }

  /** Starts the audio engine ahead of the first tap, when the microphone permission is already there (never asks). */
  private async prewarmAudio() {
    if (this.audioReady || this.audioPrep || this.wantListening) return;
    try {
      if (!this.micGranted) {
        const perm = await getMicrophonePermissionsAsync();
        log('audio early start: mic permission already granted =', perm.granted);
        if (!perm.granted) return;
        this.micGranted = true;
      }
      if (!this.wantWarm || this.audioReady || this.audioPrep) return;
      await this.prepareAudio();
      this.scheduleAudioRelease();
    } catch {
      /* the tap will start it */
    }
  }

  /** The mic is off and the speaker is quiet, but the engine stays up for the next tap. It is let go after a while unused. */
  private idleAudio() {
    this.earlyAudio = [];
    this.earlyAudioBytes = 0;
    if (this.tailTimer) clearTimeout(this.tailTimer);
    this.tailTimer = null;
    if (this.audioReady) {
      try {
        toggleRecording(false);
      } catch {
        /* audio engine may already be down */
      }
    }
    this.scheduleAudioRelease();
  }

  private scheduleAudioRelease() {
    if (this.audioReleaseTimer) clearTimeout(this.audioReleaseTimer);
    this.audioReleaseTimer = setTimeout(() => {
      this.audioReleaseTimer = null;
      if (!this.wantListening) {
        log('audio engine: unused for a while, letting it go');
        this.releaseAudio();
      }
    }, AUDIO_KEEP_MS);
  }

  /** Lets the audio engine go now (the app went to the background). The connection stays as it is. */
  releaseAudioEngine() {
    if (this.wantListening) return;
    this.releaseAudio();
  }

  /** Plays reply audio that arrived before the speaker was ready. Returns true if there was any. */
  private flushEarlyAudio(): boolean {
    const held = this.earlyAudio;
    this.earlyAudio = [];
    this.earlyAudioBytes = 0;
    if (!held.length || !this.audioReady) return false;
    for (const chunk of held) this.enqueueAudio(chunk);
    return true;
  }

  /** Asks Gemini to say its spoken hello once the mic and speaker are both ready (or, with `early`, while they start). */
  private maybeGreet(early = false) {
    log('maybeGreet(early =', early, ') | greeted', this.greeted, '| wantListening', this.wantListening, '| socketReady', this.socketReady, '| audioReady', this.audioReady);
    if (this.greeted || !this.wantListening || !this.socketReady || (!this.audioReady && !early)) return;
    this.greeted = true;
    log('greeting: sending the "say hello" text to Gemini');
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
    this.continuePending = false;
    this.clearNudge();
    this.closeAfterReply = false;
    this.lastUserWordAt = 0;
    this.clearPlayback();
    this.idleAudio();
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

  /** Silence nudges are for a conversation the user is looking at; off while the orb is minimised. */
  setNudges(enabled: boolean) {
    this.nudgesEnabled = enabled;
    if (!enabled) this.clearNudge();
    else if (this.state === 'listening') this.scheduleNudge();
  }

  private clearNudge() {
    if (this.nudgeTimer) clearTimeout(this.nudgeTimer);
    this.nudgeTimer = null;
  }

  private scheduleNudge() {
    this.clearNudge();
    if (!NUDGES || !this.nudgesEnabled || !this.wantListening || this.holdOpen || this.closeAfterReply) return;
    this.nudgeTimer = setTimeout(() => this.fireNudge(), NUDGE_AFTER_MS);
  }

  private fireNudge() {
    this.nudgeTimer = null;
    if (!NUDGES || !this.nudgesEnabled || !this.wantListening || this.holdOpen || !this.socketReady || this.closeAfterReply) return;
    // Something else is going on: the state change that follows will schedule the next one.
    if (this.state !== 'listening' || this.toolsRunning > 0 || this.continuePending) return;
    if (Date.now() - this.lastSpeechTouch < 3000) {
      this.nudgeTimer = setTimeout(() => this.fireNudge(), 4000);
      return;
    }
    if (this.nudgeCount >= NUDGE_MAX) {
      log('nudge: the user is still silent, saying the closing line, then ending the conversation');
      this.closeAfterReply = true;
      this.send({ realtimeInput: { text: FINAL_NUDGE_PROMPT } });
      return;
    }
    const angle = NUDGE_ANGLES[(this.nudgeBase + this.nudgeCount) % NUDGE_ANGLES.length];
    this.nudgeCount += 1;
    log(`nudge #${this.nudgeCount}: user silent for ${NUDGE_AFTER_MS / 1000} s after the reply, asking Gemini to speak up |`, angle);
    this.send({ realtimeInput: { text: nudgePrompt(angle) } });
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
    const t0 = Date.now();
    log('token: getting the login token');
    const accessToken = await this.opts.getAccessToken();
    log('token: login token ready in', Date.now() - t0, 'ms');
    if (!accessToken) throw new Error('Please log in to use the voice assistant.');

    // The function is sometimes cold and takes several seconds to answer. So a second identical request goes out in parallel
    // when the first has not answered within a moment (or at once if the first failed); whichever answers first is used.
    const send = (label: string): Promise<Response> => {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), TOKEN_TIMEOUT_MS);
      log('token: voice-token request sent (' + label + ')');
      return fetch(`${SUPABASE_URL}/functions/v1/voice-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        // `want: 'gemini'`: mint the token whatever the admin chose, and report the admin's choice alongside it.
        body: JSON.stringify({ want: 'gemini', supports: ['gemini', 'sarvam'] }),
        signal: abort.signal,
      })
        .then((r) => {
          log('token: voice-token', label, 'answered', r.status, 'after', Date.now() - t0, 'ms');
          return r;
        })
        .finally(() => clearTimeout(timer));
    };
    let res: Response;
    try {
      res = await new Promise<Response>((resolve, reject) => {
        let launched = 0;
        let finished = 0;
        let done = false;
        let lastBad: Response | null = null;
        let hedge: ReturnType<typeof setTimeout> | null = null;
        const fail = () => {
          finished += 1;
          if (done) return;
          if (launched < 2) {
            launch('retry');
          } else if (finished >= 2) {
            done = true;
            if (lastBad) resolve(lastBad);
            else reject(new Error('no answer'));
          }
        };
        const launch = (label: string) => {
          launched += 1;
          send(label).then(
            (r) => {
              if (done) return;
              if (r.ok || r.status === 401) {
                done = true;
                if (hedge) clearTimeout(hedge);
                resolve(r);
              } else {
                lastBad = r;
                fail();
              }
            },
            () => fail(),
          );
        };
        launch('first');
        hedge = setTimeout(() => {
          if (!done && launched < 2) launch('parallel');
        }, TOKEN_HEDGE_MS);
      });
    } catch {
      throw new Error('The voice service is slow to respond. Check your connection.');
    }
    log('token: voice-token answered', res.status, 'in', Date.now() - t0, 'ms');
    if (res.status === 401) {
      this.opts.onAuthRejected?.();
      throw new AuthRejectedError();
    }
    if (!res.ok) throw new Error(`Voice service unavailable (${res.status}).`);
    const data = await res.json();
    if (data.engine) {
      this.opts.onServerConfig?.({
        engine: data.engine,
        fallback: data.fallback_engine === 'gemini' || data.fallback_engine === 'sarvam' ? data.fallback_engine : null,
        relayUrl: typeof data.relay_url === 'string' ? data.relay_url : undefined,
      });
    }
    if (!data.token) throw new Error('Voice service returned no token.');
    this.model = data.model;
    return data.token as string;
  }

  private async openSocket() {
    if (!this.wantWarm || this.ws) return;
    log('openSocket: begin | wantListening', this.wantListening);
    if (!this.wantListening) this.setState('connecting');
    let token: string;
    try {
      token = await this.fetchToken();
    } catch (e) {
      log('token fetch failed:', e instanceof Error ? e.message : e);
      // A refused login will not fix itself by retrying: stop here (the app signs the user out if it has really ended).
      if (e instanceof AuthRejectedError) { this.wantWarm = false; this.setState('idle'); return; }
      this.scheduleReconnect(e instanceof Error ? e.message : undefined);
      return;
    }
    if (!this.wantWarm || this.ws) return;

    log('socket: opening to Google');
    const ws = new WebSocket(`${LIVE_WS_URL}?access_token=${encodeURIComponent(token)}`);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    const openedAt = Date.now();
    ws.onopen = () => {
      log('socket open after', Date.now() - openedAt, 'ms', this.resumeHandle ? '(resuming)' : '(fresh session)');
      const setup = JSON.stringify(this.buildSetup());
      log('setup message: sending', setup.length, 'characters (prompt + tools)');
      this.setupSentAtGlobal = Date.now();
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(setup);
    };
    // A handshake that never completes must not leave "connecting" up for ever: give up on it and start over.
    if (this.setupWatchdog) clearTimeout(this.setupWatchdog);
    this.setupWatchdog = setTimeout(() => {
      this.setupWatchdog = null;
      if (this.ws !== ws || this.setupDone) return;
      log('setup timed out, starting over');
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
      if (this.replyStartAt) log('CUT: the connection closed in the middle of a reply that had run', Date.now() - this.replyStartAt, 'ms');
      if (this.setupWatchdog) clearTimeout(this.setupWatchdog);
      this.setupWatchdog = null;
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

  private scheduleReconnect(errorMessage?: string) {
    if (!this.wantWarm || this.reconnectTimer) return;
    this.reconnectAttempts += 1;
    log('scheduleReconnect: attempt', this.reconnectAttempts, '| reason:', errorMessage ?? '(socket closed)', '| wantListening', this.wantListening);
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
    // The first retry while the user is waiting goes out at once; after that it backs off.
    const delay = this.wantListening && this.reconnectAttempts === 1 ? 0 : Math.min(MAX_RECONNECT_DELAY_MS, 300 * 2 ** (this.reconnectAttempts - 1));
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
    // Fresh facts come from the app's own `web_search` tool, not Gemini's built-in Google Search: with this project's key
    // Google refuses a live session that has the built-in one (close code 1011, "exceeded your current quota"), which
    // made every cold start waste about three seconds on two doomed connections before it connected without it.
    const tools: Record<string, unknown>[] = [];
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
      this.reconnectAttempts = 0;
      this.socketReady = true;
      this.setupDone = true;
      log('setupComplete (Google took', this.setupSentAtGlobal ? Date.now() - this.setupSentAtGlobal : '?', 'ms to accept the setup)');
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
      log('CUT RISK: Google says goAway (the connection is about to be closed):', JSON.stringify(msg.goAway), '| reply in progress', this.replyStartAt ? `${Date.now() - this.replyStartAt} ms` : 'no');
      // Server is about to close; reconnect (quietly) with the resumption handle.
      this.ws?.close();
      return;
    }

    if (msg.toolCall?.functionCalls) {
      void this.runTools(msg.toolCall.functionCalls as LiveToolCall[]);
    }

    const sc = msg.serverContent;
    if (!sc) return;
    if (this.greetAt && this.lastContentAt < this.greetAt) log('first reply content from Gemini,', Date.now() - this.greetAt, 'ms after the greeting was sent');
    this.lastContentAt = Date.now();
    if (this.continueWatchdog) {
      clearTimeout(this.continueWatchdog);
      this.continueWatchdog = null;
    }
    this.touch();

    for (const key of ['generationComplete', 'waitingForInput'] as const) {
      if ((sc as Record<string, unknown>)[key]) log('server flag:', key, '| reply so far', this.replyStartAt ? `${Date.now() - this.replyStartAt} ms` : 'none');
    }
    if (sc.interrupted) {
      this.continuePending = false;
      this.lastInterruptAt = Date.now();
      log(
        'CUT: INTERRUPTED by Gemini (it heard speech) |', this.replyStartAt ? `reply had run ${Date.now() - this.replyStartAt} ms, ${Math.round(this.replyBytes / 48)} ms of audio received` : 'no reply in progress',
        '| state', this.state, '| mic peak during this reply', this.replyMicPeak, '| loud mic chunks', this.replyLoudChunks,
        '| last words said by user:', JSON.stringify(this.pendingUser.slice(-60)), '| reply text so far:', JSON.stringify(this.pendingAssistant.slice(-80)),
      );
      this.clearPlayback();
      this.setState('listening');
    }

    if (sc.inputTranscription?.text) {
      this.lastUserWordAt = Date.now();
      this.turnFirstAudio = false;
      log('you said:', sc.inputTranscription.text);
      this.pendingUser += sc.inputTranscription.text;
      // A genuine new request from the user: the automatic-continue allowance starts again.
      this.lastUserSpeechAt = Date.now();
      this.autoContinues = 0;
      this.continuePending = false;
      this.requestStartAt = Date.now();
      this.requestCapMs = continueCapFor(this.pendingUser);
      // The user is talking: no nudges, the count starts again, and a goodbye ends the conversation once it has been answered.
      this.clearNudge();
      this.nudgeCount = 0;
      this.closeAfterReply = NUDGES && isGoodbye(this.pendingUser);
      if (this.closeAfterReply) log('goodbye heard:', JSON.stringify(this.pendingUser.trim()), '- the conversation will close after the farewell');
      this.opts.onTranscript?.('user', sc.inputTranscription.text, false);
    }
    if (sc.outputTranscription?.text) {
      this.pendingAssistant += sc.outputTranscription.text;
      this.opts.onTranscript?.('assistant', sc.outputTranscription.text, false);
    }

    for (const part of sc.modelTurn?.parts ?? []) {
      const data = part.inlineData?.data;
      if (data) {
        const bytes = Math.floor((data.length * 3) / 4);
        const nowChunk = Date.now();
        if (this.replyChunks > 0 && nowChunk - this.lastChunkAt > 500) {
          log('REPLY GAP: no audio for', nowChunk - this.lastChunkAt, 'ms in the middle of a reply (', Math.round(this.replyBytes / 48), 'ms of audio received so far )');
        }
        if (!this.turnFirstAudio) {
          this.replyStartAt = nowChunk;
          this.replyBytes = 0;
          this.replyChunks = 0;
          this.replyMicPeak = 0;
          this.replyLoudChunks = 0;
        }
        this.replyBytes += bytes;
        this.replyChunks += 1;
        this.lastChunkAt = nowChunk;
        if (!this.turnFirstAudio) {
          this.turnFirstAudio = true;
          log('first AUDIO chunk of this reply |', this.greetAt && this.greeted ? `${Date.now() - this.greetAt}ms after greeting sent |` : '', 'audioReady', this.audioReady, '| held early', this.earlyAudioBytes);
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
      const turnAudioMs = this.replyStartAt ? Math.round(this.replyBytes / 48) : 0;
      const turnText = this.pendingAssistant;
      const turnStartedAt = this.replyStartAt;
      log(
        'turnComplete (Gemini finished its turn) |', this.replyStartAt ? `reply lasted ${Date.now() - this.replyStartAt} ms, ${Math.round(this.replyBytes / 48)} ms of audio, ${this.replyChunks} chunks` : 'no audio in this turn',
        '| reply text length', this.pendingAssistant.length, '| ended with:', JSON.stringify(this.pendingAssistant.slice(-60)),
      );
      this.replyStartAt = 0;
      this.turnFirstAudio = false;
      this.flushHistoryLines();
      this.opts.onTranscript?.('assistant', '', true);
      this.considerContinue(turnAudioMs, turnText, turnStartedAt);
      if (CAN_FLUSH) {
        // Native player has no "finished" callback; the output level dropping to 0 ends it.
        this.speakingTail();
      } else if (!this.playQueue.length) {
        this.setState(this.wantListening ? 'listening' : 'ready');
      }
    }
  }

  /** After a turn ends: asks Gemini to carry on when a long answer was probably cut short by its own turn limit. */
  private considerContinue(audioMs: number, text: string, turnStartedAt: number) {
    const wasContinuation = this.continuePending;
    this.continuePending = false;
    if (this.continueWatchdog) clearTimeout(this.continueWatchdog);
    this.continueWatchdog = null;
    const why = (reason: string) => log('auto-continue: not continuing,', reason, `(audio ${audioMs} ms, ${text.trim().length} chars, continues used ${this.autoContinues}/${AUTO_CONTINUE_MAX})`);
    if (!AUTO_CONTINUE) return;
    if (!this.wantListening || this.holdOpen || !this.socketReady) return why('not in a conversation');
    if (this.toolsRunning > 0) return why('a tool is running');
    const clean = text.trim();
    if (wasContinuation) {
      if (audioMs < AUTO_CONTINUE_MIN_PROGRESS_MS || clean.length < AUTO_CONTINUE_MIN_PROGRESS_CHARS) return why('the answer was already complete');
      const head = clean.slice(0, 60).toLowerCase();
      if (head.length >= 30 && this.prevTurnText.toLowerCase().includes(head)) return why('it repeated what it had just said');
    }
    this.prevTurnText = clean.slice(-400);
    if (audioMs < AUTO_CONTINUE_MIN_AUDIO_MS) return;
    if (clean.endsWith('?')) return why('it ended with a question for the user');
    if (this.lastUserSpeechAt > turnStartedAt) return why('the user spoke during the reply');
    if (this.autoContinues >= AUTO_CONTINUE_MAX) return why('the limit for one request was reached');
    if (Date.now() - this.requestStartAt > this.requestCapMs) return why('the time limit for one request was reached');
    this.autoContinues += 1;
    this.continuePending = true;
    log(`auto-continue #${this.autoContinues}: the reply ended after ${audioMs} ms of speech, asking Gemini to carry on | ended with:`, JSON.stringify(clean.slice(-60)));
    this.send({ realtimeInput: { text: CONTINUE_PROMPT } });
    this.continueWatchdog = setTimeout(() => {
      this.continueWatchdog = null;
      this.continuePending = false;
    }, AUTO_CONTINUE_SILENCE_MS);
  }

  private async runTools(calls: LiveToolCall[]) {
    this.toolsRunning += 1;
    this.continuePending = false;
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
    this.toolsRunning = Math.max(0, this.toolsRunning - 1);
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
    if (!this.audioReady) {
      log('audio chunk arrived but the speaker engine is not ready yet', this.wantListening && this.greeted ? '(kept)' : '(DROPPED)');
      // The speaker is still starting for the greeting we asked for: keep a short stretch of it. Otherwise the
      // assistant spoke while the mic/speaker engine is off, so there is nobody to hear it.
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
    if (this.state === 'speaking') log('playback cleared while speaking | queued chunks', this.playQueue.length);
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
      if (this.state === 'speaking') {
        if (chunkPeak > this.replyMicPeak) this.replyMicPeak = chunkPeak;
        if (chunkPeak > 3000) {
          this.replyLoudChunks += 1;
          if (this.replyLoudChunks === 1 || this.replyLoudChunks % 10 === 0) log('mic is LOUD while the assistant speaks (peak', chunkPeak, ', loud chunks', this.replyLoudChunks, ') - its own voice or noise being heard?');
        }
      }
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
    // Never while the assistant is speaking: a long reply must not be cut off by the silence timer. It starts again from the
    // moment the speaking ends (see setState).
    if (!this.wantListening || this.holdOpen || this.state === 'speaking') return;
    this.idleTimer = setTimeout(() => {
      log('idle timeout: no speech for', this.idleMs, 'ms, switching the mic off | state', this.state);
      this.stopListening();
    }, this.idleMs);
  }

  private setState(state: LiveState) {
    if (this.state === state) return;
    log('state', this.state, '->', state);
    if (this.tapAt && (state === 'listening' || state === 'speaking')) {
      log('tap -> listening in', Date.now() - this.tapAt, 'ms');
      this.tapAt = 0;
    }
    const before = this.state;
    this.state = state;
    if (state === 'speaking') {
      if (this.idleTimer) clearTimeout(this.idleTimer);
      this.idleTimer = null;
      this.clearNudge();
    } else if (this.wantListening) {
      this.touch();
    }
    if (state === 'listening') {
      if (before === 'speaking' && this.closeAfterReply && this.wantListening) {
        // The farewell (or the closing line) has been spoken: end the conversation.
        setTimeout(() => {
          if (this.closeAfterReply && this.wantListening && this.state === 'listening') {
            log('closing the conversation after the farewell');
            this.closeAfterReply = false;
            this.stopListening();
          }
        }, 600);
      } else {
        this.scheduleNudge();
      }
    } else if (state !== 'speaking') {
      this.clearNudge();
    }
    this.opts.onState?.(state);
  }

  private releaseAudio() {
    this.audioEpoch++;
    if (this.audioReleaseTimer) clearTimeout(this.audioReleaseTimer);
    this.audioReleaseTimer = null;
    this.earlyAudio = [];
    this.earlyAudioBytes = 0;
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
