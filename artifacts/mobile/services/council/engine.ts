import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { bytesToBase64 } from '@/services/geminiLive/pcm';
import type { DocumentContent } from '@/services/documents/generate';
import {
  agentSystemPrompt,
  decisionName,
  directorSystemPrompt,
  directorVoicePrompt,
  planCouncil,
  planMore,
  planReply,
  stageSystemPrompt,
  stageTurnPrompt,
  turnPrompt,
  writeDecision,
  type DirectorIdentity,
} from './director';
import { LiveSession } from './liveSession';
import { assignPhoneVoices, canSynthesizeToFile, speakPlain, stopPlain, synthesizeToPcm, type PhoneVoice } from './phoneVoice';
import { DIRECTOR_SEAT, renderPlainWav, renderSpatialWav } from './spatial';
import {
  DIRECTOR_ID,
  USER_ID,
  type CouncilEvent,
  type CouncilPlan,
  type CouncilScenario,
  type CouncilStatus,
  type Decision,
  type PlannedTurn,
  type SpeakerId,
  type TranscriptLine,
} from './types';

/**
 * Runs one room. The director (a text session) casts and plans. Then, depending on the voice mode:
 *
 *   phone   one shared text-only "stage" session writes every line in turn, and the phone's own text-to-speech engine
 *           speaks it into a file (free). Two tokens for the whole room, no audio tokens at all.
 *   studio  every cast member and the director's voice are Gemini audio sessions with Gemini voices.
 *
 * Either way each line's audio is placed at the speaker's seat, turns are generated one ahead of playback, and the
 * transcript shows a line the moment its audio starts.
 */

/** How much of the room's sound the voices carry (0 dry, 1 a hall). */
const ROOM_AMOUNT = 0.72;
/** Reading time per word when the room is muted. */
const READ_MS_PER_WORD = 330;
const MAX_CONSECUTIVE_FAILURES = 3;

interface ReadyLine {
  turn: PlannedTurn;
  line: TranscriptLine;
  /** A WAV file in the cache, or null when the line has to be spoken by the phone directly (or not at all). */
  uri: string | null;
  /** The phone voice to speak with when there is no file (phone mode without the native module). */
  plain: PhoneVoice | null;
}

export interface EngineDeps {
  getAccessToken: () => Promise<string | null | undefined>;
  identity: DirectorIdentity;
  scenario: CouncilScenario;
}

let counter = 0;
const nextId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

export class CouncilEngine {
  readonly scenario: CouncilScenario;
  readonly identity: DirectorIdentity;
  plan: CouncilPlan | null = null;
  status: CouncilStatus = 'idle';
  decision: Decision | null = null;
  speaking: SpeakerId | null = null;
  thinking: SpeakerId | null = null;
  muted = false;
  /** Every line generated so far, including ones not yet heard. */
  private lines: TranscriptLine[] = [];
  /** How many of `lines` the user has been shown (a line appears when it starts playing). */
  private visible = 0;

  private readonly getAccessToken: () => Promise<string | null | undefined>;
  private director: LiveSession | null = null;
  /** Studio mode: the director's own voice. */
  private directorVoice: LiveSession | null = null;
  /** Studio mode: one audio session per cast member. */
  private channels = new Map<SpeakerId, LiveSession>();
  /** Phone mode: the one session that writes every line. */
  private stage: LiveSession | null = null;
  private phoneVoices = new Map<SpeakerId, PhoneVoice>();
  /** The lines each session has already been sent (by id, so a line slipped in by the user is never missed). */
  private seen = new Map<SpeakerId, Set<string>>();
  private queue: PlannedTurn[] = [];
  private ready: ReadyLine[] = [];
  private producing = false;
  private paused = false;
  private stopped = false;
  private started = false;
  private failures = 0;
  private waiters: (() => void)[] = [];
  private sound: Audio.Sound | null = null;
  private cancelPlayback: (() => void) | null = null;
  private listeners = new Set<(e: CouncilEvent) => void>();
  private readonly dir = `${FileSystem.cacheDirectory ?? ''}council/`;
  private fileNo = 0;

  constructor(deps: EngineDeps) {
    this.scenario = deps.scenario;
    this.identity = deps.identity;
    this.getAccessToken = deps.getAccessToken;
  }

  // ─── Observers ─────────────────────────────────────────────────────────────

  subscribe(fn: (e: CouncilEvent) => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  /** The lines the user has been shown so far. */
  get transcript(): TranscriptLine[] {
    return this.lines.slice(0, this.visible);
  }

  get hasMoreQueued(): boolean {
    return this.queue.length > 0 || this.ready.length > 0 || this.producing;
  }

  /** True when the voices can be placed in the room on this phone in the chosen mode. */
  get roomSoundAvailable(): boolean {
    return this.scenario.spatial && (this.scenario.voiceMode === 'studio' || canSynthesizeToFile());
  }

  private emit(e: CouncilEvent) {
    for (const fn of this.listeners) {
      try { fn(e); } catch { /* a listener's problem */ }
    }
  }

  private setStatus(status: CouncilStatus, note?: string) {
    this.status = status;
    this.emit({ type: 'status', status, note });
  }

  // ─── Setup ─────────────────────────────────────────────────────────────────

  /** Asks the director to cast the room. Call once; the plan can then be shown before `start()`. */
  async prepare(): Promise<CouncilPlan> {
    this.setStatus('preparing', 'Your assistant is casting the room…');
    this.director = new LiveSession({
      getAccessToken: this.getAccessToken,
      systemInstruction: directorSystemPrompt(this.identity, this.scenario),
      mode: 'text',
      label: 'director',
    });
    try {
      this.plan = await planCouncil(this.director, this.scenario, this.identity);
    } catch (e) {
      this.setStatus('error', e instanceof Error ? e.message : String(e));
      throw e;
    }
    this.queue = [...this.plan.turns];
    this.setStatus('idle', 'The room is ready.');
    // Warm the voices' tokens now, so the first turns do not each wait for one.
    this.openChannels();
    return this.plan;
  }

  private openChannels() {
    if (!this.plan) return;
    if (this.scenario.voiceMode === 'phone') {
      this.stage = new LiveSession({
        getAccessToken: this.getAccessToken,
        systemInstruction: stageSystemPrompt(this.plan, this.scenario, this.identity),
        mode: 'text',
        label: 'stage',
      });
      this.stage.prefetch();
      return;
    }
    this.directorVoice = new LiveSession({
      getAccessToken: this.getAccessToken,
      systemInstruction: directorVoicePrompt(this.plan, this.scenario, this.identity),
      mode: 'audio',
      voice: this.identity.voice,
      label: 'director-voice',
    });
    this.directorVoice.prefetch();
    for (const m of this.plan.cast) {
      const s = new LiveSession({
        getAccessToken: this.getAccessToken,
        systemInstruction: agentSystemPrompt(m, this.plan, this.scenario, this.identity),
        mode: 'audio',
        voice: m.voice,
        label: m.name,
      });
      this.channels.set(m.id, s);
    }
    // Only the first speakers need a token right away; the rest connect when their turn comes near.
    for (const t of this.queue.slice(0, 3)) this.channels.get(t.speaker)?.prefetch();
  }

  /** Starts the discussion. */
  async start() {
    if (!this.plan || this.started || this.stopped) return;
    this.started = true;
    try {
      await FileSystem.makeDirectoryAsync(this.dir, { intermediates: true });
    } catch {
      /* exists */
    }
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false, staysActiveInBackground: false });
    } catch {
      /* playback still works with the defaults */
    }
    if (this.scenario.voiceMode === 'phone') {
      try {
        this.phoneVoices = await assignPhoneVoices(this.scenario.language, this.plan.cast, this.identity.gender);
      } catch {
        this.phoneVoices = new Map();
      }
    }
    this.setStatus('running');
    void this.produce();
    void this.consume();
  }

  // ─── Controls ──────────────────────────────────────────────────────────────

  pause() {
    if (this.paused || this.stopped) return;
    this.paused = true;
    void this.sound?.pauseAsync().catch(() => {});
    if (this.status === 'running') this.setStatus('paused');
  }

  resume() {
    if (!this.paused || this.stopped) return;
    this.paused = false;
    void this.sound?.playAsync().catch(() => {});
    if (this.status === 'paused') this.setStatus('running');
    this.wake();
  }

  setMuted(muted: boolean) {
    if (this.muted === muted) return;
    this.muted = muted;
    // Muting mid-line: stop the audio and let the reading timer take over from here.
    if (muted) { stopPlain(); this.cancelPlayback?.(); }
  }

  /** The user speaks up: the line goes into the room at once and the director decides who answers. */
  async interject(text: string) {
    const said = text.replace(/\s+/g, ' ').trim();
    if (!said || !this.plan || this.stopped) return;
    const line: TranscriptLine = { id: nextId(), speaker: USER_ID, name: this.identity.userName, text: said, kind: 'user', at: Date.now() };
    // The line goes in right after what the user has heard and shows at once. A line already written but not yet
    // heard plays first (the room finishes its sentence), then the answer the director chooses.
    this.lines.splice(this.visible, 0, line);
    this.visible++;
    this.emit({ type: 'transcript', lines: this.transcript });
    let turns: PlannedTurn[];
    try {
      turns = await planReply(this.director!, this.plan, this.lines, this.identity, said, this.queue);
    } catch {
      turns = [{ speaker: DIRECTOR_ID, cue: `Answer ${this.identity.userName} directly.` }];
    }
    if (this.stopped) return;
    this.queue.unshift(...turns);
    if (this.status === 'finished') this.setStatus('running');
    this.wake();
  }

  /** The user wants the discussion to go on: the director plans a few more turns. */
  async more() {
    if (!this.plan || this.stopped || !this.director) return;
    this.emit({ type: 'status', status: this.status, note: 'Planning more turns…' });
    try {
      const turns = await planMore(this.director, this.plan, this.lines);
      if (this.stopped) return;
      this.queue.push(...turns);
      for (const t of turns.slice(0, 2)) this.speakerSession(t.speaker)?.prefetch();
      if (this.status === 'finished') this.setStatus('running');
    } catch (e) {
      this.emit({ type: 'error', message: e instanceof Error ? e.message : String(e) });
    }
    this.wake();
  }

  /** Ends the room and releases every connection and file. */
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    stopPlain();
    this.cancelPlayback?.();
    this.wake();
    this.director?.close();
    this.directorVoice?.close();
    this.stage?.close();
    for (const s of this.channels.values()) s.close();
    this.channels.clear();
    void FileSystem.deleteAsync(this.dir, { idempotent: true }).catch(() => {});
    if (this.status !== 'error') this.setStatus('idle', 'The room is closed.');
  }

  // ─── The two loops ─────────────────────────────────────────────────────────

  private wake() {
    const w = this.waiters;
    this.waiters = [];
    for (const fn of w) fn();
  }

  private wait(): Promise<void> {
    return new Promise((resolve) => { this.waiters.push(resolve); });
  }

  /** Writes the next line whenever fewer than one is waiting to be heard. */
  private async produce() {
    while (!this.stopped) {
      if (this.ready.length >= 1 || this.queue.length === 0) { await this.wait(); continue; }
      const turn = this.queue.shift()!;
      this.producing = true;
      this.thinking = turn.speaker;
      this.emit({ type: 'thinking', speaker: turn.speaker });
      // Warm the speaker after this one while this one writes.
      if (this.queue[0]) this.speakerSession(this.queue[0].speaker)?.prefetch();
      try {
        const item = await this.generate(turn);
        if (this.stopped) break;
        this.failures = 0;
        this.ready.push(item);
      } catch (e) {
        if (this.stopped) break;
        this.failures++;
        const message = e instanceof Error ? e.message : String(e);
        const who = this.nameOf(turn.speaker);
        if (/sign in|login has ended/i.test(message) || this.failures >= MAX_CONSECUTIVE_FAILURES) {
          this.setStatus('error', message);
          this.stop();
          break;
        }
        this.emit({ type: 'error', message: `${who} could not speak (${message}). Moving on.` });
      } finally {
        this.producing = false;
        this.thinking = null;
        if (!this.stopped) this.emit({ type: 'thinking', speaker: null });
      }
      this.wake();
    }
  }

  /** Plays the ready lines one after another, and closes the room when nothing is left. */
  private async consume() {
    while (!this.stopped) {
      if (this.paused) { await this.wait(); continue; }
      const item = this.ready.shift();
      if (!item) {
        if (this.queue.length === 0 && !this.producing && this.status === 'running') await this.finish();
        await this.wait();
        continue;
      }
      // Reveal the line as its audio starts.
      this.visible = Math.max(this.visible, this.lines.indexOf(item.line) + 1);
      this.emit({ type: 'transcript', lines: this.transcript });
      this.speaking = item.line.speaker;
      this.emit({ type: 'speaking', speaker: this.speaking });
      this.wake(); // the producer may start the next line now
      await this.hear(item);
      this.speaking = null;
      if (!this.stopped) this.emit({ type: 'speaking', speaker: null });
      this.wake();
    }
  }

  private async finish() {
    if (!this.plan || !this.director) return;
    this.setStatus('finished', 'Writing the record…');
    try {
      this.decision = await writeDecision(this.director, this.plan, this.lines, this.scenario.language);
      if (!this.stopped) this.emit({ type: 'decision', decision: this.decision });
    } catch (e) {
      if (!this.stopped) this.emit({ type: 'error', message: `Could not write the record: ${e instanceof Error ? e.message : String(e)}` });
    }
    if (!this.stopped && this.status === 'finished') this.setStatus('finished', 'The room has finished.');
  }

  // ─── One turn ──────────────────────────────────────────────────────────────

  private speakerSession(id: SpeakerId): LiveSession | null {
    if (this.scenario.voiceMode === 'phone') return this.stage;
    return id === DIRECTOR_ID ? this.directorVoice : this.channels.get(id) ?? null;
  }

  private nameOf(id: SpeakerId): string {
    if (id === DIRECTOR_ID) return this.identity.name;
    return this.plan?.cast.find((c) => c.id === id)?.name ?? 'Someone';
  }

  private roleOf(id: SpeakerId): string {
    if (id === DIRECTOR_ID) return this.scenario.directorRole;
    return this.plan?.cast.find((c) => c.id === id)?.role ?? 'participant';
  }

  private seatOf(id: SpeakerId) {
    return id === DIRECTOR_ID ? DIRECTOR_SEAT : this.plan!.cast.find((c) => c.id === id)?.seat ?? DIRECTOR_SEAT;
  }

  private async generate(turn: PlannedTurn): Promise<ReadyLine> {
    const session = this.speakerSession(turn.speaker);
    if (!session) throw new Error('No session for this speaker.');
    const name = this.nameOf(turn.speaker);
    // In phone mode the stage session wrote every line itself, so only lines it did not write (the user's) are new to it.
    const key = this.scenario.voiceMode === 'phone' ? 'stage' : turn.speaker;
    const seen = this.seen.get(key) ?? new Set<string>();
    const since = this.lines.filter((l) => !seen.has(l.id));
    const reply = await session.generate(
      this.scenario.voiceMode === 'phone'
        ? {
            incremental: stageTurnPrompt(name, this.roleOf(turn.speaker), turn.cue, since, false, this.lines),
            full: stageTurnPrompt(name, this.roleOf(turn.speaker), turn.cue, since, true, this.lines),
          }
        : {
            incremental: turnPrompt(since, turn.cue, name, seen.size === 0),
            full: turnPrompt(this.lines, turn.cue, name, true),
          },
    );
    for (const l of this.lines) seen.add(l.id);
    const text = cleanLine(reply.text, name) || '…';
    const line: TranscriptLine = {
      id: nextId(),
      speaker: turn.speaker,
      name,
      text,
      kind: turn.speaker === DIRECTOR_ID ? 'director' : 'agent',
      at: Date.now(),
    };
    this.lines.push(line);
    seen.add(line.id);
    this.seen.set(key, seen);

    // The audio: Gemini's own, or the phone's engine writing a file; either is then placed at the seat.
    let pcm: Uint8Array | null = null;
    let sampleRate = 24_000;
    let plain: PhoneVoice | null = null;
    if (this.scenario.voiceMode === 'studio') {
      pcm = reply.pcm;
    } else {
      const voice = this.phoneVoices.get(turn.speaker) ?? { language: 'en-IN', pitch: 1, rate: 1 };
      if (!this.muted) {
        const clip = await synthesizeToPcm(text, voice, this.dir);
        if (clip) { pcm = clip.pcm; sampleRate = clip.sampleRate; }
        else plain = voice;
      }
    }
    let uri: string | null = null;
    if (pcm && pcm.length > 1000) {
      const wav = this.scenario.spatial ? renderSpatialWav(pcm, { seat: this.seatOf(turn.speaker), room: ROOM_AMOUNT }, sampleRate) : renderPlainWav(pcm, sampleRate);
      uri = `${this.dir}line-${++this.fileNo}.wav`;
      await FileSystem.writeAsStringAsync(uri, bytesToBase64(wav), { encoding: FileSystem.EncodingType.Base64 });
    }
    return { turn, line, uri, plain };
  }

  /** Plays a line (or waits a reading time when muted), honouring pause, mute and stop. */
  private async hear(item: ReadyLine) {
    const words = item.line.text.split(/\s+/).length;
    const readMs = Math.min(14_000, Math.max(1_600, words * READ_MS_PER_WORD));
    if (this.muted || (!item.uri && !item.plain)) {
      await this.pausableDelay(readMs);
      return;
    }
    if (!item.uri && item.plain) {
      // No file: the phone speaks the line itself.
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        this.cancelPlayback = finish;
        void speakPlain(item.line.text, item.plain!).then(finish);
      });
      this.cancelPlayback = null;
      return;
    }
    const held: { sound: Audio.Sound | null } = { sound: null };
    try {
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        this.cancelPlayback = finish;
        Audio.Sound.createAsync({ uri: item.uri! }, { shouldPlay: !this.paused, volume: 1 })
          .then((r) => {
            if (done) { void r.sound.unloadAsync().catch(() => {}); return; }
            held.sound = r.sound;
            this.sound = r.sound;
            r.sound.setOnPlaybackStatusUpdate((s) => {
              if (!s.isLoaded) { if (s.error) finish(); return; }
              if (s.didJustFinish) finish();
            });
          })
          .catch(() => finish());
      });
    } finally {
      this.cancelPlayback = null;
      this.sound = null;
      const s = held.sound;
      if (s) { await s.stopAsync().catch(() => {}); await s.unloadAsync().catch(() => {}); }
      void FileSystem.deleteAsync(item.uri!, { idempotent: true }).catch(() => {});
    }
    // Muted mid-line: give the reader the rest of the time.
    if (this.muted && !this.stopped) await this.pausableDelay(Math.round(readMs * 0.6));
  }

  /** Waits in short slices so a pause holds the clock and a stop ends it at once. */
  private async pausableDelay(ms: number) {
    let left = ms;
    while (!this.stopped && left > 0) {
      if (this.paused) { await this.wait(); continue; }
      const slice = Math.min(250, left);
      const t0 = Date.now();
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, slice);
        this.cancelPlayback = () => { clearTimeout(t); resolve(); };
      });
      this.cancelPlayback = null;
      left -= Date.now() - t0;
    }
  }

  // ─── Export ────────────────────────────────────────────────────────────────

  /** The room as a document for the user's library. */
  toDocument(): DocumentContent | null {
    if (!this.plan) return null;
    const cast = this.plan.cast.map((c) => `- **${c.name}**, ${c.role}: ${c.goal}`).join('\n');
    const transcript = this.transcript.map((l) => `**${l.name}:** ${l.text}`).join('\n\n');
    const sections = [
      { heading: 'The room', body: `${this.plan.setting}\n\n${this.identity.name} as ${this.scenario.directorRole}.\n\n${cast}` },
      { heading: 'The matter', body: this.scenario.scenario.trim() },
    ];
    if (this.decision) {
      sections.push({ heading: 'Summary', body: this.decision.summary });
      sections.push({ heading: `Decision (${decisionName(this.plan)})`, body: this.decision.decision });
      if (this.decision.keyPoints.length) sections.push({ heading: 'Key points', body: this.decision.keyPoints.map((p) => `- ${p}`).join('\n') });
      if (this.decision.nextSteps.length) sections.push({ heading: 'Next steps', body: this.decision.nextSteps.map((p) => `- ${p}`).join('\n') });
    }
    sections.push({ heading: 'Transcript', body: transcript || 'Nothing was said.' });
    const wordCount = sections.reduce((n, s) => n + s.body.split(/\s+/).filter(Boolean).length, 0);
    return { kind: 'notes', title: this.plan.title, subtitle: this.plan.setting, sections, sheet: null, wordCount };
  }
}

/** Strips what a model sometimes adds in front of a line: the speaker's name, quotes, stage directions in brackets. */
export function cleanLine(text: string, name: string): string {
  let t = text.replace(/\r/g, '').trim();
  const first = name.split(' ')[0];
  const prefix = new RegExp(`^\\**\\s*(?:${escapeRe(name)}|${escapeRe(first)})\\s*[:：-]\\s*\\**\\s*`, 'i');
  t = t.replace(prefix, '');
  t = t.replace(/^\*{1,2}([^*]+)\*{1,2}$/s, '$1');
  t = t.replace(/\s*[\[(][^\])]{0,80}[\])]\s*/g, ' ');
  t = t.replace(/^["“]+|["”]+$/g, '');
  return t.replace(/\s+/g, ' ').trim();
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
