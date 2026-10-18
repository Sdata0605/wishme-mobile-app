/**
 * Helpers for the News screens, all run on the phone (Google refuses the app's server for these lookups, but not a phone):
 * finding the publisher's address behind a Google News link, and reading a publisher's page for its picture, summary and first
 * paragraphs. Pure apart from `fetch`, so the parsing is checked offline (scripts/newsExtract.selfcheck.ts).
 */

const ENTITIES: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ', '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”', '&hellip;': '…', '&ndash;': '–', '&mdash;': '—' };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m) => {
    const known = ENTITIES[m.toLowerCase()];
    if (known) return known;
    const num = /^&#(?:x([0-9a-f]+)|(\d+));$/i.exec(m);
    if (num) {
      const n = num[1] ? parseInt(num[1], 16) : Number(num[2]);
      if (Number.isFinite(n) && n > 0 && n <= 0x10ffff) {
        try { return String.fromCodePoint(n); } catch { /* keep it */ }
      }
    }
    return m;
  });
}

/** fetch with a time limit (React Native has no AbortSignal.timeout). */
export async function fetchWithin(url: string, ms: number, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const isGoogleHost = (host: string) => /(^|\.)google\.[a-z.]+$/.test(host);

/** A headline link that already is the publisher's own (not a Google one), or null. */
export function publisherAddress(link: string): string | null {
  try {
    const u = new URL(link);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return isGoogleHost(u.hostname) ? null : u.toString();
  } catch {
    return null;
  }
}

/** The address Google's lookup answered with: its "=" and "&" come as a backslash followed by u003d / u0026. */
export function addressFromAnswer(answer: string): string | null {
  const bs = String.fromCharCode(92);
  const quote = bs + '"';
  const start = answer.search(new RegExp(bs + bs + '"https?://'));
  if (start < 0) return null;
  const from = start + quote.length;
  const end = answer.indexOf(quote, from);
  if (end < 0) return null;
  try {
    // The answer may be escaped once or twice, so "=" and "&" come as one or two backslashes before u003d / u0026.
    const plain = answer.slice(from, end).split(bs + bs + 'u003d').join('=').split(bs + bs + 'u0026').join('&').split(bs + 'u003d').join('=').split(bs + 'u0026').join('&');
    const url = new URL(plain);
    return isGoogleHost(url.hostname) ? null : url.toString();
  } catch {
    return null;
  }
}

/**
 * The publisher's address behind a Google News article link. The link's page hands out a signature and a time, and Google's own
 * lookup answers with the address. Null when it cannot be found (the story is then still shown, without a picture).
 */
export async function resolveGoogleNews(link: string, ms = 5000): Promise<string | null> {
  const direct = publisherAddress(link);
  if (direct) return direct;
  try {
    const u = new URL(link);
    if (!/(^|\.)news\.google\.com$/.test(u.hostname)) return null;
    const id = u.pathname.split('/').filter(Boolean).pop() ?? '';
    if (!id) return null;
    const page = await fetchWithin(`https://news.google.com/rss/articles/${id}`, ms);
    const html = await page.text();
    const sg = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
    const ts = html.match(/data-n-a-ts="([^"]+)"/)?.[1];
    if (!sg || !ts) return null;
    const inner = `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${id}",${ts},"${sg}"]`;
    const res = await fetchWithin('https://news.google.com/_/DotsSplashUi/data/batchexecute', ms, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: 'f.req=' + encodeURIComponent(JSON.stringify([[['Fbv4je', inner]]])),
    });
    return addressFromAnswer(await res.text());
  } catch {
    return null;
  }
}

const meta = (html: string, key: string): string => {
  const a = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, 'i');
  const b = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, 'i');
  return decodeEntities((html.match(a)?.[1] ?? html.match(b)?.[1] ?? '').trim());
};

const absolute = (value: string, base: string): string | null => {
  if (!value) return null;
  try {
    const u = new URL(value, base);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
};

/** The story's picture: the page's og:image (or twitter:image), as a full web address. */
export function imageOf(html: string, pageUrl: string): string | null {
  return absolute(meta(html, 'og:image') || meta(html, 'twitter:image') || meta(html, 'og:image:url'), pageUrl);
}

/** What a page head says about the story: its picture and its summary. */
export function headInfo(html: string, pageUrl: string): { image: string | null; description: string } {
  return { image: imageOf(html, pageUrl), description: meta(html, 'og:description') || meta(html, 'description') };
}

const JUNK = /cookie|subscribe|sign in|log in|advertis|copyright|all rights reserved|follow us|download the app|read more|also read|click here|newsletter|terms of use|privacy policy/i;

export interface Article {
  image: string | null;
  description: string;
  paragraphs: string[];
}

/** The picture and the first paragraphs of a news page. Empty when the page has no readable text. */
export function extractArticle(html: string, pageUrl: string, maxChars = 1500): Article {
  const head = headInfo(html, pageUrl);
  const body = (html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html).replace(/<(script|style|noscript|svg|nav|footer|header|form|aside|iframe)[\s\S]*?<\/\1>/gi, ' ');
  const paragraphs: string[] = [];
  let used = 0;
  for (const m of body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = decodeEntities(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (text.length < 70 || JUNK.test(text)) continue;
    if (paragraphs.includes(text)) continue;
    if (used + text.length > maxChars && paragraphs.length) break;
    paragraphs.push(text.slice(0, maxChars));
    used += text.length;
    if (paragraphs.length >= 5) break;
  }
  return { image: head.image, description: head.description, paragraphs };
}

/** Reads the start of a page (its head holds the picture and summary) without downloading all of it. */
export async function readPageHead(url: string, ms: number, maxChars = 150_000): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const res = await fetchWithin(url, ms, { headers: { Accept: 'text/html', 'Accept-Language': 'en-IN,en;q=0.9' }, redirect: 'follow' });
    if (!res.ok || !/html/i.test(res.headers.get('content-type') ?? '')) return null;
    // React Native's fetch has no streaming body: the text is read whole and cut.
    return { html: (await res.text()).slice(0, maxChars), finalUrl: res.url || url };
  } catch {
    return null;
  }
}
