import { useEffect, useState } from 'react';
import { supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useCelebrityFavorites } from '@/hooks/useCelebrityFavorites';

/**
 * The celebrities the signed-in user is subscribed to, and only those. Every service that asks "which
 * celebrity?" uses this, so nobody can be picked without a subscription.
 *
 * `select` is the PostgREST column list the screen needs (e.g. 'id,name,service_prices').
 */
export function useSubscribedCelebrities<T extends { id: string }>(select: string) {
  const { user, session } = useAuth();
  const token = session?.access_token ?? null;
  const { favoriteIds, loaded } = useCelebrityFavorites({ profileId: user?.profileId, accessToken: token });
  const [celebrities, setCelebrities] = useState<T[]>([]);
  const [fetching, setFetching] = useState(false);

  const idKey = Array.from(favoriteIds).sort().join(',');

  useEffect(() => {
    if (!token || !idKey) {
      setCelebrities([]);
      return;
    }
    let cancelled = false;
    setFetching(true);
    supabaseFetch(
      `/rest/v1/celebrities?select=${select}&id=in.(${idKey})&is_active=eq.true&or=(consent_status.neq.rejected,consent_status.is.null)&order=name.asc`,
      {},
      token,
    )
      .then(r => (r.ok ? r.json() : []))
      .then(rows => { if (!cancelled) setCelebrities(rows as T[]); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => { cancelled = true; };
  }, [token, idKey, select]);

  return {
    celebrities,
    loading: !loaded || fetching,
    /** The user has no active subscription at all. */
    hasNone: loaded && favoriteIds.size === 0,
  };
}
