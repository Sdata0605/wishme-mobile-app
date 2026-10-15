import { useCallback, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchOne } from '@/services/supabaseRest';

interface WalletRow {
  id: string;
  wallet_balance: number | null;
}

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
      const row = await fetchOne<WalletRow>(
        `/rest/v1/profiles?select=id,wallet_balance&user_id=eq.${user.id}&limit=1`,
        validSession.access_token,
      );
      if (row) {
        setBalance(row.wallet_balance ?? 0);
        setProfileId(row.id);
      }
    } catch {
      // Keep whatever balance is showing; the caller can try again.
    } finally {
      setLoading(false);
    }
  }, [user, getValidSession]);

  return { balance, profileId, loading, refetch };
}
