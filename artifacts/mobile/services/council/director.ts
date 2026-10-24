import { VOICES } from '@/services/assistant/persona';
import type { LiveSession } from './liveSession';
import { DIRECTOR_SEAT, seatsFor } from './spatial';
import { DIRECTOR_ID, USER_ID, type CastMember, type CouncilPlan, type CouncilScenario, type Decision, type PlannedTurn, type TranscriptLine } from './types';

/**
 * The director is the user's own assistant, given a role in the room (clerk, chair, host, mediator). It does the thinking
 * that is not a line of dialogue: casting the agents, writing the order of turns, deciding who answers the user, and
 * writing the decision at the end. Everything here is a prompt to a text-mode Live session and a tolerant JSON parse.
 */

export const MAX_TURNS_PER_PLAN = 18;
export const MORE_TURNS = 6;

const MAX_LINE_WORDS = 90;

export interface DirectorIdentity {
  /** The assistant's name from the user's persona settings. */
  name: string;
  /** The assistant's Gemini voice: the cast never shares it. */
  voice: string;
  /** The assistant's voice gender, for its phone voice. */
  gender: 'female' | 'male';
  /** How the user is addressed ("sir", "ma'am", "Dhanush") when the room talks to them. */
  userName: string;
}

/** How the spoken voices should sound: Indian, natural, never read out like a machine. */
function accentLine(language: string): string {
  const english = /english|hinglish/i.test(language);
  return english
    ? 'Speak in a natural, educated Indian English accent and cadence, the way a professional in India talks: warm, unhurried, with natural pauses and emphasis, never a flat or robotic read.'
    : `Speak ${language} the way a native speaker from India naturally does, warm and conversational, with natural pauses and emphasis, never a flat or robotic read.`;
}

function roleLines(s: CouncilScenario): string {
  if (!s.roles.length) return 'The user left the roles to you: choose roles that such a discussion really has.';
  return `Roles the user asked for, in order: ${s.roles.map((r, i) => `${i + 1}. ${r}`).join('; ')}. Keep these roles (you may sharpen the wording) and invent any that are missing.`;
}

export function directorSystemPrompt(id: DirectorIdentity, s: CouncilScenario): string {
  return [
    `You are ${id.name}, the user's personal assistant, now acting as the director of a role-play room inside the MyAssistant app.`,
    `Your part in the room: ${s.directorRole}.`,
    `The user's part in the room: ${s.userPart}. The user is called ${id.userName}.`,
    `The room speaks ${s.language}.`,
    'You plan and run a realistic discussion between AI agents, each a professional playing a role, so the user can watch how such a discussion really goes.',
    'You answer only with the JSON you are asked for: no markdown fences, no commentary before or after it.',
  ].join('\n');
}

function voiceCatalogue(exclude: string): string {
  return VOICES.filter((v) => v.id !== exclude)
    .map((v) => `${v.id} (${v.gender}, ${v.tone.toLowerCase()})`)
    .join(', ');
}

export function castPrompt(id: DirectorIdentity, s: CouncilScenario): string {
  const turns = Math.min(MAX_TURNS_PER_PLAN, Math.max(8, s.agentCount * 3 + 2));
  return [
    `Set up the room for this situation, told by the user:\n"""${s.scenario.trim()}"""`,
    `Exactly ${s.agentCount} agents take part. ${roleLines(s)}`,
    'Give each agent a realistic Indian name that fits the setting (first name and surname), a role, a one-line goal (what they fight for or must decide), a short style note (how they speak), and a voice.',
    `Voices to choose from (use each at most once, match the gender of the name): ${voiceCatalogue(id.voice)}.`,
    `Then write the order of speaking as a list of ${turns} turns. Each turn is {"speaker": <agent name or "${DIRECTOR_ID}">, "cue": <one sentence telling that speaker what to do in this turn>}.`,
    `Turn 1 is always "${DIRECTOR_ID}" opening the room in your part (${s.directorRole}): a greeting, what the matter is, who is present. The last turn is the decision or verdict by the deciding agent, followed by one closing turn by "${DIRECTOR_ID}". In between, make it real: opening statements, arguments and replies, questions from the one who decides, and answers. Nobody speaks twice in a row.`,
    'Also name the agent who gives the final decision as "decisionBy" (null if nobody does).',
    'Answer with exactly this JSON shape:',
    '{"title": string, "setting": string, "cast": [{"name": string, "role": string, "goal": string, "style": string, "voice": string, "gender": "female"|"male"}], "turns": [{"speaker": string, "cue": string}], "decisionBy": string|null}',
  ].join('\n');
}

export function agentSystemPrompt(m: CastMember, plan: CouncilPlan, s: CouncilScenario, id: DirectorIdentity): string {
  const others = plan.cast.filter((c) => c.id !== m.id).map((c) => `${c.name} (${c.role})`).join('; ');
  return [
    `You are ${m.name}, ${m.role}, taking part in a live role-play: ${plan.setting}.`,
    `The situation: """${s.scenario.trim()}"""`,
    `Your goal: ${m.goal}`,
    `How you speak: ${m.style}`,
    `Also in the room: ${others}. ${id.name} runs the room as ${s.directorRole}. ${id.userName} is present as: ${s.userPart}.`,
    `You speak ${s.language}. ${accentLine(s.language)}`,
    'Rules:',
    '- Speak only as yourself, in the first person, as spoken dialogue. Never narrate, never write stage directions, never speak for anyone else, never say your own name before your line.',
    `- Keep each turn to a few sentences, at most about ${MAX_LINE_WORDS} words; a verdict, opening statement or diagnosis may run to about 140 words.`,
    '- React to what was just said: address people by name, agree, object, ask, answer. Stay in character and realistic for your profession, with concrete details (facts, sections of law, test names, numbers) where a real professional would use them.',
    '- No lists, no markdown, no emojis: plain spoken sentences only.',
    `- When ${id.userName} speaks, answer them directly and respectfully.`,
    '- If the room is about medicine, law or money, you are playing a role for learning; do not add disclaimers inside your lines.',
  ].join('\n');
}

export function directorVoicePrompt(plan: CouncilPlan, s: CouncilScenario, id: DirectorIdentity): string {
  const cast = plan.cast.map((c) => `${c.name} (${c.role})`).join('; ');
  return [
    `You are ${id.name}, the user's personal assistant, acting in a role-play room as: ${s.directorRole}.`,
    `The room: ${plan.setting}. Present: ${cast}. ${id.userName} is present as: ${s.userPart}.`,
    `The situation: """${s.scenario.trim()}"""`,
    `You speak ${s.language}. ${accentLine(s.language)}`,
    'Rules: speak only your own spoken lines in the first person, warm and clear, two to four sentences, no narration or stage directions, no lists, no markdown. Call on people by name. Do not say your own name before your line.',
  ].join('\n');
}

/**
 * The cheap room: one text-only session voices every character in turn. It already remembers every line it wrote, so a
 * turn only needs the cue (and anything the user said), not the transcript again.
 */
export function stageSystemPrompt(plan: CouncilPlan, s: CouncilScenario, id: DirectorIdentity): string {
  const cast = plan.cast.map((c) => `- ${c.name}, ${c.role}. Goal: ${c.goal} Speaks: ${c.style}`).join('\n');
  return [
    `You write a live role-play, one spoken line at a time: ${plan.setting}.`,
    `The situation: """${s.scenario.trim()}"""`,
    'The people in the room:',
    cast,
    `- ${id.name}, the user's personal assistant, acting as: ${s.directorRole}. Warm, clear, calls on people by name.`,
    `${id.userName} is present as: ${s.userPart}. When ${id.userName} speaks, the person asked answers them directly and respectfully.`,
    `Everyone speaks ${s.language}. Write the lines the way Indian professionals really talk: natural conversational rhythm, the phrasing and courtesies of an Indian courtroom, clinic or boardroom, names and honorifics used the way they are here. Short sentences that read well aloud; no stiff textbook prose.`,
    'Rules for every line you write:',
    '- Each request names ONE character. Write only that character\'s next spoken words, in the first person, as dialogue: no name prefix, no narration, no stage directions, no quotation marks, no lists, no markdown, no emojis.',
    `- A line is a few sentences, at most about ${MAX_LINE_WORDS} words; a verdict, opening statement or diagnosis may run to about 140 words.`,
    '- Every character reacts to what was said before: addresses others by name, agrees, objects, asks, answers. Each stays in character and realistic for their profession, with concrete details (facts, sections of law, test names, numbers) where a real professional would use them. Give each person a distinct voice in how they talk.',
    '- Never write for two people in one request. Never repeat a line already said. No disclaimers inside the lines.',
  ].join('\n');
}

export function stageTurnPrompt(name: string, role: string, cue: string, newLines: TranscriptLine[], full: boolean, allLines: TranscriptLine[]): string {
  const parts: string[] = [];
  if (full && allLines.length) {
    parts.push('[What has been said in the room so far]', allLines.map((l) => `${l.name}: ${l.text}`).join('\n'));
  } else if (newLines.length) {
    parts.push('[Just said in the room]', newLines.map((l) => `${l.name}: ${l.text}`).join('\n'));
  }
  parts.push(`[Director's cue] ${name} (${role}) speaks next: ${cue}`, `Write ${name}'s spoken line now.`);
  return parts.join('\n');
}

/** The lines since a speaker last heard the room, plus the cue for their turn. */
export function turnPrompt(lines: TranscriptLine[], cue: string, self: string, first: boolean): string {
  const heard = lines.length
    ? lines.map((l) => `${l.name}: ${l.text}`).join('\n')
    : '(nothing has been said yet)';
  return [
    first ? '[What has been said in the room so far]' : '[Said in the room since your last turn]',
    heard,
    `[Director's cue to you, ${self}] ${cue}`,
    'Speak your turn now, in character, as dialogue only.',
  ].join('\n');
}

export function morePrompt(plan: CouncilPlan, lines: TranscriptLine[], count: number): string {
  return [
    'The discussion so far:',
    lines.map((l) => `${l.name}: ${l.text}`).join('\n'),
    `The user wants the discussion to continue. Plan ${count} more turns that move it forward (new angles, questions, replies), ending with an updated decision by ${decisionName(plan)} and a short close by "${DIRECTOR_ID}". Nobody speaks twice in a row.`,
    `Speakers must be one of: ${plan.cast.map((c) => `"${c.name}"`).join(', ')}, or "${DIRECTOR_ID}".`,
    'Answer with exactly this JSON: {"turns": [{"speaker": string, "cue": string}]}',
  ].join('\n');
}

export function replyPrompt(plan: CouncilPlan, lines: TranscriptLine[], userName: string, said: string, remaining: PlannedTurn[]): string {
  return [
    'The discussion so far (most recent last):',
    lines.slice(-14).map((l) => `${l.name}: ${l.text}`).join('\n'),
    `${userName} has just spoken up in the room: """${said}"""`,
    `Decide who should answer, and how: one or two turns, each {"speaker", "cue"}. If a question is for a particular person, that person answers; if it is for the room, the director ("${DIRECTOR_ID}") may answer or hand it to the right person. The cue must tell the speaker to answer ${userName} directly.`,
    remaining.length ? `After that, the planned order continues (next planned speaker: ${remaining[0].speaker}).` : 'The planned turns are finished; after this the room waits.',
    `Speakers must be one of: ${plan.cast.map((c) => `"${c.name}"`).join(', ')}, or "${DIRECTOR_ID}".`,
    'Answer with exactly this JSON: {"turns": [{"speaker": string, "cue": string}]}',
  ].join('\n');
}

export function decisionPrompt(plan: CouncilPlan, lines: TranscriptLine[], language: string): string {
  return [
    'The full discussion:',
    lines.map((l) => `${l.name}: ${l.text}`).join('\n'),
    `Write the record of this room in ${language}: a two-sentence summary of what happened, the decision or outcome in one or two sentences (as given by ${decisionName(plan)}), three to six key points that were made, and two to four next steps or lessons for the user.`,
    'Answer with exactly this JSON: {"summary": string, "decision": string, "keyPoints": [string], "nextSteps": [string]}',
  ].join('\n');
}

export function decisionName(plan: CouncilPlan): string {
  const m = plan.cast.find((c) => c.id === plan.decisionBy);
  return m ? m.name : 'the director';
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

/** Finds the JSON object in a model reply that may be wrapped in fences or prose. */
export function extractJson(text: string): any {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The director did not answer with a plan.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

const clean = (v: unknown, max = 300) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

const slug = (name: string, i: number) => `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'agent'}-${i + 1}`;

/** Turns the director's cast JSON into a validated plan: distinct voices, seats, ids, and turns that name real speakers. */
export function parsePlan(raw: any, s: CouncilScenario, id: DirectorIdentity): CouncilPlan {
  const castRaw: any[] = Array.isArray(raw?.cast) ? raw.cast : [];
  if (castRaw.length === 0) throw new Error('The director cast nobody.');
  const members = castRaw.slice(0, s.agentCount).map((c, i) => ({
    name: clean(c?.name, 60) || `Agent ${i + 1}`,
    role: clean(c?.role, 80) || s.roles[i] || 'Participant',
    goal: clean(c?.goal, 240) || 'Take part in the discussion with your expertise.',
    style: clean(c?.style, 160) || 'Measured and professional.',
    voice: clean(c?.voice, 30),
    gender: (c?.gender === 'male' ? 'male' : 'female') as 'female' | 'male',
  }));
  // Top up if the director returned too few.
  while (members.length < s.agentCount) {
    const i = members.length;
    members.push({ name: `Agent ${i + 1}`, role: s.roles[i] || 'Participant', goal: 'Take part in the discussion with your expertise.', style: 'Measured and professional.', voice: '', gender: i % 2 ? 'male' : 'female' });
  }

  // Voices: each distinct, never the director's, matched to the gender where possible.
  const used = new Set<string>([id.voice]);
  const pick = (want: string, gender: 'female' | 'male') => {
    const ok = (v: string) => !used.has(v) && VOICES.some((x) => x.id === v);
    let v = ok(want) ? want : '';
    if (!v) v = VOICES.find((x) => x.gender === gender && !used.has(x.id))?.id ?? '';
    if (!v) v = VOICES.find((x) => !used.has(x.id))?.id ?? VOICES[0].id;
    used.add(v);
    return v;
  };
  const seats = seatsFor(members.length);
  const cast: CastMember[] = members.map((m, i) => {
    const voice = pick(m.voice, m.gender);
    const gender = VOICES.find((v) => v.id === voice)?.gender ?? m.gender;
    return { id: slug(m.name, i), name: m.name, role: m.role, goal: m.goal, style: m.style, voice, gender, seat: seats[i] };
  });

  const plan: CouncilPlan = {
    title: clean(raw?.title, 80) || 'Agent room',
    setting: clean(raw?.setting, 200) || s.scenario.slice(0, 120),
    cast,
    turns: [],
    decisionBy: null,
  };
  plan.decisionBy = resolveSpeaker(plan, raw?.decisionBy) ?? null;
  if (plan.decisionBy === DIRECTOR_ID) plan.decisionBy = null;
  plan.turns = parseTurns(plan, raw?.turns);
  if (plan.turns.length === 0) plan.turns = fallbackTurns(plan, s);
  return plan;
}

/** A speaker named in the JSON: by id, by name, by role, or the director. */
export function resolveSpeaker(plan: CouncilPlan, v: unknown): string | null {
  const t = clean(v, 80).toLowerCase();
  if (!t) return null;
  if (t === DIRECTOR_ID || t.includes('director') || t.includes('moderator') || t.includes('clerk')) return DIRECTOR_ID;
  const byId = plan.cast.find((c) => c.id === t);
  if (byId) return byId.id;
  const byName = plan.cast.find((c) => c.name.toLowerCase() === t);
  if (byName) return byName.id;
  const partial = plan.cast.find((c) => t.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(t) || c.role.toLowerCase() === t);
  if (partial) return partial.id;
  const first = plan.cast.find((c) => c.name.toLowerCase().split(' ')[0] === t.split(' ')[0]);
  return first ? first.id : null;
}

export function parseTurns(plan: CouncilPlan, raw: unknown, max = MAX_TURNS_PER_PLAN): PlannedTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: PlannedTurn[] = [];
  for (const t of raw) {
    const speaker = resolveSpeaker(plan, t?.speaker);
    if (!speaker) continue;
    if (out.length && out[out.length - 1].speaker === speaker) continue; // nobody twice in a row
    out.push({ speaker, cue: clean(t?.cue, 300) || 'Respond to what was just said.' });
    if (out.length >= max) break;
  }
  return out;
}

/** A sound order of turns when the director's list was unusable. */
function fallbackTurns(plan: CouncilPlan, s: CouncilScenario): PlannedTurn[] {
  const turns: PlannedTurn[] = [{ speaker: DIRECTOR_ID, cue: `Open the room as ${s.directorRole}: greet everyone, state the matter and who is present.` }];
  const decider = plan.decisionBy;
  const speakers = plan.cast.filter((c) => c.id !== decider);
  for (const c of speakers) turns.push({ speaker: c.id, cue: 'Give your opening position on the matter.' });
  if (decider) turns.push({ speaker: decider, cue: 'Ask the sharpest question each side must answer.' });
  for (const c of speakers) turns.push({ speaker: c.id, cue: 'Answer the question and reply to the other side.' });
  if (decider) turns.push({ speaker: decider, cue: 'Give your decision with reasons.' });
  turns.push({ speaker: DIRECTOR_ID, cue: 'Thank everyone and close the room in one or two sentences.' });
  return turns;
}

export function parseDecision(raw: any): Decision {
  const list = (v: unknown, max: number) => (Array.isArray(v) ? v.map((x) => clean(x, 240)).filter(Boolean).slice(0, max) : []);
  return {
    summary: clean(raw?.summary, 600) || 'The room discussed the matter.',
    decision: clean(raw?.decision, 600) || 'No single decision was recorded.',
    keyPoints: list(raw?.keyPoints, 6),
    nextSteps: list(raw?.nextSteps, 4),
  };
}

// ─── Director actions ────────────────────────────────────────────────────────

export async function planCouncil(session: LiveSession, s: CouncilScenario, id: DirectorIdentity): Promise<CouncilPlan> {
  const prompt = castPrompt(id, s);
  const reply = await session.generate({ incremental: prompt, full: prompt }, 90_000);
  return parsePlan(extractJson(reply.text), s, id);
}

export async function planMore(session: LiveSession, plan: CouncilPlan, lines: TranscriptLine[]): Promise<PlannedTurn[]> {
  const prompt = morePrompt(plan, lines, MORE_TURNS);
  const reply = await session.generate({ incremental: prompt, full: prompt }, 60_000);
  const turns = parseTurns(plan, extractJson(reply.text)?.turns, MORE_TURNS + 2);
  return turns.length ? turns : fallbackMore(plan);
}

function fallbackMore(plan: CouncilPlan): PlannedTurn[] {
  const turns: PlannedTurn[] = plan.cast.filter((c) => c.id !== plan.decisionBy).map((c) => ({ speaker: c.id, cue: 'Add one new point or answer the last objection.' }));
  if (plan.decisionBy) turns.push({ speaker: plan.decisionBy, cue: 'Give your updated decision with reasons.' });
  turns.push({ speaker: DIRECTOR_ID, cue: 'Close the room in one or two sentences.' });
  return turns;
}

export async function planReply(session: LiveSession, plan: CouncilPlan, lines: TranscriptLine[], id: DirectorIdentity, said: string, remaining: PlannedTurn[]): Promise<PlannedTurn[]> {
  const prompt = replyPrompt(plan, lines, id.userName, said, remaining);
  try {
    const reply = await session.generate({ incremental: prompt, full: prompt }, 45_000);
    const turns = parseTurns(plan, extractJson(reply.text)?.turns, 2);
    if (turns.length) return turns;
  } catch {
    /* the director answers in person below */
  }
  return [{ speaker: DIRECTOR_ID, cue: `Answer ${id.userName} directly, then hand back to the discussion.` }];
}

export async function writeDecision(session: LiveSession, plan: CouncilPlan, lines: TranscriptLine[], language: string): Promise<Decision> {
  const prompt = decisionPrompt(plan, lines, language);
  const reply = await session.generate({ incremental: prompt, full: prompt }, 60_000);
  return parseDecision(extractJson(reply.text));
}

export { DIRECTOR_ID, DIRECTOR_SEAT, USER_ID };
