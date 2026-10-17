import { useCallback, useEffect, useState } from 'react';
import { SUPABASE_ANON_KEY, supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';

/** Same shape the Celebrity Call picker needs. */
export interface VoiceCallCelebrity {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  vapiVoiceId: string;
  vapiPhoneId?: string;
  pricePerCall: number;
  rating: number;
  isVerified: boolean;
}

interface Row {
  id: string;
  name: string;
  category: string | null;
  image_url: string | null;
  vapi_voice_id: string | null;
  vapi_phone_id: string | null;
  voice_call_price: number | null;
  rating: number | null;
  is_verified: boolean | null;
}

/**
 * Loads celebrities for voice calls the same way the web CelebrityCallModal does:
 * REST `celebrities` where vapi_voice_id is set and is_active is true.
 */
export function useVoiceCallCelebrities() {
  const { getValidSession } = useAuth();
  const [celebrities, setCelebrities] = useState<VoiceCallCelebrity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await getValidSession();
      const token = session?.access_token ?? SUPABASE_ANON_KEY;
      const select =
        'id,name,category,image_url,vapi_voice_id,voice_call_price,rating,is_verified,vapi_phone_id';
      const res = await supabaseFetch(
        `/rest/v1/celebrities?select=${encodeURIComponent(select)}&vapi_voice_id=not.is.null&is_active=eq.true&consent_status=eq.approved&order=rating.desc`,
        {},
        token,
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as Record<string, string>;
        throw new Error(body.message ?? body.error ?? `Failed to load celebrities (${res.status})`);
      }
      const rows = (await res.json()) as Row[];
      const parsed: VoiceCallCelebrity[] = [];
      for (const raw of rows ?? []) {
        const voiceId = raw.vapi_voice_id?.trim() ?? '';
        if (!voiceId) continue;
        parsed.push({
          id: raw.id,
          name: raw.name,
          category: raw.category ?? 'Celebrity',
          imageUrl: raw.image_url ?? '',
          vapiVoiceId: voiceId,
          vapiPhoneId: raw.vapi_phone_id?.trim() || undefined,
          pricePerCall: raw.voice_call_price ?? 500,
          rating: raw.rating ?? 0,
          isVerified: raw.is_verified ?? false,
        });
      }
      setCelebrities(parsed);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load celebrities');
      setCelebrities([]);
    } finally {
      setLoading(false);
    }
  }, [getValidSession]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { celebrities, loading, error, refetch };
}
