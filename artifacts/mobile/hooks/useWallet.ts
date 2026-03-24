import { useCallback, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabaseFetch } from '@/constants/supabase';

export function useWallet() {
  const { session, user } = useAuth();
  const [balance, setBalance] = useState<number>(user?.walletBalance ?? 0);
  const [profileId, setProfileId] = useState<string>(user?.profileId ?? '');
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!session?.access_token || !user?.id) return;
    setLoading(true);
    try {
      const res = await supabaseFetch(
        `/rest/v1/profiles?select=id,wallet_balance&user_id=eq.${user.id}&limit=1`,
        {},
        session.access_token,
      );
      if (res.ok) {
        const rows = await res.json() as Array<{ id: string; wallet_balance: number }>;
        if (rows?.length) {
          setBalance(rows[0].wallet_balance ?? 0);
          setProfileId(rows[0].id);
        }
      }
    } catch {}
    setLoading(false);
  }, [session, user]);

  return { balance, profileId, loading, refetch };
}
