import IdentifyLanguages from '@react-native-ml-kit/identify-languages';
import TextRecognition, { TextRecognitionScript, type TextBlock } from '@react-native-ml-kit/text-recognition';
import TranslateText, { TranslateLanguage } from '@react-native-ml-kit/translate-text';

/**
 * Lens-style translation, all on the phone with Google's ML Kit: text recognition reads the picture, language
 * identification guesses what it is, and the translator turns each block into the chosen language. Nothing is sent
 * anywhere; the only network use is the one-time download of a language pack (about 30 MB per language).
 *
 * ML Kit reads Latin, Devanagari, Chinese, Japanese and Korean scripts, so those are the languages it can read
 * from a picture. It translates into many more (Kannada, Tamil, Telugu, Gujarati, Bengali, Urdu and so on).
 */
export type LangCode = TranslateLanguage;

export interface Lang { code: LangCode; name: string; script: TextRecognitionScript }

/** Languages the camera can read: each one's OCR script is a model ML Kit ships. */
export const SOURCE_LANGS: Lang[] = [
  { code: TranslateLanguage.ENGLISH, name: 'English', script: TextRecognitionScript.LATIN },
  { code: TranslateLanguage.HINDI, name: 'Hindi', script: TextRecognitionScript.DEVANAGARI },
  { code: TranslateLanguage.MARATHI, name: 'Marathi', script: TextRecognitionScript.DEVANAGARI },
  { code: TranslateLanguage.SPANISH, name: 'Spanish', script: TextRecognitionScript.LATIN },
  { code: TranslateLanguage.FRENCH, name: 'French', script: TextRecognitionScript.LATIN },
  { code: TranslateLanguage.GERMAN, name: 'German', script: TextRecognitionScript.LATIN },
  { code: TranslateLanguage.PORTUGUESE, name: 'Portuguese', script: TextRecognitionScript.LATIN },
  { code: TranslateLanguage.ITALIAN, name: 'Italian', script: TextRecognitionScript.LATIN },
  { code: TranslateLanguage.INDONESIAN, name: 'Indonesian', script: TextRecognitionScript.LATIN },
  { code: TranslateLanguage.MALAY, name: 'Malay', script: TextRecognitionScript.LATIN },
  { code: TranslateLanguage.DUTCH, name: 'Dutch', script: TextRecognitionScript.LATIN },
  { code: TranslateLanguage.TURKISH, name: 'Turkish', script: TextRecognitionScript.LATIN },
  { code: TranslateLanguage.VIETNAMESE, name: 'Vietnamese', script: TextRecognitionScript.LATIN },
  { code: TranslateLanguage.CHINESE, name: 'Chinese', script: TextRecognitionScript.CHINESE },
  { code: TranslateLanguage.JAPANESE, name: 'Japanese', script: TextRecognitionScript.JAPANESE },
  { code: TranslateLanguage.KOREAN, name: 'Korean', script: TextRecognitionScript.KOREAN },
];

/** Languages to translate into. */
export const TARGET_LANGS: { code: LangCode; name: string }[] = [
  { code: TranslateLanguage.ENGLISH, name: 'English' },
  { code: TranslateLanguage.HINDI, name: 'Hindi' },
  { code: TranslateLanguage.KANNADA, name: 'Kannada' },
  { code: TranslateLanguage.TAMIL, name: 'Tamil' },
  { code: TranslateLanguage.TELUGU, name: 'Telugu' },
  { code: TranslateLanguage.MARATHI, name: 'Marathi' },
  { code: TranslateLanguage.GUJARATI, name: 'Gujarati' },
  { code: TranslateLanguage.BENGALI, name: 'Bengali' },
  { code: TranslateLanguage.URDU, name: 'Urdu' },
  { code: TranslateLanguage.SPANISH, name: 'Spanish' },
  { code: TranslateLanguage.FRENCH, name: 'French' },
  { code: TranslateLanguage.GERMAN, name: 'German' },
  { code: TranslateLanguage.PORTUGUESE, name: 'Portuguese' },
  { code: TranslateLanguage.ARABIC, name: 'Arabic' },
  { code: TranslateLanguage.CHINESE, name: 'Chinese' },
  { code: TranslateLanguage.JAPANESE, name: 'Japanese' },
  { code: TranslateLanguage.KOREAN, name: 'Korean' },
  { code: TranslateLanguage.RUSSIAN, name: 'Russian' },
];

export const AUTO = 'auto';
export type SourceChoice = LangCode | typeof AUTO;

export function langName(code: SourceChoice): string {
  if (code === AUTO) return 'Auto';
  return SOURCE_LANGS.find((l) => l.code === code)?.name ?? TARGET_LANGS.find((l) => l.code === code)?.name ?? code;
}

export function scriptFor(code: SourceChoice): TextRecognitionScript {
  if (code === AUTO) return TextRecognitionScript.LATIN;
  return SOURCE_LANGS.find((l) => l.code === code)?.script ?? TextRecognitionScript.LATIN;
}

const LATIN_SOURCES = new Set(SOURCE_LANGS.filter((l) => l.script === TextRecognitionScript.LATIN).map((l) => l.code as string));

/** What language the recognised text is, limited to ones the Latin reader can have produced; English when unsure. */
export async function guessLanguage(text: string): Promise<LangCode> {
  const sample = text.replace(/\s+/g, ' ').trim().slice(0, 400);
  if (sample.length < 3) return TranslateLanguage.ENGLISH;
  try {
    const code = (await IdentifyLanguages.identify(sample)).toLowerCase().split('-')[0];
    if (LATIN_SOURCES.has(code)) return code as LangCode;
  } catch {
    // fall through
  }
  return TranslateLanguage.ENGLISH;
}

export interface ReadBlock { text: string; frame: { left: number; top: number; width: number; height: number }; lines: number }

/** Read the text in a picture (a file URI) as blocks with their boxes in picture pixels. */
export async function readText(uri: string, source: SourceChoice): Promise<{ text: string; blocks: ReadBlock[] }> {
  const res = await TextRecognition.recognize(uri, scriptFor(source));
  const blocks = res.blocks
    .filter((b: TextBlock) => b.frame && b.text.trim().length > 0)
    .map((b: TextBlock) => ({ text: b.text.replace(/\s*\n\s*/g, ' ').trim(), frame: b.frame!, lines: Math.max(1, b.lines.length) }));
  return { text: res.text, blocks };
}

const cache = new Map<string, string>();

/** Translate one piece of text, remembering results so a steady camera does not translate the same sign twice. */
export async function translate(text: string, from: LangCode, to: LangCode): Promise<string> {
  const clean = text.trim();
  if (!clean) return '';
  if (from === to) return clean;
  const key = `${from}>${to}:${clean}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const out = (await TranslateText.translate({ text: clean, sourceLanguage: from, targetLanguage: to, downloadModelIfNeeded: true })) as unknown as string;
  const value = typeof out === 'string' ? out : String(out ?? '');
  if (cache.size > 400) cache.clear();
  cache.set(key, value);
  return value;
}

/** Fetch a language pair's packs ahead of time (no-op once they are on the phone). */
export async function warmUp(from: LangCode, to: LangCode): Promise<void> {
  if (from === to) return;
  await TranslateText.translate({ text: 'hello', sourceLanguage: from, targetLanguage: to, downloadModelIfNeeded: true });
}
