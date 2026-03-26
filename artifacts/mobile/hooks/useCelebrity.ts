import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/constants/supabase';

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
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/celebrities?select=id&profile_id=eq.${user.profileId}&limit=1`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.pgrst.object+json',
          },
        },
      );
      if (res.status === 200) {
        setIsCelebrity(true);
      } else {
        setIsCelebrity(false);
      }
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
