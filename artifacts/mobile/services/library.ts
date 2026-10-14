import { supabaseFetch } from '@/constants/supabase';

/**
 * The Library shows two things in one list:
 *  - greeting cards the user starred (greeting_card_generations.saved_to_library), and
 *  - videos (or other media) saved into library_items.
 */
export interface LibraryItem {
  key: string;
  id: string;
  origin: 'card' | 'library';
  kind: 'image' | 'video';
  title: string;
  subtitle: string | null;
  mediaUrl: string | null;
  fileKey: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
}

export interface SaveVideoInput {
  sourceType: string;
  sourceId: string;
  title: string;
  subtitle?: string | null;
  mediaUrl?: string | null;
  fileKey?: string | null;
  thumbnailUrl?: string | null;
}

const PAGE = 60;

interface CardRow {
  id: string;
  occasion_name: string | null;
  recipient_name: string | null;
  generated_image_url: string | null;
  created_at: string;
}
interface LibraryRow {
  id: string;
  kind: 'image' | 'video';
  title: string;
  subtitle: string | null;
  media_url: string | null;
  file_key: string | null;
  thumbnail_url: string | null;
  created_at: string;
}

// Last list we loaded, so reopening the Library is instant and refreshes in the background.
let cache: { profileId: string; items: LibraryItem[] } | null = null;

export function getCachedLibrary(profileId: string): LibraryItem[] | null {
  return cache && cache.profileId === profileId ? cache.items : null;
}

export function dropLibraryCache() {
  cache = null;
}

async function getJson<T>(path: string, token: string): Promise<T> {
  const res = await supabaseFetch(path, {}, token);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function fetchLibrary(profileId: string, token: string): Promise<LibraryItem[]> {
  // Two small, indexed queries in parallel; only the columns the grid needs.
  const [cards, rows] = await Promise.all([
    getJson<CardRow[]>(
      `/rest/v1/greeting_card_generations?user_id=eq.${profileId}&saved_to_library=eq.true&status=eq.completed` +
        `&select=id,occasion_name,recipient_name,generated_image_url,created_at&order=created_at.desc&limit=${PAGE}`,
      token,
    ),
    getJson<LibraryRow[]>(
      `/rest/v1/library_items?user_id=eq.${profileId}` +
        `&select=id,kind,title,subtitle,media_url,file_key,thumbnail_url,created_at&order=created_at.desc&limit=${PAGE}`,
      token,
    ),
  ]);

  const items: LibraryItem[] = [
    ...cards
      .filter(c => !!c.generated_image_url)
      .map<LibraryItem>(c => ({
        key: `card-${c.id}`,
        id: c.id,
        origin: 'card',
        kind: 'image',
        title: c.occasion_name ? `${c.occasion_name} card` : 'Greeting card',
        subtitle: c.recipient_name ? `For ${c.recipient_name}` : null,
        mediaUrl: c.generated_image_url,
        fileKey: null,
        thumbnailUrl: c.generated_image_url,
        createdAt: c.created_at,
      })),
    ...rows.map<LibraryItem>(r => ({
      key: `lib-${r.id}`,
      id: r.id,
      origin: 'library',
      kind: r.kind,
      title: r.title,
      subtitle: r.subtitle,
      mediaUrl: r.media_url,
      fileKey: r.file_key,
      thumbnailUrl: r.thumbnail_url ?? (r.kind === 'image' ? r.media_url : null),
      createdAt: r.created_at,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  cache = { profileId, items };
  return items;
}

/** Saves a video once per source; saving the same video again is a no-op. */
export async function saveVideoToLibrary(profileId: string, token: string, input: SaveVideoInput): Promise<void> {
  const res = await supabaseFetch(
    '/rest/v1/library_items?on_conflict=user_id,source_type,source_id',
    {
      method: 'POST',
      headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' } as Record<string, string>,
      body: JSON.stringify({
        user_id: profileId,
        kind: 'video',
        source_type: input.sourceType,
        source_id: input.sourceId,
        title: input.title,
        subtitle: input.subtitle ?? null,
        media_url: input.mediaUrl ?? null,
        file_key: input.fileKey ?? null,
        thumbnail_url: input.thumbnailUrl ?? null,
      }),
    },
    token,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  dropLibraryCache();
}

export async function removeFromLibrary(item: LibraryItem, token: string): Promise<void> {
  const res = item.origin === 'card'
    ? await supabaseFetch(
        `/rest/v1/greeting_card_generations?id=eq.${item.id}`,
        { method: 'PATCH', headers: { Prefer: 'return=minimal' } as Record<string, string>, body: JSON.stringify({ saved_to_library: false }) },
        token,
      )
    : await supabaseFetch(
        `/rest/v1/library_items?id=eq.${item.id}`,
        { method: 'DELETE', headers: { Prefer: 'return=minimal' } as Record<string, string> },
        token,
      );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (cache) cache = { ...cache, items: cache.items.filter(i => i.key !== item.key) };
}

/** Source ids of videos already saved, so booking cards can show "Saved". */
export async function fetchSavedVideoIds(profileId: string, token: string): Promise<Set<string>> {
  const rows = await getJson<Array<{ source_id: string }>>(
    `/rest/v1/library_items?user_id=eq.${profileId}&kind=eq.video&select=source_id&limit=500`,
    token,
  );
  return new Set(rows.map(r => r.source_id));
}

// Saved-video ids are loaded once and shared by every "Save to Library" button on the screen.
let savedIdsPromise: Promise<Set<string>> | null = null;
let savedIdsProfile = '';

export function loadSavedVideoIds(profileId: string, token: string): Promise<Set<string>> {
  if (!savedIdsPromise || savedIdsProfile !== profileId) {
    savedIdsProfile = profileId;
    savedIdsPromise = fetchSavedVideoIds(profileId, token).catch(() => {
      savedIdsPromise = null;
      return new Set<string>();
    });
  }
  return savedIdsPromise;
}

export async function markVideoSaved(sourceId: string): Promise<void> {
  if (savedIdsPromise) (await savedIdsPromise).add(sourceId);
}

/** A playable URL: the stored one if there is one, otherwise a signed URL for the file key. */
export async function resolveVideoUrl(item: Pick<LibraryItem, 'mediaUrl' | 'fileKey'>, token: string): Promise<string | null> {
  if (item.fileKey) {
    try {
      const res = await supabaseFetch(
        '/functions/v1/b2-get-signed-url',
        { method: 'POST', body: JSON.stringify({ fileKey: item.fileKey }) },
        token,
      );
      if (res.ok) {
        const data = await res.json() as { signedUrl?: string; url?: string };
        const url = data.signedUrl ?? data.url;
        if (url) return url;
      }
    } catch {
      // fall back to the stored URL below
    }
  }
  return item.mediaUrl;
}
