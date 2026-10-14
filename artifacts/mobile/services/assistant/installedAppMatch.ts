/**
 * Matching what the user said ("open ChatGPT", "चैट जीपीटी खोलो", "chat gpt app") against the apps that are REALLY on the
 * phone, plus the hand-written catalogue as a source of aliases (insta, gpay, WhatsApp Business...) and as the fallback
 * when the phone's list is not available (builds made before the native module existed).
 *
 * Pure code (no React Native): see scripts/installedApps.selfcheck.ts.
 */

import { APPS, LAUNCH_HINTS, cleanAppPhrase, type AppEntry } from './appCatalog';
import { coarseKey, plain, scoreName } from './nameMatch';

export interface LaunchableApp {
  label: string;
  packageName: string;
  activityName?: string;
}

export interface AppTarget {
  label: string;
  /** Everything it can be called, in Latin letters (other scripts are matched by sound). */
  names: string[];
  pkg?: string;
  activity?: string;
  /** A system app opened by what it does (camera, dialer...), whatever the brand. */
  intent?: { action: string; category?: string };
  /** True when this exact package was found on the phone. */
  installed: boolean;
  /** False when the same word is also a WishMe screen ("settings", "messages"): a voice shortcut must not guess. */
  quick: boolean;
}

export interface AppIndex {
  targets: AppTarget[];
  /** True when the phone's own list was available (so "not found" really means "not installed"). */
  hasInstalled: boolean;
  /** Letters-only form of every name, for an exact "chat gpt" = "ChatGPT" lookup. */
  bySquash: Map<string, AppTarget>;
}

export const squash = (s: string) => plain(s).replace(/\s+/g, '');
const soundKey = (s: string) => coarseKey(s).replace(/\s+/g, '');

const LETTER_NAMES: Record<string, string> = {
  A: 'ay', B: 'bee', C: 'see', D: 'dee', E: 'ee', F: 'eff', G: 'jee', H: 'aitch', I: 'eye', J: 'jay', K: 'kay', L: 'el', M: 'em',
  N: 'en', O: 'oh', P: 'pee', Q: 'queue', R: 'are', S: 'ess', T: 'tee', U: 'you', V: 'vee', W: 'double you', X: 'ex', Y: 'why', Z: 'zed',
};

/** "ChatGPT" read aloud the way people say it in India: "Chat jee pee tee". Same sound as "चैट जीपीटी". */
function spelled(label: string): string[] {
  if (!/[A-Z]{2,}(?![a-z])/.test(label)) return [];
  const out = label.replace(/[A-Z]{2,}(?![a-z])/g, (run) => ' ' + run.split('').map((c) => LETTER_NAMES[c] ?? c).join(' ') + ' ');
  return [out.replace(/\s+/g, ' ').trim()];
}

/** Builds the lookup. `installed` is null when the phone's list is not available. */
export function buildAppIndex(installed: LaunchableApp[] | null, catalogue: AppEntry[] = APPS): AppIndex {
  const targets: AppTarget[] = [];
  const byPkg = new Map<string, AppTarget[]>();

  for (const a of installed ?? []) {
    const t: AppTarget = {
      label: a.label,
      names: [a.label, ...spelled(a.label)],
      pkg: a.packageName,
      activity: a.activityName,
      installed: true,
      quick: true,
    };
    targets.push(t);
    const list = byPkg.get(a.packageName) ?? [];
    list.push(t);
    byPkg.set(a.packageName, list);
  }

  for (const entry of catalogue) {
    const pkgs = entry.pkg ? [entry.pkg, ...(LAUNCH_HINTS[entry.pkg]?.alts ?? [])] : [];
    const candidates = pkgs.flatMap((p) => byPkg.get(p) ?? []);
    if (candidates.length) {
      // The app is on the phone: the catalogue's names become aliases of the real entry.
      let best = candidates[0];
      let bestScore = -1;
      for (const c of candidates) {
        const s = scoreName(entry.label, c.label);
        if (s > bestScore) {
          bestScore = s;
          best = c;
        }
      }
      for (const n of [entry.label, ...entry.names]) if (!best.names.includes(n)) best.names.push(n);
      if (entry.quick === false) best.quick = false;
      continue;
    }
    targets.push({
      label: entry.label,
      names: [entry.label, ...entry.names],
      pkg: entry.pkg,
      activity: entry.pkg ? LAUNCH_HINTS[entry.pkg]?.activity : undefined,
      intent: entry.intent,
      installed: false,
      quick: entry.quick !== false,
    });
  }

  const bySquash = new Map<string, AppTarget>();
  // Installed apps first, so the real one wins a tie with a catalogue entry of the same name.
  for (const t of [...targets].sort((a, b) => Number(b.installed) - Number(a.installed))) {
    for (const n of t.names) {
      const k = squash(n);
      if (k && !bySquash.has(k)) bySquash.set(k, t);
    }
  }
  return { targets, hasInstalled: !!installed?.length, bySquash };
}

export interface AppMatch {
  target: AppTarget;
  score: number;
}

function scoreTarget(phrase: string, words: string[], t: AppTarget): number {
  const sq = squash(phrase);
  const sk = soundKey(phrase);
  let best = 0;
  for (const name of t.names) {
    let s = scoreName(phrase, name, { strict: true });
    if (squash(name) === sq) s = Math.max(s, 97); // "chat gpt" and "ChatGPT"
    else if (sk.length >= 3 && soundKey(name) === sk) s = Math.max(s, 85); // sounds the same, in any script
    best = Math.max(best, s);
  }
  // "perplexity ai": every word of a real app's name was said, plus one more word.
  if (t.installed && best < 78) {
    const labelWords = plain(t.label).split(' ').filter(Boolean);
    if (plain(t.label).length >= 4 && labelWords.length && words.length === labelWords.length + 1 && labelWords.every((w) => words.includes(w))) best = 78;
  }
  return best;
}

/** The apps the user may have meant, best first. Installed ones win ties, then the shorter name. */
export function matchApp(spoken: string, idx: AppIndex, min = 70): AppMatch[] {
  const phrase = cleanAppPhrase(spoken);
  if (!phrase) return [];
  const words = plain(phrase).split(' ').filter(Boolean);
  const out: AppMatch[] = [];
  for (const target of idx.targets) {
    const score = scoreTarget(phrase, words, target);
    if (score >= min) out.push({ target, score });
  }
  out.sort((a, b) => b.score - a.score || Number(b.target.installed) - Number(a.target.installed) || a.target.label.length - b.target.label.length);
  return out;
}

/** Letters-only edit distance, giving up above 2 (the spoken name is compared with hundreds of app names). */
function near(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 2 || Math.min(a.length, b.length) < 5) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > 2) return false;
    prev = cur;
  }
  return prev[b.length] <= 2;
}

/** Installed apps that merely look or sound a bit like what was said: offered back to the model so it can retry. */
export function closestInstalled(spoken: string, idx: AppIndex): AppMatch[] {
  const phrase = cleanAppPhrase(spoken);
  if (!phrase) return [];
  const out: AppMatch[] = [];
  for (const target of idx.targets) {
    if (!target.installed) continue;
    let best = 0;
    const sq = squash(phrase);
    for (const name of target.names) {
      best = Math.max(best, scoreName(phrase, name));
      // A recogniser's spelling of the name: "chat g p" for ChatGPT.
      if (near(sq, squash(name)) || near(soundKey(phrase), soundKey(name))) best = Math.max(best, 82);
    }
    if (best >= 50) out.push({ target, score: best });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 8);
}
