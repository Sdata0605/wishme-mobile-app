import { supabaseFetch } from '@/constants/supabase';
import type { Celebrity } from '@/hooks/useCelebrities';

/**
 * The "best moment": the short clip that plays full screen when a celebrity card is tapped, before their profile opens.
 *
 * Where the clip comes from, in order:
 *  1. The celebrity's own public video in `celebrity_media` (uploaded from the celebrity dashboard's Content tab and
 *     made public; the newest one, or the one titled "best moment"/"highlight" if there is one).
 *  2. Their original moment on YouTube, played from the official upload (BY_NAME). Nothing is copied into the app:
 *     the owner's video plays in place, with a start and end so only the moment itself is shown.
 *  3. A free stock clip for their category, so a card never opens on a blank screen.
 */

export type Moment =
  | { kind: 'video'; url: string; caption: string }
  | { kind: 'youtube'; videoId: string; start?: number; end?: number; caption: string };

type Lookup = Pick<Celebrity, 'id' | 'name' | 'category'>;

/**
 * Original moments by celebrity name (lower-case, trimmed), each from the rights holder's own channel.
 * `start`/`end` are seconds into that video. To add someone: their official upload's id plus the window to show.
 */
const BY_NAME: Record<string, Moment> = {
  // Vertical Shorts from the official channels fill the phone screen edge to edge.
  // Star Sports: the iconic six off Haris Rauf at the MCG, T20 World Cup 2022.
  'virat kohli': { kind: 'youtube', videoId: 'BXJvqaIHrgk', caption: 'The six off Haris Rauf · MCG 2022' },
  // Red Chillies Entertainment: Vikram Rathore's swag, Jawan.
  'shah rukh khan': { kind: 'youtube', videoId: 'KLTwIHjH1tE', caption: 'Vikram Rathore · Jawan' },
  // Prime Video: Best of Priyanka Chopra, Citadel.
  'priyanka chopra': { kind: 'youtube', videoId: '1_weueeuFzg', end: 45, caption: 'Nadia Sinh · Citadel' },
  // Prime Video India: Rubina, the fearless warrior, Pathaan.
  'deepika padukone': { kind: 'youtube', videoId: 'pS5KWChN-2c', caption: 'Rubina · Pathaan' },
};

// Free stock placeholders (Pexels and Mixkit licences allow this use). Portrait where the site had one.
const CRICKET: Moment = { kind: 'video', url: 'https://videos.pexels.com/video-files/36088022/15304751_720_1280_60fps.mp4', caption: 'Match day' };
const STAGE: Moment = { kind: 'video', url: 'https://assets.mixkit.co/videos/22056/22056-720.mp4', caption: 'Taking a bow' };
const CONCERT: Moment = { kind: 'video', url: 'https://assets.mixkit.co/videos/48510/48510-720.mp4', caption: 'Live on stage' };

/** The stock clip for a category: the fallback when a celebrity has no clip of their own or it will not play. */
export function stockMoment(category: string): Moment {
  const c = category.toLowerCase();
  if (/cricket|batsman|bowler|tennis|athlete|player|sport|footballer/.test(c)) return CRICKET;
  if (/sing|music|composer|band|dj|rapper/.test(c)) return CONCERT;
  return STAGE;
}

interface MediaRow { file_url: string; title: string | null }

/** The celebrity's own public video, if they have uploaded one. Quick: a slow answer must not hold the screen. */
async function ownVideo(id: string): Promise<Moment | null> {
  try {
    const res = await supabaseFetch(
      `/rest/v1/celebrity_media?celebrity_id=eq.${encodeURIComponent(id)}&media_type=eq.video&is_public=eq.true` +
        '&select=file_url,title&order=created_at.desc&limit=5',
      {},
      undefined,
      4000,
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as MediaRow[];
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const best = rows.find((r) => /moment|highlight|best/i.test(r.title ?? '')) ?? rows[0];
    if (!best.file_url) return null;
    return { kind: 'video', url: best.file_url, caption: best.title?.trim() || 'Best moment' };
  } catch {
    return null;
  }
}

/** The clip to play for this celebrity. Never null: there is always at least the category clip. */
export async function findMoment(c: Lookup): Promise<Moment> {
  const own = await ownVideo(c.id);
  if (own) return own;
  return BY_NAME[c.name.trim().toLowerCase()] ?? stockMoment(c.category);
}
