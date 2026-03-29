import { useCallback, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabaseFetch } from '@/constants/supabase';

export function useWallet() {
  const { user, getValidSession } = useAuth();
  const [balance, setBalance] = useState<number>(user?.walletBalance ?? 0);
  const [profileId, setProfileId] = useState<string>(user?.profileId ?? '');
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const validSession = await getValidSession();
      if (!validSession?.access_token) return;
      const res = await supabaseFetch(
        `/rest/v1/profiles?select=id,wallet_balance&user_id=eq.${user.id}&limit=1`,
        {},
        validSession.access_token,
      );
      if (res.ok) {
        const rows = await res.json() as Array<{ id: string; wallet_balance: number }>;
        if (rows?.length) {
          setBalance(rows[0].wallet_balance ?? 0);
          setProfileId(rows[0].id);
        }
      }
    } catch {}
    finally {
      setLoading(false);
    }
  }, [user, getValidSession]);

  return { balance, profileId, loading, refetch };
}
