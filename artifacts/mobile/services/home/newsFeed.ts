/**
 * The News screen's data: Google News headlines for a tab (Top, India, World...) or for a topic, each followed to the
 * publisher's page for its picture and summary. All of it runs on the phone, so no key and no server is involved. Titles
 * appear at once; pictures and summaries fill in as each story is read. Finished lists are kept 15 minutes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { extractArticle, fetchWithin, headInfo, readPageHead, resolveGoogleNews } from './newsExtract';
import { parseFeed, type Story } from './news';

export interface NewsTab { id: string; label: string; feed: string }

const ED = 'hl=en-IN&gl=IN&ceid=IN:en';
const topic = (name: string) => `https://news.google.com/rss/headlines/section/topic/${name}?${ED}`;

export const NEWS_TABS: NewsTab[] = [
  { id: 'top', label: 'Top', feed: `https://news.google.com/rss?${ED}` },
  { id: 'india', label: 'India', feed: topic('NATION') },
  { id: 'world', label: 'World', feed: topic('WORLD') },
  { id: 'business', label: 'Business', feed: topic('BUSINESS') },
  { id: 'tech', label: 'Tech', feed: topic('TECHNOLOGY') },
  { id: 'sports', label: 'Sports', feed: topic('SPORTS') },
  { id: 'entertainment', label: 'Entertainment', feed: topic('ENTERTAINMENT') },
  { id: 'science', label: 'Science', feed: topic('SCIENCE') },
  { id: 'health', label: 'Health', feed: topic('HEALTH') },
];

/** A story with what was found on its publisher's page. */
export interface NewsCard extends Story {
  image: string | null;
  snippet: string;
  /** The publisher's own address for the article, when it could be found. */
  articleUrl: string | null;
  /** True once the publisher's page has been looked at (found or not). */
  enriched: boolean;
}

const FRESH_MS = 15 * 60_000;
const MAX_STORIES = 12;
const keyOf = (tab: NewsTab | string) => `news_cards_v1:${typeof tab === 'string' ? tab.toLowerCase() : tab.id}`;

export const asCard = (s: Story): NewsCard => ({ ...s, image: null, snippet: '', articleUrl: null, enriched: false });

/** The feed address for a tab, or for a topic the user named. */
export const feedFor = (tab: NewsTab | string): string =>
  typeof tab === 'string' ? `https://news.google.com/rss/search?q=${encodeURIComponent(tab)}&${ED}` : tab.feed;

/** Just the headlines (fast). Empty when Google could not be reached. */
export async function fetchHeadlines(tab: NewsTab | string, limit = MAX_STORIES): Promise<Story[]> {
  try {
    const res = await fetchWithin(feedFor(tab), 8000);
    if (!res.ok) return [];
    const seen = new Set<string>();
    const stories = parseFeed(await res.text()).filter((s) => {
      const k = s.title.toLowerCase().slice(0, 48);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return stories.slice(0, limit);
  } catch {
    return [];
  }
}

/** One story followed to its publisher's page. Never throws: a story with nothing found is still a story. */
export async function enrichStory(story: NewsCard): Promise<NewsCard> {
  const done = { ...story, enriched: true };
  const real = await resolveGoogleNews(story.url, 6000);
  if (!real) return done;
  const page = await readPageHead(real, 7000);
  if (!page) return { ...done, articleUrl: real };
  const head = headInfo(page.html, page.finalUrl);
  return { ...done, articleUrl: page.finalUrl, image: head.image, snippet: head.description.slice(0, 360) };
}

/** Runs the lookups a few at a time, calling back as each one finishes. */
export async function enrichAll(cards: NewsCard[], onCard: (index: number, card: NewsCard) => void, isCancelled: () => boolean, pool = 4): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (!isCancelled()) {
      const i = next++;
      if (i >= cards.length) return;
      if (cards[i].enriched) continue;
      const card = await enrichStory(cards[i]);
      if (!isCancelled()) onCard(i, card);
    }
  };
  await Promise.all(Array.from({ length: Math.min(pool, cards.length) }, worker));
}

export async function readCache(tab: NewsTab | string): Promise<{ at: number; cards: NewsCard[] } | null> {
  try {
    const raw = await AsyncStorage.getItem(keyOf(tab));
    if (!raw) return null;
    const c = JSON.parse(raw) as { at: number; cards: NewsCard[] };
    return Array.isArray(c.cards) && c.cards.length ? c : null;
  } catch {
    return null;
  }
}

export async function writeCache(tab: NewsTab | string, cards: NewsCard[]): Promise<void> {
  try {
    await AsyncStorage.setItem(keyOf(tab), JSON.stringify({ at: Date.now(), cards }));
  } catch {
    /* the list just is not remembered */
  }
}

export const isFresh = (at: number) => Date.now() - at < FRESH_MS;

/** The article's own picture, summary and first paragraphs, for the story screen. */
export async function fetchArticle(url: string): Promise<{ image: string | null; paragraphs: string[]; description: string; finalUrl: string } | null> {
  const page = await readPageHead(url, 9000, 700_000);
  if (!page) return null;
  const a = extractArticle(page.html, page.finalUrl);
  return { image: a.image, paragraphs: a.paragraphs, description: a.description, finalUrl: page.finalUrl };
}
