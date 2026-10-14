/**
 * Matching a name the user SAID against names that are WRITTEN DOWN: contacts and app names.
 *
 * Speech recognition writes what it hears in whatever script it detects. Say "Rahul" inside a Hindi
 * sentence and it comes back as "राहुल"; in Kannada, "ರಾಹುಲ್". The phone's contacts, on the other hand,
 * are mostly saved in Latin letters ("Rahul", "Mummy"). A plain text search can never join the two, which is
 * why the assistant kept saying "no contact found, please tell me the number".
 *
 * So both sides are reduced to a rough pronunciation first:
 *   fine key   - Latin letters with spelling variants folded (ph/f, w/v, ee/i, ...), vowels kept
 *   coarse key - the same without vowels and with similar sounds merged (g/k, d/t, b/p/f, s/j/ch)
 * and compared by those. Pure code (no React Native), so it runs under plain
 * `node --experimental-strip-types` (see scripts/nameMatch.selfcheck.ts).
 */

// ─── Indic scripts → rough Latin ─────────────────────────────────────────────

// All the Indic scripts descend from one layout, so a letter sits at the same offset inside every script's
// 128-code-point block (Devanagari 0900, Bengali 0980, Gurmukhi 0A00, Gujarati 0A80, Odia 0B00, Tamil 0B80,
// Telugu 0C00, Kannada 0C80, Malayalam 0D00). One table therefore covers all nine.
const BLOCK_FIRST = 0x0900;
const BLOCK_LAST = 0x0d7f;

/** Offsets 0x15..0x39: the consonants, as a bare sound without a vowel. */
const CONSONANTS = [
  'k', 'kh', 'g', 'gh', 'n', 'ch', 'chh', 'j', 'jh', 'n', 't', 'th', 'd', 'dh', 'n', 't', 'th', 'd', 'dh', 'n', 'n',
  'p', 'ph', 'b', 'bh', 'm', 'y', 'r', 'r', 'l', 'l', 'l', 'v', 'sh', 'sh', 's', 'h',
];
/** Offsets 0x05..0x14: independent vowels. */
const VOWELS = ['a', 'aa', 'i', 'ii', 'u', 'uu', 'ri', 'li', 'e', 'e', 'e', 'ai', 'o', 'o', 'o', 'au'];
/** Offsets 0x3E..0x4C: vowel signs written after a consonant. */
const VOWEL_SIGNS = ['aa', 'i', 'ii', 'u', 'uu', 'ri', 'ri', 'e', 'e', 'e', 'ai', 'o', 'o', 'o', 'au'];

const NUKTA = 0x3c;
const VIRAMA = 0x4d;
/** Scripts that drop the inherent "a" at the end of a word (Hindi writes राहुल, says "rahul"). */
const DROPS_FINAL_A = new Set([0x0900, 0x0980, 0x0a00, 0x0a80, 0x0b00]);

/** Letters outside the shared layout. */
const SPECIAL: Record<number, string> = {
  0x0958: 'k', 0x0959: 'kh', 0x095a: 'g', 0x095b: 'j', 0x095c: 'r', 0x095d: 'rh', 0x095e: 'f', 0x095f: 'y',
  0x09dc: 'r', 0x09dd: 'rh', 0x09df: 'y', 0x09ce: 't',
  0x0b5c: 'r', 0x0b5d: 'rh', 0x0b5f: 'y',
  0x0a70: '~',
  0x0d7a: 'n', 0x0d7b: 'n', 0x0d7c: 'r', 0x0d7d: 'l', 0x0d7e: 'l', 0x0d7f: 'k',
  0x0cde: 'l',
  0x0b83: '',
};

const isIndic = (cp: number | undefined) => cp !== undefined && cp >= BLOCK_FIRST && cp <= BLOCK_LAST;

/** Indic digits (०-९, ೦-೯ ...) to 0-9, or -1 if the character is not one. */
export function indicDigitValue(cp: number): number {
  if (!isIndic(cp)) return -1;
  const off = cp & 0x7f;
  return off >= 0x66 && off <= 0x6f ? off - 0x66 : -1;
}

/** A rough Latin spelling of any text: Indic scripts are transliterated, Latin accents are stripped. */
export function toLatin(text: string): string {
  const chars = Array.from(text.normalize('NFC').toLowerCase());
  const cps = chars.map((c) => c.codePointAt(0)!);
  let out = '';

  for (let i = 0; i < chars.length; i++) {
    const cp = cps[i];
    if (cp < 0x80) {
      out += /[a-z0-9]/.test(chars[i]) ? chars[i] : ' ';
      continue;
    }
    if (cp < 0x250) {
      const plain = chars[i].normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      out += /^[a-z]+$/.test(plain) ? plain : ' ';
      continue;
    }
    if (!isIndic(cp)) {
      out += ' ';
      continue;
    }

    const base = cp & ~0x7f;
    const off = cp & 0x7f;
    const digit = indicDigitValue(cp);
    if (digit >= 0) {
      out += String(digit);
      continue;
    }
    if (SPECIAL[cp] !== undefined) {
      out += SPECIAL[cp];
      continue;
    }
    if (off === 0x01 || off === 0x02) {
      out += '~'; // nasal, resolved below once the next letter is known
      continue;
    }
    if (off === 0x03) {
      out += 'h';
      continue;
    }
    if (off >= 0x05 && off <= 0x14) {
      out += VOWELS[off - 0x05];
      continue;
    }
    if (off >= 0x15 && off <= 0x39) {
      out += CONSONANTS[off - 0x15];
      let next = cps[i + 1];
      if (next === base + NUKTA) {
        i++;
        next = cps[i + 1];
      }
      const nextOff = next !== undefined && isIndic(next) && (next & ~0x7f) === base ? next & 0x7f : -1;
      if (nextOff >= 0x3e && nextOff <= 0x4c) {
        out += VOWEL_SIGNS[nextOff - 0x3e];
        i++;
      } else if (nextOff === VIRAMA) {
        i++; // consonant cluster: no vowel
      } else {
        const wordEnds = next === undefined || !isIndic(next);
        if (!(wordEnds && DROPS_FINAL_A.has(base))) out += 'a';
      }
    }
    // Anything else in the block (vowel signs on their own, the avagraha...) carries no sound we need.
  }

  // A nasal is "m" before p/b/m (अंबिका = Ambika) and "n" everywhere else (संदीप = Sandeep).
  return out.replace(/~(?=[pbm])/g, 'm').replace(/~/g, 'n');
}

// ─── Pronunciation keys ──────────────────────────────────────────────────────

function fineWord(w: string): string {
  return w
    .replace(/ck/g, 'k')
    .replace(/q/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/w/g, 'v')
    .replace(/z/g, 'j')
    .replace(/chh/g, 'ch')
    .replace(/ph/g, 'f')
    .replace(/(b|d|g|k|t|j)h/g, '$1')
    .replace(/([^aeiouy])yu/g, '$1u')
    .replace(/c(?!h)(?=[eiy])/g, 's')
    .replace(/c(?!h)/g, 'k')
    .replace(/sh/g, 's')
    .replace(/ee|ii/g, 'i')
    .replace(/oo|uu|ou/g, 'u')
    .replace(/aa/g, 'a')
    .replace(/ai/g, 'e')
    .replace(/au/g, 'o')
    .replace(/ay(?=[^aeiou]|$)/g, 'e')
    .replace(/y$/, 'i')
    .replace(/(.)\1+/g, '$1')
    .replace(/(?<=.)h$/, '');
}

/** Spelling-insensitive form of a name: "Rahul", "राहुल" and "ರಾಹುಲ್" all give "rahul". */
const fineCache = new Map<string, string>();
export function fineKey(text: string): string {
  const hit = fineCache.get(text);
  if (hit !== undefined) return hit;
  const key = toLatin(text).split(/[^a-z0-9]+/).filter(Boolean).map(fineWord).join(' ');
  // Matching a spoken name against hundreds of installed apps repeats the same keys: remember them.
  if (fineCache.size > 5000) fineCache.clear();
  fineCache.set(text, key);
  return key;
}

function coarseWord(fine: string): string {
  const c = fine
    .replace(/[aeiou]/g, '')
    .replace(/ch/g, 'c')
    .replace(/[sj]/g, 'c')
    .replace(/g/g, 'k')
    .replace(/d/g, 't')
    .replace(/[bf]/g, 'p')
    .replace(/(.)\1+/g, '$1');
  return c || fine;
}

/** Consonant skeleton of a name: vowels and voicing differences are ignored. */
export function coarseKey(text: string): string {
  return fineKey(text).split(' ').filter(Boolean).map(coarseWord).join(' ');
}

/** Latin, lower case, no accents or punctuation: what plain text search would compare. */
const plainCache = new Map<string, string>();
export function plain(text: string): string {
  const hit = plainCache.get(text);
  if (hit !== undefined) return hit;
  const out = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();
  if (plainCache.size > 5000) plainCache.clear();
  plainCache.set(text, out);
  return out;
}

function editDistance(a: string, b: string, limit = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > limit) return limit + 1;
    prev = cur;
  }
  return prev[b.length];
}

// ─── Words that should not decide a match ────────────────────────────────────

/** Titles and filler around a name: "Dr Sharma clinic", "Rahul bhai", "Anita ji". */
const GENERIC_WORDS = new Set(
  [
    'mr', 'mrs', 'ms', 'miss', 'dr', 'doctor', 'shri', 'shree', 'smt', 'sri', 'ji', 'sir', 'madam', 'mam', 'maam',
    'uncle', 'aunty', 'auntie', 'aunt', 'the', 'my', 'call', 'phone', 'number', 'mobile', 'clinic', 'hospital',
    'shop', 'store', 'office', 'home', 'house', 'bhai', 'bhaiya', 'bhaiyya', 'sahab', 'saheb', 'sahib', 'and',
  ].map((w) => fineWord(w)),
);

/**
 * Family words that people spell a dozen ways ("Mummy", "Mom", "Amma", "अम्मा" ...). All the words of one family
 * count as the same name, so "call amma" finds the contact saved as "Mummy".
 */
const RELATIONS: Record<string, string[]> = {
  mother: ['mom', 'mummy', 'mommy', 'mama', 'mother', 'maa', 'ma', 'amma', 'ammi', 'aai', 'mata', 'mumma', 'mum', 'ammaji'],
  father: ['papa', 'pappa', 'dad', 'daddy', 'father', 'baba', 'appa', 'abba', 'pita', 'pitaji', 'babuji', 'bapu'],
  brother: ['bro', 'brother', 'anna', 'annayya', 'bhai', 'bhaiya', 'bhaiyya'],
  sister: ['didi', 'behen', 'behan', 'bahen', 'bahan', 'sister', 'sis', 'akka', 'akki'],
  husband: ['husband', 'pati'],
  wife: ['wife', 'biwi', 'bivi', 'patni'],
  grandfather: ['dada', 'dadaji', 'nana', 'nanaji', 'thatha', 'tatha', 'ajja'],
  grandmother: ['dadi', 'nani', 'ajji', 'paati', 'patti', 'aaji'],
};

const RELATION_OF = new Map<string, string>();
for (const [group, words] of Object.entries(RELATIONS)) {
  for (const w of words) RELATION_OF.set(fineWord(w), `rel:${group}`);
}

interface Token {
  fine: string;
  coarse: string;
  generic: boolean;
}

function tokens(text: string): Token[] {
  return fineKey(text)
    .split(' ')
    .filter(Boolean)
    .map((fine) => {
      const rel = RELATION_OF.get(fine);
      return rel
        ? { fine: rel, coarse: rel, generic: false }
        : { fine, coarse: coarseWord(fine), generic: GENERIC_WORDS.has(fine) };
    });
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

/** How well one spoken word matches one written word, 0..1. */
function wordScore(q: Token, n: Token, strict = false): number {
  if (q.fine === n.fine) return 1;
  if (q.coarse === n.coarse) return 0.95;
  // One consonant off. In a short name it must be an inner one (Tamil writes Rahul as "Ragul"), otherwise
  // "Rahul" and "Rohit" would count as the same person.
  const a = q.coarse;
  const b = n.coarse;
  // Strict matching (app names) accepts only a whole-word match or the same sound, never "one letter off" or "part of a word":
  // "zorblax" is not Roblox. (The assistant offers close names back to the model instead.)
  if (strict) return 0;
  if (a.length >= 6 && editDistance(a, b, 1) <= 1) return 0.85;
  if (
    Math.min(a.length, b.length) >= 3 &&
    a[0] === b[0] &&
    a[a.length - 1] === b[b.length - 1] &&
    editDistance(a, b, 1) <= 1
  ) {
    return 0.7;
  }
  if (q.coarse.length >= 3 && n.coarse.startsWith(q.coarse)) return 0.6;
  if (q.coarse.length >= 3 && n.coarse.includes(q.coarse)) return 0.5;
  return 0;
}

/**
 * 0 = no match, otherwise higher is better:
 *   100 same letters · 90 every spoken word is a whole word of the name · 80 text inside the name
 *   up to 89 sounds like the whole name, up to 79 like part of it (spelling, script and voicing differences ignored)
 */
export function scoreName(spoken: string, written: string, opts: { strict?: boolean } = {}): number {
  const sp = plain(spoken);
  const wr = plain(written);
  if (!sp || !wr) return 0;
  if (sp === wr) return 100;
  const wrWords = wr.split(' ');
  if (sp.split(' ').every((w) => wrWords.includes(w))) return 90;
  if (!opts.strict && sp.length >= 3 && wr.includes(sp)) return 80;

  let q = tokens(spoken);
  if (!q.length) return 0;
  const specific = q.filter((t) => !t.generic);
  if (specific.length) q = specific; // "Dr Sharma clinic" is looked up as "sharma"
  const n = tokens(written);
  if (!n.length) return 0;

  let total = 0;
  for (const word of q) {
    let best = 0;
    for (const cand of n) best = Math.max(best, wordScore(word, cand, opts.strict));
    if (best === 0) return 0; // every word that was said has to be found
    total += best;
  }
  // Sounding like the WHOLE name ("Rahul" said in Kannada vs the contact "Rahul") beats sounding like part of a
  // longer one ("Rahul Sharma"), the same way an exact Latin match does.
  const wholeName = n.length === q.length;
  return Math.round((wholeName ? 50 : 40) + 39 * (total / q.length));
}

export interface NameMatch<T> {
  item: T;
  score: number;
}

/** Items whose names match `spoken`, best first. Each item may have several names (display name, nickname...). */
export function rankNames<T>(
  spoken: string,
  items: T[],
  namesOf: (item: T) => string[],
  minScore = 50,
  opts: { strict?: boolean } = {},
): NameMatch<T>[] {
  const out: (NameMatch<T> & { len: number })[] = [];
  for (const item of items) {
    let score = 0;
    let len = 0;
    for (const name of namesOf(item)) {
      const s = scoreName(spoken, name, opts);
      if (s > score || (s === score && s > 0 && name.length < len)) {
        score = s;
        len = name.length;
      }
    }
    if (score >= minScore) out.push({ item, score, len });
  }
  out.sort((a, b) => b.score - a.score || a.len - b.len);
  return out.map(({ item, score }) => ({ item, score }));
}

// ─── Picking a contact ───────────────────────────────────────────────────────

export interface PickableContact {
  name: string;
  nickname?: string;
  numbers: { number: string; mobile: boolean }[];
}

/**
 * The contacts a spoken name refers to, with the number to dial for each. Normally one; two or more when the
 * name really is ambiguous (two different Rahuls), so the assistant can ask which. An exact "Rahul" beats
 * "Rahul Verma" on its own, and a person saved twice with the same number is listed once.
 */
export function pickContacts(spoken: string, contacts: PickableContact[]): { name: string; number: string }[] {
  const ranked = rankNames(spoken, contacts, (c) => [c.name, ...(c.nickname ? [c.nickname] : [])]);
  if (!ranked.length) return [];
  const top = ranked[0].score;
  const margin = top >= 85 ? 5 : 12;
  const out: { name: string; number: string }[] = [];
  const seen = new Set<string>();
  for (const { item, score } of ranked) {
    if (score < top - margin || out.length >= 5) break;
    const chosen = item.numbers.find((n) => n.mobile) ?? item.numbers[0];
    if (seen.has(chosen.number)) continue;
    seen.add(chosen.number);
    out.push({ name: item.name, number: chosen.number });
  }
  return out;
}
