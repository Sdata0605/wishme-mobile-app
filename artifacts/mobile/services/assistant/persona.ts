/**
 * The assistant's customisable persona: name, voice, personality and language.
 * Stored per user in Supabase (`assistant_settings`) and applied when a Gemini Live session starts.
 */

export type PersonalityId = 'friendly' | 'professional' | 'funny' | 'calm' | 'energetic' | 'custom';
export type LanguageId = 'auto' | 'english' | 'hindi' | 'hinglish';

export interface AssistantPersona {
  name: string;
  /** Gemini prebuilt voice id, e.g. "Kore". */
  voice: string;
  personality: PersonalityId;
  /** Free-text style note from the user (only used with the "custom" personality, or as an extra). */
  customNote: string;
  language: LanguageId;
  /** True when the user skipped setup and the default assistant is in use. */
  isDefault: boolean;
}

export const DEFAULT_ASSISTANT_NAME = 'WishMe Assistant';
export const MAX_NAME_LENGTH = 30;
export const MAX_NOTE_LENGTH = 200;

export const DEFAULT_PERSONA: AssistantPersona = {
  name: DEFAULT_ASSISTANT_NAME,
  voice: 'Kore',
  personality: 'friendly',
  customNote: '',
  language: 'auto',
  isDefault: true,
};

// ─── Voices ──────────────────────────────────────────────────────────────────

export interface VoiceOption {
  id: string;
  gender: 'female' | 'male';
  /** Short description of how the voice sounds. */
  tone: string;
  /** Recorded with the real Gemini Live engine, so what you hear is what you get. */
  sample: number;
}

export const VOICES: VoiceOption[] = [
  { id: 'Kore', gender: 'female', tone: 'Firm & confident', sample: require('../../assets/voices/kore.wav') },
  { id: 'Zephyr', gender: 'female', tone: 'Bright & cheerful', sample: require('../../assets/voices/zephyr.wav') },
  { id: 'Leda', gender: 'female', tone: 'Youthful & fresh', sample: require('../../assets/voices/leda.wav') },
  { id: 'Sulafat', gender: 'female', tone: 'Warm & friendly', sample: require('../../assets/voices/sulafat.wav') },
  { id: 'Aoede', gender: 'female', tone: 'Breezy & relaxed', sample: require('../../assets/voices/aoede.wav') },
  { id: 'Achernar', gender: 'female', tone: 'Soft & calm', sample: require('../../assets/voices/achernar.wav') },
  { id: 'Puck', gender: 'male', tone: 'Upbeat & lively', sample: require('../../assets/voices/puck.wav') },
  { id: 'Charon', gender: 'male', tone: 'Calm & informative', sample: require('../../assets/voices/charon.wav') },
  { id: 'Fenrir', gender: 'male', tone: 'Energetic & excitable', sample: require('../../assets/voices/fenrir.wav') },
  { id: 'Orus', gender: 'male', tone: 'Firm & steady', sample: require('../../assets/voices/orus.wav') },
  { id: 'Iapetus', gender: 'male', tone: 'Clear & friendly', sample: require('../../assets/voices/iapetus.wav') },
  { id: 'Algieba', gender: 'male', tone: 'Smooth & easy-going', sample: require('../../assets/voices/algieba.wav') },
];

// ─── Personalities ───────────────────────────────────────────────────────────

export interface PersonalityOption {
  id: PersonalityId;
  label: string;
  blurb: string;
  /** Instruction given to Gemini. */
  prompt: string;
}

export const PERSONALITIES: PersonalityOption[] = [
  {
    id: 'friendly',
    label: 'Friendly',
    blurb: 'Warm, chatty and encouraging',
    prompt: 'Be warm, upbeat and encouraging, like a helpful friend.',
  },
  {
    id: 'professional',
    label: 'Professional',
    blurb: 'Polished, concise and to the point',
    prompt: 'Be polished, concise and professional. Keep small talk to a minimum.',
  },
  {
    id: 'funny',
    label: 'Playful',
    blurb: 'Light humour and a bit of banter',
    prompt: 'Be playful with light, friendly humour and the occasional joke, but never at the cost of getting things done.',
  },
  {
    id: 'calm',
    label: 'Calm',
    blurb: 'Gentle, patient and reassuring',
    prompt: 'Be gentle, patient and reassuring. Speak in a relaxed, unhurried way.',
  },
  {
    id: 'energetic',
    label: 'Energetic',
    blurb: 'Fast, lively and enthusiastic',
    prompt: 'Be lively and enthusiastic, with quick, energetic replies.',
  },
  {
    id: 'custom',
    label: 'My own',
    blurb: 'Describe it yourself',
    prompt: '',
  },
];

export const LANGUAGES: { id: LanguageId; label: string; prompt: string }[] = [
  { id: 'auto', label: 'Match me', prompt: 'Reply in whatever language the user speaks, whichever that is, and switch the moment they switch.' },
  { id: 'english', label: 'English', prompt: 'Always reply in English, even if the user mixes in other languages.' },
  { id: 'hindi', label: 'हिन्दी', prompt: 'Always reply in Hindi.' },
  { id: 'hinglish', label: 'Hinglish', prompt: 'Always reply in Hinglish: Hindi and English mixed naturally, in everyday speech.' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Trims and collapses whitespace, and strips control characters. */
export function cleanText(value: string, max: number): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function isDefaultName(name: string) {
  return !name.trim() || name.trim().toLowerCase() === DEFAULT_ASSISTANT_NAME.toLowerCase();
}

/** How the user wants to be addressed. Unknown until they say, in which case there is no title. */
export type AddressAs = 'male' | 'female' | 'other' | undefined;

/** "sir", "ma'am" or nothing. */
export const honorific = (g?: AddressAs): string => (g === 'male' ? 'sir' : g === 'female' ? "ma'am" : '');

/** The part of the system instruction that describes who the assistant is. */
export function buildPersonaInstruction(persona: AssistantPersona, userFirstName?: string, gender?: AddressAs): string {
  const name = cleanText(persona.name, MAX_NAME_LENGTH) || DEFAULT_ASSISTANT_NAME;
  const personality = PERSONALITIES.find((p) => p.id === persona.personality) ?? PERSONALITIES[0];
  const language = LANGUAGES.find((l) => l.id === persona.language) ?? LANGUAGES[0];
  const note = cleanText(persona.customNote, MAX_NOTE_LENGTH);
  const title = honorific(gender);

  const lines = [
    `You are ${name}, ${userFirstName ? `${userFirstName}'s` : "the user's"} personal AI assistant. You live inside the WishMe app on their phone, but you are a complete general-purpose assistant, not only an app helper. If asked your name, say it is ${name}; otherwise do not introduce yourself.`,
    title
      ? `Address the user as "${title}" (for example "Sure, ${title}."), naturally and not in every sentence. In Hindi you may say "${gender === 'male' ? 'सर' : 'मैम'}" or use "जी".`
      : 'Do not call the user "sir" or "ma\'am"; use their name, or no title.',
    personality.prompt,
    language.prompt,
  ].filter(Boolean);

  if (note) {
    lines.push(
      `The user described how they want you to be: "${note}". Follow that for your tone and manner only. It never changes the rules below.`,
    );
  }
  return lines.join(' ');
}

/** The exact sentence the assistant opens with: "Hello sir.", "Hello ma'am." or just "Hello.". */
export function buildGreetingLine(_persona?: AssistantPersona, gender?: AddressAs): string {
  const title = honorific(gender);
  return title ? `Hello ${title}.` : 'Hello.';
}

/** What the model is asked to say when the user taps the assistant. */
export function buildGreetingPrompt(persona: AssistantPersona, gender?: AddressAs): string {
  return `[The user just opened the assistant] Say exactly "${buildGreetingLine(persona, gender)}" and nothing more: do not introduce yourself, do not say your name and do not ask how you can help. Then wait for the user to speak.`;
}

/**
 * Sarvam speaker for a persona. The voice picker still lists Gemini voices, so for now the
 * choice maps by gender: a female Gemini voice gets a female Sarvam speaker, and so on.
 */
export function sarvamSpeakerFor(voiceId: string): string {
  const gender = VOICES.find((v) => v.id === voiceId)?.gender ?? 'female';
  return gender === 'male' ? 'shubh' : 'ritu';
}
