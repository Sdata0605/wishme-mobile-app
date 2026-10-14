import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'home_news_v1';
const FRESH_MS = 15 * 60 * 1000;
const FEED = 'https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en';

export interface Story {
  title: string;
  /** "telegraphindia.com" */
  source: string;
  url: string;
  /** ISO time the story was published. */
  at: string;
}

const entities: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };
const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(amp|lt|gt|quot|#39|apos);/g, m => entities[m] ?? m)
    .trim();

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : '';
}

/** Top headlines from Google News (India edition). Cached for 15 minutes; an empty list means "nothing to show". */
export async function topStories(limit = 6): Promise<Story[]> {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      const c = JSON.parse(cached) as { at: number; stories: Story[] };
      if (Date.now() - c.at < FRESH_MS && c.stories.length) return c.stories.slice(0, limit);
    }
    const res = await fetch(FEED);
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.split('<item>').slice(1);
    const stories: Story[] = [];
    for (const it of items) {
      let title = tag(it, 'title');
      const sourceName = tag(it, 'source');
      const srcUrl = (it.match(/<source[^>]*url="([^"]+)"/) ?? [])[1] ?? '';
      // Google appends " - Source Name" to the headline; the source gets its own line.
      if (sourceName && title.endsWith(` - ${sourceName}`)) title = title.slice(0, -(sourceName.length + 3));
      const pub = tag(it, 'pubDate');
      const when = pub ? new Date(pub) : null;
      if (!title) continue;
      stories.push({
        title,
        source: srcUrl ? srcUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '') : sourceName,
        url: tag(it, 'link'),
        at: when && !isNaN(when.getTime()) ? when.toISOString() : new Date().toISOString(),
      });
      if (stories.length >= 12) break;
    }
    if (stories.length) await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), stories }));
    return stories.slice(0, limit);
  } catch {
    return [];
  }
}

/** "1 hour ago", "23 minutes ago". */
export function ago(iso: string, now = Date.now()): string {
  const mins = Math.max(1, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}
