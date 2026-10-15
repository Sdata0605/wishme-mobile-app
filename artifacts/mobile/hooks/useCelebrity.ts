import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { fetchOne } from '@/services/supabaseRest';

/** Whether the signed-in user has a celebrity profile (re-checked whenever the screen gains focus). */
export function useCelebrity() {
  const { session, user } = useAuth();
  const [isCelebrity, setIsCelebrity] = useState(false);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    if (!session?.access_token || !user?.profileId) {
      setIsCelebrity(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const row = await fetchOne<{ id: string }>(
        `/rest/v1/celebrities?select=id&profile_id=eq.${user.profileId}&limit=1`,
        session.access_token,
      );
      setIsCelebrity(!!row);
    } catch {
      setIsCelebrity(false);
    }
    setLoading(false);
  }, [session, user?.profileId]);

  useEffect(() => {
    check();
  }, [check]);

  useFocusEffect(
    useCallback(() => {
      check();
    }, [check]),
  );

  return { isCelebrity, loading };
}
