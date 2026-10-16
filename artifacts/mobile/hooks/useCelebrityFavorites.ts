import { useCallback, useEffect, useState } from 'react';
import { fetchRows } from '@/services/supabaseRest';

interface UseCelebrityFavoritesOptions {
  profileId: string | null | undefined;
  accessToken: string | null | undefined;
}

interface UseCelebrityFavoritesResult {
  favoriteIds: Set<string>;
  loading: boolean;
  /** True once the first lookup has finished (or there is nobody signed in), so "no subscriptions" is never shown while still loading. */
  loaded: boolean;
  hasFavorite: (celebrityId: string) => boolean;
  refetch: () => Promise<void>;
}

export function useCelebrityFavorites({
  profileId,
  accessToken,
}: UseCelebrityFavoritesOptions): UseCelebrityFavoritesResult {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchFavorites = useCallback(async () => {
    if (!profileId || !accessToken) {
      setFavoriteIds(new Set());
      setLoaded(true);
      return;
    }
    setLoading(true);
    try {
      const rows = await fetchRows<{ celebrity_id: string }>(
        `/rest/v1/celebrity_favorites?user_id=eq.${profileId}&status=eq.active&select=celebrity_id`,
        accessToken,
      );
      setFavoriteIds(new Set(rows.map((r) => r.celebrity_id)));
    } catch {
      setFavoriteIds(new Set());
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [profileId, accessToken]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const hasFavorite = useCallback(
    (celebrityId: string) => favoriteIds.has(celebrityId),
    [favoriteIds],
  );

  return {
    favoriteIds,
    loading,
    loaded,
    hasFavorite,
    refetch: fetchFavorites,
  };
}
