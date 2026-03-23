import { useCallback, useEffect, useRef, useState } from 'react';
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

interface CacheEntry {
  celebrities: Celebrity[];
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheKey(limit: number, category?: string): string {
  return `${limit}:${category ?? ''}`;
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
  const [celebrities, setCelebrities] = useState<Celebrity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchCountRef = useRef(0);

  const fetchCelebrities = useCallback(async () => {
    const key = cacheKey(limit, category);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setCelebrities(cached.celebrities);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchId = ++fetchCountRef.current;
    setLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = { limit };
      if (category) body.category = category;

      const res = await supabaseFetch('/functions/v1/get-featured-celebrities', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`API error (${res.status})`);
      }

      const json: ApiResponse = await res.json();

      if (!json.success || !Array.isArray(json.data)) {
        throw new Error('Unexpected API response format');
      }

      const normalized = json.data.map(normalizeCelebrity);

      if (fetchId !== fetchCountRef.current) return;

      cache.set(key, { celebrities: normalized, timestamp: Date.now() });
      setCelebrities(normalized);
      setError(null);
    } catch (err: unknown) {
      if (fetchId !== fetchCountRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load celebrities');
    } finally {
      if (fetchId === fetchCountRef.current) {
        setLoading(false);
      }
    }
  }, [limit, category]);

  useEffect(() => {
    fetchCelebrities();
  }, [fetchCelebrities]);

  return { celebrities, loading, error, refetch: fetchCelebrities };
}
