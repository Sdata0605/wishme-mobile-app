import { useEffect, useState } from 'react';
import { supabaseFetch } from '@/constants/supabase';

/**
 * Loads the celebrity named by a `celebrity` route param so an order screen can open with them already chosen.
 * Depends on the id only: a token refresh must not reload it and wipe a half-filled form.
 * `loading` is true until the first answer; a missing id, a failure or an unknown celebrity ends with `celebrity: null`.
 */
export function useCelebrityById<T>(id: string | undefined, select: string): { celebrity: T | null; loading: boolean } {
  const [state, setState] = useState<{ celebrity: T | null; loading: boolean }>({ celebrity: null, loading: !!id });

  useEffect(() => {
    if (!id) {
      setState({ celebrity: null, loading: false });
      return;
    }
    let alive = true;
    setState({ celebrity: null, loading: true });
    supabaseFetch(`/rest/v1/celebrities?select=${select}&id=eq.${encodeURIComponent(id)}&is_active=eq.true&limit=1`)
      .then(r => (r.ok ? r.json() : []))
      .then((rows: T[]) => { if (alive) setState({ celebrity: rows[0] ?? null, loading: false }); })
      .catch(() => { if (alive) setState({ celebrity: null, loading: false }); });
    return () => { alive = false; };
  }, [id, select]);

  return state;
}
