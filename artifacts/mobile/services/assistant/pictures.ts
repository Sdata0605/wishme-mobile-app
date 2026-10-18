/**
 * "Show me pictures of ...": opens Google Images (or an Instagram / Facebook search) for the subject, the way the user's
 * MyAssistant app does. The assistant never refuses a picture request: it cannot paste photos into the chat, so it opens
 * the image results where they can be seen, and says so in one line.
 *
 * Pure of React Native apart from Linking, so the address builder can be checked offline (scripts/pictures.selfcheck.ts).
 */

import { Linking } from 'react-native';

export type PictureSource = 'google' | 'instagram' | 'facebook';

/** Words that only describe the request, not the subject: "show me pictures of ...". */
const FILLER = /\b(show|me|us|pictures?|pics?|photos?|photographs?|images?|of|for|the|please|find|get|fetch|display|latest|new|hd|from|on|in)\b/gi;

/** The subject on its own: "show me images of Amitabh Bachchan" gives "Amitabh Bachchan". */
export function subjectOf(raw: string): string {
  const cleaned = raw.replace(FILLER, ' ').replace(/[^\p{L}\p{M}\p{N}\s.'-]/gu, ' ').replace(/\s+/g, ' ').trim();
  return (cleaned || raw.replace(/\s+/g, ' ').trim()).slice(0, 100);
}

/**
 * The web address for a picture search.
 *  - google: Google's image results (udm=2 is the current images tab on phones; tbm=isch covers older ones).
 *  - instagram: Google images limited to instagram.com (Instagram's own search ignores the query and opens Reels).
 *  - facebook: Facebook's search.
 */
export function picturesUrl(subject: string, source: PictureSource = 'google'): string {
  const q = encodeURIComponent(subject);
  switch (source) {
    case 'instagram':
      return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${subject} site:instagram.com`)}`;
    case 'facebook':
      return `https://www.facebook.com/search/top?q=${q}`;
    default:
      return `https://www.google.com/search?q=${q}&udm=2&tbm=isch`;
  }
}

export const sourceLabel = (s: PictureSource) => (s === 'instagram' ? 'Instagram' : s === 'facebook' ? 'Facebook' : 'Google Images');

export async function openPictures(rawSubject: string, source: PictureSource = 'google'): Promise<{ ok: boolean; subject: string; url?: string; error?: string }> {
  const subject = subjectOf(rawSubject);
  if (subject.length < 2) return { ok: false, subject, error: 'Ask the user whose or what pictures they want.' };
  const url = picturesUrl(subject, source);
  try {
    await Linking.openURL(url);
    return { ok: true, subject, url };
  } catch {
    return { ok: false, subject, error: 'Could not open the browser.' };
  }
}
