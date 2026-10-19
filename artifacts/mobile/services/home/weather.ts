import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { supabaseFetch } from '@/constants/supabase';

const CACHE_KEY = 'home_weather_v2';
const ASKED_KEY = 'home_weather_asked_v1';
const FRESH_MS = 30 * 60 * 1000;

export interface Weather {
  /** "Sunny", "Partly cloudy"... */
  label: string;
  tempC: number;
  feelsC: number;
  humidity: number;
  windKmh: number;
  uv: number;
  highC: number;
  lowC: number;
  city: string;
  /** Drives the icon: 'clear' | 'cloud' | 'fog' | 'rain' | 'snow' | 'storm'. */
  kind: 'clear' | 'partly' | 'cloud' | 'fog' | 'rain' | 'snow' | 'storm';
  isDay: boolean;
}

function describe(code: number, isDay: boolean): { label: string; kind: Weather['kind'] } {
  if (code === 0) return { label: isDay ? 'Sunny' : 'Clear', kind: 'clear' };
  if (code <= 2) return { label: 'Partly cloudy', kind: 'partly' };
  if (code === 3) return { label: 'Cloudy', kind: 'cloud' };
  if (code === 45 || code === 48) return { label: 'Foggy', kind: 'fog' };
  if (code >= 51 && code <= 57) return { label: 'Drizzle', kind: 'rain' };
  if (code >= 61 && code <= 67) return { label: 'Rain', kind: 'rain' };
  if (code >= 71 && code <= 77) return { label: 'Snow', kind: 'snow' };
  if (code >= 80 && code <= 82) return { label: 'Showers', kind: 'rain' };
  if (code >= 95) return { label: 'Thunderstorm', kind: 'storm' };
  return { label: 'Fair', kind: 'partly' };
}

export interface Place { name: string; latitude: number; longitude: number; country_code?: string; population?: number; admin1?: string; country?: string }

/**
 * India first: the first match for "Mangalore" is a hamlet in Tasmania, and "Kochi" is in Japan. An Indian match wins over
 * a small foreign place, or over a foreign city smaller than it; a major city (Paris, Dubai, London) keeps its own country.
 * Open-Meteo lists some Indian cities with population 0, so size alone cannot decide. Pure.
 */
export function pickPlace(results: Place[] | null | undefined): Place | null {
  const list = Array.isArray(results) ? results : [];
  const top = list[0];
  if (!top || top.country_code === 'IN') return top ?? null;
  const india = list.find((r) => r.country_code === 'IN');
  if (!india) return top;
  const pop = (r: Place) => Number(r.population) || 0;
  return pop(top) < 100_000 || pop(india) > pop(top) ? india : top;
}

/** A city name to a place, India first. Null when nothing matches or the network is away. */
export async function findCity(name: string): Promise<Place | null> {
  const q = name.trim();
  if (!q) return null;
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=10&language=en&format=json&name=${encodeURIComponent(q)}`);
    if (!res.ok) return null;
    return pickPlace(((await res.json()) as { results?: Place[] }).results);
  } catch {
    return null;
  }
}

/** The city on the user's saved address (the default one first), or ''. */
async function profileCity(token: string): Promise<string> {
  try {
    const res = await supabaseFetch('/rest/v1/addresses?select=city&order=is_default.desc.nullslast,updated_at.desc&limit=1', {}, token);
    if (!res.ok) return '';
    return String(((await res.json()) as { city?: string }[])[0]?.city ?? '').trim();
  } catch {
    return '';
  }
}

/** Where the weather is for: the phone's position, or (no permission or no fix yet) the city on the user's address. */
export async function wherever(token?: string | null): Promise<{ latitude: number; longitude: number; city: string; fromProfile: boolean } | null> {
  let perm = await Location.getForegroundPermissionsAsync();
  if (!perm.granted && perm.canAskAgain && (await AsyncStorage.getItem(ASKED_KEY)) !== '1') {
    await AsyncStorage.setItem(ASKED_KEY, '1');
    perm = await Location.requestForegroundPermissionsAsync();
  }
  if (perm.granted) {
    const pos = await Location.getLastKnownPositionAsync().catch(() => null) ??
      await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }).catch(() => null);
    if (pos) return { latitude: pos.coords.latitude, longitude: pos.coords.longitude, city: '', fromProfile: false };
  }
  // A cold start can ask before the phone has a fix, and some users never grant location: their saved city stands in.
  if (!token) return null;
  const name = await profileCity(token);
  const place = name ? await findCity(name) : null;
  return place ? { latitude: place.latitude, longitude: place.longitude, city: place.name || name, fromProfile: true } : null;
}

/**
 * The weather where the user is, from Open-Meteo (free, no key). The first time it runs it asks for location once
 * (a one-line reason is on the permissions screen); after that it only uses what was already granted. Without a position
 * it uses the city on the user's saved address. If anything is missing it returns null and the weather card stays hidden.
 * It is never a placeholder.
 */
export async function currentWeather(token?: string | null): Promise<Weather | null> {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      const c = JSON.parse(cached) as { at: number; w: Weather; fromProfile?: boolean };
      // A saved-city answer gives way as soon as the phone may say where it is.
      const stale = c.fromProfile && (await Location.getForegroundPermissionsAsync()).granted;
      if (Date.now() - c.at < FRESH_MS && !stale) return c.w;
    }
    const here = await wherever(token);
    if (!here) return null;
    const { latitude, longitude } = here;
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
        '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day' +
        '&daily=temperature_2m_max,temperature_2m_min,uv_index_max&timezone=auto&forecast_days=1',
    );
    if (!res.ok) return null;
    const j = (await res.json()) as {
      current?: { temperature_2m?: number; apparent_temperature?: number; relative_humidity_2m?: number; wind_speed_10m?: number; weather_code?: number; is_day?: number };
      daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[]; uv_index_max?: number[] };
    };
    const c = j.current;
    if (c?.temperature_2m == null || c.weather_code == null) return null;
    let city = here.city;
    if (!city) {
      try {
        const g = (await Location.reverseGeocodeAsync({ latitude, longitude }))[0];
        city = g?.city || g?.subregion || g?.district || g?.region || '';
      } catch {
        // the card just omits the place
      }
    }
    const isDay = (c.is_day ?? 1) === 1;
    const d = describe(c.weather_code, isDay);
    const w: Weather = {
      label: d.label,
      kind: d.kind,
      isDay,
      tempC: Math.round(c.temperature_2m),
      feelsC: Math.round(c.apparent_temperature ?? c.temperature_2m),
      humidity: Math.round(c.relative_humidity_2m ?? 0),
      windKmh: Math.round(c.wind_speed_10m ?? 0),
      uv: Math.round(j.daily?.uv_index_max?.[0] ?? 0),
      highC: Math.round(j.daily?.temperature_2m_max?.[0] ?? c.temperature_2m),
      lowC: Math.round(j.daily?.temperature_2m_min?.[0] ?? c.temperature_2m),
      city,
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), w, fromProfile: here.fromProfile }));
    return w;
  } catch {
    return null;
  }
}
