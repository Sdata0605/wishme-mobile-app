import { useCallback, useEffect, useState } from 'react';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/constants/supabase';
import { Celebrity } from '@/hooks/useCelebrities';

const FIELDS = [
  'id',
  'name',
  'category',
  'image_url',
  'bio',
  'vapi_voice_id',
  'vapi_phone_id',
  'voice_call_price',
  'rating',
  'is_verified',
  'followers',
].join(',');

const QUERY_URL =
  `${SUPABASE_URL}/rest/v1/celebrities` +
  `?select=${FIELDS}` +
  `&vapi_voice_id=not.is.null` +
  `&is_active=eq.true` +
  `&order=rating.desc`;

type RawRow = {
  id: string;
  name: string;
  category: string | null;
  image_url: string | null;
  bio: string | null;
  vapi_voice_id: string;
  vapi_phone_id: string | null;
  voice_call_price: number | null;
  rating: number | null;
  is_verified: boolean | null;
  followers: number | null;
};

function normalize(r: RawRow): Celebrity {
  return {
    id: r.id,
    name: r.name,
    category: r.category ?? '',
    bio: r.bio ?? '',
    imageUrl: r.image_url ?? '',
    rating: r.rating ?? 0,
    reviewCount: 0,
    followers: r.followers ?? undefined,
    isVerified: r.is_verified ?? false,
    isAvailable: true,
    pricePerWish: 0,
    pricePerCall: r.voice_call_price ?? 500,
    ratePerMinute: r.voice_call_price ?? 500,
    tags: [],
    vapiVoiceId: r.vapi_voice_id,
    vapiPhoneId: r.vapi_phone_id ?? undefined,
  };
}

export function useVoiceCallCelebrities() {
  const [celebrities, setCelebrities] = useState<Celebrity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(QUERY_URL, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });
      if (!res.ok) throw new Error(`API error (${res.status})`);
      const rows: RawRow[] = await res.json();
      setCelebrities(rows.map(normalize));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { celebrities, loading, error, refetch: load };
}
