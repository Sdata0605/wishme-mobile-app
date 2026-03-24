import { useCallback, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabaseFetch } from '@/constants/supabase';

export function useWallet() {
  const { session, user } = useAuth();
  const [balance, setBalance] = useState<number>(user?.walletBalance ?? 0);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!session?.access_token || !user?.id) return;
    setLoading(true);
    try {
      const res = await supabaseFetch(
        `/rest/v1/profiles?select=wallet_balance&id=eq.${user.id}&limit=1`,
        {},
        session.access_token,
      );
      if (res.ok) {
        const rows = await res.json() as Array<{ wallet_balance: number }>;
        if (rows?.length) setBalance(rows[0].wallet_balance ?? 0);
      }
    } catch {}
    setLoading(false);
  }, [session, user]);

  return { balance, loading, refetch };
}
