/**
 * The agent room ("council"): the user describes a situation, says how many agents should work on it and what their own
 * assistant should do in the room, and the assistant casts the agents, seats them around a table and runs the discussion
 * turn by turn. Each agent is its own Gemini Live session with its own voice; the room is heard in stereo from the seats.
 */

/** 'director' is the user's own assistant; every cast member has a short id of its own. */
export type SpeakerId = string;
export const DIRECTOR_ID = 'director';
export const USER_ID = 'user';

/** Where a voice comes from: pan is -1 (hard left) to 1 (hard right); distance 0 (close) to 1 (far side of the room). */
export interface Seat {
  pan: number;
  distance: number;
}

export interface CastMember {
  id: SpeakerId;
  name: string;
  /** "Defence counsel", "Senior cardiologist", "Judge". */
  role: string;
  /** What this agent is trying to achieve or protect in the discussion. */
  goal: string;
  /** How they talk: "measured and formal", "quick, sharp, interrupts with facts". */
  style: string;
  /** A Gemini prebuilt voice id, distinct from every other seat. */
  voice: string;
  gender: 'female' | 'male';
  seat: Seat;
}

export interface PlannedTurn {
  speaker: SpeakerId;
  /** The director's stage note for this turn: what the speaker should do now. */
  cue: string;
}

export interface CouncilPlan {
  title: string;
  /** One line that sets the scene: "A district court hearing a tenancy dispute". */
  setting: string;
  cast: CastMember[];
  turns: PlannedTurn[];
  /** The cast member who gives the final word (the judge, the chief doctor), or null when the director does. */
  decisionBy: SpeakerId | null;
}

export interface CouncilScenario {
  /** The situation in the user's words. */
  scenario: string;
  agentCount: number;
  /** Role hints, one per agent when the user gave them; the director fills any gaps. */
  roles: string[];
  /** What the user's own assistant does in the room: moderator, clerk, chair, host... */
  directorRole: string;
  /** How the user takes part: observer, the client, a junior who may ask questions... */
  userPart: string;
  /** The language the room speaks in. */
  language: string;
  /** Stereo seating and room sound (needs earphones to mean much). */
  spatial: boolean;
  /**
   * 'phone': the lines are written by one shared text-only session and spoken by the phone's own voices (free).
   * 'studio': every agent is its own Gemini audio session with a Gemini voice (far more expensive, best voices).
   */
  voiceMode: 'phone' | 'studio';
}

export interface TranscriptLine {
  id: string;
  speaker: SpeakerId;
  name: string;
  text: string;
  kind: 'agent' | 'director' | 'user';
  at: number;
}

export interface Decision {
  summary: string;
  decision: string;
  keyPoints: string[];
  nextSteps: string[];
}

export type CouncilStatus =
  | 'idle'
  | 'preparing'
  | 'running'
  | 'paused'
  | 'finished'
  | 'error';

export type CouncilEvent =
  | { type: 'status'; status: CouncilStatus; note?: string }
  | { type: 'transcript'; lines: TranscriptLine[] }
  /** Who is being heard right now (null between turns). */
  | { type: 'speaking'; speaker: SpeakerId | null }
  /** Whose line is being written right now (null when nothing is in flight). */
  | { type: 'thinking'; speaker: SpeakerId | null }
  | { type: 'decision'; decision: Decision }
  | { type: 'error'; message: string };
