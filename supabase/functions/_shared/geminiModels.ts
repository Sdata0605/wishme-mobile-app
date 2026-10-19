/**
 * Which Gemini models to try, discovered from the API key rather than hard-coded.
 *
 * Hard-coding a fallback is how you end up shipping a model that Google has since retired — the
 * list below is built from what the key can actually see today, so a retirement fixes itself.
 * The order still matters: a document should be written by a fast general-purpose model, and only
 * fall back to a slower or older one when the usual ones are busy.
 */

const LIST_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Models that exist but are not general-purpose writers: music, robotics, transcription and so on. */
const SPECIALISED = /embedding|aqa|image|tts|vision|learnlm|gemma|lyria|robotics|computer-use|antigravity|deep-research|transcribe|nano-banana|omni|guard/i;

interface ApiModel {
  name: string;
  supportedGenerationMethods?: string[];
  outputTokenLimit?: number;
}

/** Higher is tried first. */
function score(id: string): number {
  let n = 0;
  // Flash is the right default for writing: quick and cheap. Pro is a capable but slower backstop.
  if (/-flash-lite|flash-lite/.test(id)) n += 40;
  else if (/flash/.test(id)) n += 100;
  else if (/pro/.test(id)) n += 60;
  else return -1;

  // A preview model can vanish or change without warning, so prefer anything stable.
  if (/preview|exp\b/.test(id)) n -= 35;

  // Newer generations first: "gemini-3.8-flash" beats "gemini-3.6-flash".
  const version = id.match(/gemini-(\d+)(?:\.(\d+))?/);
  if (version) n += Number(version[1]) * 10 + Number(version[2] ?? 0);
  // "-latest" aliases keep working when a specific version is retired, so they make good reserves.
  if (/-latest$/.test(id)) n += 4;

  return n;
}

let cache: { at: number; models: string[] } | null = null;
const CACHE_MS = 60 * 60_000;

/**
 * An ordered list of models to try. `preferred` goes first if the key can see it — that is the
 * admin's choice, and it should not be silently overridden.
 */
export async function pickModels(apiKey: string, preferred?: string): Promise<string[]> {
  let discovered: string[] = [];

  if (cache && Date.now() - cache.at < CACHE_MS) {
    discovered = cache.models;
  } else {
    try {
      const res = await fetch(`${LIST_URL}?key=${apiKey}&pageSize=200`, { signal: AbortSignal.timeout(15_000) });
      if (res.ok) {
        const body = await res.json();
        discovered = ((body.models ?? []) as ApiModel[])
          .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
          .map((m) => m.name.replace(/^models\//, ''))
          .filter((id) => !SPECIALISED.test(id) && score(id) > 0)
          .sort((x, y) => score(y) - score(x));
        cache = { at: Date.now(), models: discovered };
      }
    } catch {
      /* fall back to the static list below */
    }
  }

  // If the key could not be asked, use names known to work rather than giving up entirely.
  if (!discovered.length) discovered = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-flash-latest'];

  const ordered = preferred && !discovered.includes(preferred) ? [preferred, ...discovered] : discovered;
  if (preferred) {
    // Move the admin's choice to the front without dropping it from the rest of the chain.
    const rest = ordered.filter((m) => m !== preferred);
    return [preferred, ...rest].slice(0, 5);
  }
  return ordered.slice(0, 5);
}
