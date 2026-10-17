import { useCallback, useEffect, useState } from 'react';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseFetch } from '@/constants/supabase';

export interface Celebrity {
  id: string;
  name: string;
  category: string;
  rating: number;
  reviewCount: number;
  pricePerWish: number;
  pricePerCall: number;
  ratePerMinute: number;
  imageUrl: string;
  bio: string;
  tags: string[];
  isVerified: boolean;
  isAvailable: boolean;
  followers?: number;
  location?: string;
  deliveryTime?: string;
  subscription?: { is_enabled: boolean; price: number };
  socialMedia?: { instagram?: string; twitter?: string };
  vapiVoiceId?: string;
  vapiPhoneId?: string;
}

interface ApiCelebrity {
  id: string;
  name: string;
  category: string;
  bio: string;
  image_url: string;
  video_thumbnail_url?: string;
  rating: number;
  review_count: number;
  followers?: number;
  location?: string;
  delivery_time?: string;
  is_verified: boolean;
  service_prices?: {
    general_wish?: number;
    image_promotion?: number;
    text_message?: number;
    ugc_ad?: number;
    video_promotion?: number;
  };
  voice_call_price?: number;
  vapi_voice_id?: string;
  vapi_phone_id?: string;
  social_media?: { instagram?: string; twitter?: string };
  subscription?: { is_enabled: boolean; price: number };
  occasions?: string[];
}

interface RestCelebrity {
  id: string;
  name: string;
  category: string;
  bio: string | null;
  image_url: string | null;
  rating: number | null;
  followers?: number;
  location?: string;
  delivery_time?: string;
  is_verified: boolean;
  service_prices?: ApiCelebrity['service_prices'];
  voice_call_price?: number;
  social_media?: { instagram?: string; twitter?: string };
  vapi_voice_id?: string | null;
  vapi_phone_id?: string | null;
  celebrity_favorite_pricing: { price: number; is_enabled: boolean } | { price: number; is_enabled: boolean }[];
  celebrity_reviews?: { count: number }[];
}

interface ApiResponse {
  success: boolean;
  data: ApiCelebrity[];
  total: number;
}

function normalizeRest(raw: RestCelebrity): Celebrity {
  const pricing = Array.isArray(raw.celebrity_favorite_pricing) ? raw.celebrity_favorite_pricing[0] : raw.celebrity_favorite_pricing;
  // The stored rating and review_count are seeded numbers. A celebrity only has a rating once real reviews exist.
  const realReviews = raw.celebrity_reviews?.[0]?.count ?? 0;
  return {
    id: raw.id,
    name: raw.name,
    category: raw.category,
    bio: raw.bio ?? '',
    imageUrl: raw.image_url ?? '',
    rating: realReviews > 0 ? raw.rating ?? 0 : 0,
    reviewCount: realReviews,
    followers: raw.followers,
    location: raw.location,
    deliveryTime: raw.delivery_time,
    isVerified: raw.is_verified ?? false,
    isAvailable: true,
    pricePerWish: raw.service_prices?.general_wish ?? 0,
    pricePerCall: raw.voice_call_price ?? 0,
    ratePerMinute: raw.voice_call_price ?? 0,
    tags: [],
    subscription: pricing ? { is_enabled: pricing.is_enabled, price: pricing.price } : undefined,
    socialMedia: raw.social_media,
    vapiVoiceId: raw.vapi_voice_id ?? undefined,
    vapiPhoneId: raw.vapi_phone_id ?? undefined,
  };
}

function normalizeCelebrity(raw: ApiCelebrity): Celebrity {
  return {
    id: raw.id,
    name: raw.name,
    category: raw.category,
    bio: raw.bio ?? '',
    imageUrl: raw.image_url ?? '',
    rating: raw.rating ?? 0,
    reviewCount: raw.review_count ?? 0,
    followers: raw.followers,
    location: raw.location,
    deliveryTime: raw.delivery_time,
    isVerified: raw.is_verified ?? false,
    isAvailable: true,
    pricePerWish: raw.service_prices?.general_wish ?? 0,
    pricePerCall: raw.voice_call_price ?? 0,
    ratePerMinute: raw.voice_call_price ?? 0,
    tags: [],
    subscription: raw.subscription,
    socialMedia: raw.social_media,
    vapiVoiceId: raw.vapi_voice_id,
    vapiPhoneId: raw.vapi_phone_id,
  };
}

/**
 * Module-level singleton store.
 * All screens share one fetch per session. The data is fetched once at limit=50
 * (the highest limit any screen requests) and every caller slices/filters locally.
 */
const SINGLETON_LIMIT = 50;

interface Store {
  celebrities: Celebrity[];
  loading: boolean;
  error: string | null;
  /** A fetch has completed successfully (the catalogue may legitimately be empty). */
  loaded: boolean;
  /** In-flight promise; used to deduplicate concurrent mount calls. */
  inflight: Promise<void> | null;
  listeners: Set<() => void>;
}

const store: Store = {
  celebrities: [],
  loading: false,
  error: null,
  loaded: false,
  inflight: null,
  listeners: new Set(),
};

function notify() {
  store.listeners.forEach((l) => l());
}

async function fetchOnce() {
  if (store.inflight) return store.inflight;
  if (store.loaded) return;

  store.loading = true;
  store.error = null;
  notify();

  const promise = (async () => {
    try {
      // Only celebrities a user can subscribe to: verified, approved, active, with subscription switched on.
      // (Unverified, pending and duplicate rows have no subscription price, so the inner join drops them too.)
      const select = [
        'id', 'name', 'category', 'bio', 'image_url', 'video_thumbnail_url', 'rating', 'followers', 'location',
        'delivery_time', 'is_verified', 'service_prices', 'voice_call_price', 'social_media', 'vapi_voice_id', 'vapi_phone_id',
        'celebrity_favorite_pricing!inner(price,is_enabled)',
        'celebrity_reviews(count)',
      ].join(',');
      const res = await supabaseFetch(
        `/rest/v1/celebrities?select=${encodeURIComponent(select)}` +
          '&celebrity_favorite_pricing.is_enabled=eq.true&is_active=eq.true&is_verified=eq.true&consent_status=eq.approved' +
          `&order=rating.desc.nullslast&limit=${SINGLETON_LIMIT}`,
      );
      if (!res.ok) throw new Error(`API error (${res.status})`);

      const rows = await res.json() as RestCelebrity[];
      if (!Array.isArray(rows)) throw new Error('Unexpected API response format');

      // One card per celebrity even if the catalogue has a repeated name.
      const seen = new Set<string>();
      store.celebrities = rows
        .map(normalizeRest)
        .filter(c => {
          const key = `${c.name.trim().toLowerCase()}|${c.category.trim().toLowerCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

      store.error = null;
      store.loaded = true;
    } catch (err: unknown) {
      store.error = err instanceof Error ? err.message : 'Failed to load celebrities';
    } finally {
      store.loading = false;
      store.inflight = null;
      notify();
    }
  })();

  store.inflight = promise;
  return promise;
}

async function refetchAll() {
  store.celebrities = [];
  store.error = null;
  store.loaded = false;
  await fetchOnce();
}

interface UseCelebritiesOptions {
  limit?: number;
  category?: string;
}

interface UseCelebritiesResult {
  celebrities: Celebrity[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCelebrities({ limit = 20, category }: UseCelebritiesOptions = {}): UseCelebritiesResult {
  const [, setTick] = useState(0);

  const rerender = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    store.listeners.add(rerender);
    fetchOnce();
    return () => {
      store.listeners.delete(rerender);
    };
  }, [rerender]);

  const celebrities = store.celebrities
    .filter((c) => {
      if (!category) return true;
      return (
        c.category === category ||
        c.category.toLowerCase().includes(category.toLowerCase()) ||
        category.toLowerCase().includes(c.category.toLowerCase())
      );
    })
    .slice(0, limit);

  /**
   * Treat the store as "loading" until a fetch has finished — this prevents a brief "not found" flash on the first
   * render before fetchOnce() has flipped store.loading to true, and still lets an empty catalogue show its empty state.
   */
  const loading = store.loading || (!store.loaded && store.error === null);

  return {
    celebrities,
    loading,
    error: store.error,
    refetch: refetchAll,
  };
}
