import { useCallback, useEffect, useState } from 'react';
import { supabaseFetch } from '@/constants/supabase';

interface UseCelebrityFavoritesOptions {
  profileId: string | null | undefined;
  accessToken: string | null | undefined;
}

interface UseCelebrityFavoritesResult {
  favoriteIds: Set<string>;
  loading: boolean;
  hasFavorite: (celebrityId: string) => boolean;
  refetch: () => Promise<void>;
}

export function useCelebrityFavorites({
  profileId,
  accessToken,
}: UseCelebrityFavoritesOptions): UseCelebrityFavoritesResult {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const fetchFavorites = useCallback(async () => {
    if (!profileId || !accessToken) {
      setFavoriteIds(new Set());
      return;
    }
    setLoading(true);
    try {
      const res = await supabaseFetch(
        `/rest/v1/celebrity_favorites?user_id=eq.${profileId}&status=eq.active&select=celebrity_id`,
        {},
        accessToken,
      );
      if (res.ok) {
        const rows = await res.json() as Array<{ celebrity_id: string }>;
        setFavoriteIds(new Set((rows ?? []).map((r) => r.celebrity_id)));
      }
    } catch {
      setFavoriteIds(new Set());
    } finally {
      setLoading(false);
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
    hasFavorite,
    refetch: fetchFavorites,
  };
}
