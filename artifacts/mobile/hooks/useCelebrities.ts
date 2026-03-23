import { useCallback, useEffect, useState } from 'react';
import { supabaseFetch } from '@/constants/supabase';

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
  social_media?: { instagram?: string; twitter?: string };
  subscription?: { is_enabled: boolean; price: number };
  occasions?: string[];
}

interface ApiResponse {
  success: boolean;
  data: ApiCelebrity[];
  total: number;
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
  /** In-flight promise; used to deduplicate concurrent mount calls. */
  inflight: Promise<void> | null;
  listeners: Set<() => void>;
}

const store: Store = {
  celebrities: [],
  loading: false,
  error: null,
  inflight: null,
  listeners: new Set(),
};

function notify() {
  store.listeners.forEach((l) => l());
}

async function fetchOnce() {
  if (store.inflight) return store.inflight;
  if (store.celebrities.length > 0) return;

  store.loading = true;
  store.error = null;
  notify();

  const promise = (async () => {
    try {
      const res = await supabaseFetch('/functions/v1/get-featured-celebrities', {
        method: 'POST',
        body: JSON.stringify({ limit: SINGLETON_LIMIT }),
      });

      if (!res.ok) throw new Error(`API error (${res.status})`);

      const json: ApiResponse = await res.json();
      if (!json.success || !Array.isArray(json.data)) {
        throw new Error('Unexpected API response format');
      }

      store.celebrities = json.data.map(normalizeCelebrity);
      store.error = null;
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
  refetch: () => void;
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

  return {
    celebrities,
    loading: store.loading,
    error: store.error,
    refetch: refetchAll,
  };
}
