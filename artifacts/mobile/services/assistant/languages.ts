/**
 * Languages the assistant can speak.
 *
 * The two engines are not equal here, and pretending otherwise would make the assistant promise
 * something it cannot do. Gemini speaks a wide range of world languages natively. Sarvam's voice
 * only covers Indian languages — so when the user asks for something it cannot say, the assistant
 * has to tell them rather than silently answering in the wrong language.
 */

/** Sarvam's text-to-speech voices, and nothing else. */
const SARVAM_VOICES: Record<string, string> = {
  english: 'en-IN',
  hindi: 'hi-IN',
  bengali: 'bn-IN',
  bangla: 'bn-IN',
  gujarati: 'gu-IN',
  kannada: 'kn-IN',
  malayalam: 'ml-IN',
  marathi: 'mr-IN',
  odia: 'od-IN',
  oriya: 'od-IN',
  punjabi: 'pa-IN',
  panjabi: 'pa-IN',
  tamil: 'ta-IN',
  telugu: 'te-IN',
};

/** What people actually say, including the name of a language in that language. */
const ALIASES: Record<string, string> = {
  angrezi: 'english',
  inglish: 'english',
  हिंदी: 'hindi',
  हिन्दी: 'hindi',
  hindustani: 'hindi',
  मराठी: 'marathi',
  marathi: 'marathi',
  বাংলা: 'bengali',
  தமிழ்: 'tamil',
  తెలుగు: 'telugu',
  ಕನ್ನಡ: 'kannada',
  മലയാളം: 'malayalam',
  ગુજરાતી: 'gujarati',
  ਪੰਜਾਬੀ: 'punjabi',
  urdu: 'urdu',
  // Hinglish is a way of speaking rather than a language of its own: it is Hindi with English words.
  hinglish: 'hinglish',
};

export interface LanguageRequest {
  /** Tidied name, e.g. "tamil". */
  key: string;
  /** How it should be named back to the user, e.g. "Tamil". */
  label: string;
  /** Sarvam voice code, when Sarvam can speak it. */
  sarvamCode: string | null;
}

/** Works out which language the user asked for. Free text: they may say anything. */
export function resolveLanguage(spoken: string): LanguageRequest | null {
  const raw = spoken.trim().toLowerCase().replace(/[.!?]+$/, '');
  if (!raw) return null;
  // "speak in Tamil please" → "tamil"
  const cleaned = raw
    .replace(/\b(speak|talk|reply|answer|respond|in|me|to|please|language|switch|change|now|from)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const key = ALIASES[cleaned] ?? ALIASES[raw] ?? cleaned ?? raw;
  if (!key) return null;
  return {
    key,
    label: key.charAt(0).toUpperCase() + key.slice(1),
    sarvamCode: SARVAM_VOICES[key === 'hinglish' ? 'hindi' : key] ?? null,
  };
}

/** Named in plain words for an apology the user can act on. */
export const SARVAM_LANGUAGE_NAMES = 'English, Hindi, Bengali, Gujarati, Kannada, Malayalam, Marathi, Odia, Punjabi, Tamil and Telugu';
