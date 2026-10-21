import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

export interface Garage {
  id: string;
  name: string;
  kind: 'car' | 'bike';
  /** Street and area, when OpenStreetMap has them. */
  address: string;
  /** Full postal address, as complete as OpenStreetMap has it. */
  fullAddress: string;
  /** Locality, e.g. "Ujire". */
  area: string;
  /** A brand showroom or dealer workshop rather than an independent repair shop. */
  dealer: boolean;
  phone?: string;
  lat: number;
  lon: number;
  km: number;
}

export type GarageResult =
  | { status: 'ok'; garages: Garage[]; lat: number; lon: number; place: string }
  | { status: 'no-permission'; canAsk: boolean }
  | { status: 'error' };

const CACHE_KEY = 'insurance_garages_v2';
const FRESH_MS = 24 * 60 * 60 * 1000;
const RADIUS_M = 15000;
// Public Overpass servers (free, no key). The second is tried when the first is busy.
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];

function km(aLat: number, aLon: number, bLat: number, bLon: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(bLat - aLat);
  const dLon = r(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

async function fetchWithTimeout(url: string, ms: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal, headers: {
        Accept: 'application/json',
        // The public Overpass servers refuse anonymous clients (okhttp's default agent gets a 406).
        'User-Agent': 'WishMe/1.0 (insurance garage finder)',
      }, });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Car and bike repair shops near the user, from OpenStreetMap via the Overpass API (free, no key), nearest first.
 * Asks for location only when `ask` is true. Results are cached for a day per ~1 km area, because the public
 * servers can take half a minute to answer.
 */
export async function nearbyGarages(ask: boolean): Promise<GarageResult> {
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted && ask && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return { status: 'no-permission', canAsk: perm.canAskAgain };

    const pos =
      (await Location.getLastKnownPositionAsync()) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    if (!pos) return { status: 'error' };
    const { latitude: lat, longitude: lon } = pos.coords;
    const area = `${lat.toFixed(2)},${lon.toFixed(2)}`;

    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      const c = JSON.parse(cached) as { at: number; area: string; place: string; garages: Garage[] };
      if (c.area === area && Date.now() - c.at < FRESH_MS) return { status: 'ok', garages: c.garages, lat, lon, place: c.place };
    }

    const q =
      `[out:json][timeout:25];nwr["shop"~"^(car_repair|motorcycle_repair|car|motorcycle)$"](around:${RADIUS_M},${lat},${lon});` +
      'out center tags 150;';
    let json: { elements?: Array<{ type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> } | null = null;
    for (const ep of ENDPOINTS) {
      try {
        const res = await fetchWithTimeout(`${ep}?data=${encodeURIComponent(q)}`, 45000);
        if (res.ok) {
          json = await res.json();
          break;
        }
      } catch {
        // try the next server
      }
    }
    if (!json) return { status: 'error' };

    const garages: Garage[] = [];
    for (const e of json.elements ?? []) {
      const gLat = e.lat ?? e.center?.lat;
      const gLon = e.lon ?? e.center?.lon;
      if (gLat == null || gLon == null) continue;
      const t = e.tags ?? {};
      const bike = t.shop === 'motorcycle_repair' || t.shop === 'motorcycle';
      const dealer = t.shop === 'car' || t.shop === 'motorcycle';
      // A dealership with no workshop is no use for repairs.
      if (dealer && t.service && !/repair|servic/i.test(t.service)) continue;
      const areaName = t['addr:suburb'] || t['addr:village'] || t['addr:town'] || t['addr:city'] || '';
      garages.push({
        id: `${e.type}${e.id}`,
        name: t.name || t.brand || (bike ? 'Bike repair shop' : 'Car repair shop'),
        kind: bike ? 'bike' : 'car',
        address: [t['addr:street'], areaName].filter(Boolean).join(', '),
        fullAddress:
          t['addr:full'] ||
          [
            [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' '),
            areaName,
            t['addr:district'],
            [t['addr:state'], t['addr:postcode']].filter(Boolean).join(' '),
          ]
            .filter(Boolean)
            .join(', '),
        area: areaName,
        dealer,
        phone: t.phone || t['contact:phone'] || undefined,
        lat: gLat,
        lon: gLon,
        km: km(lat, lon, gLat, gLon),
      });
    }
    // Named places first within similar distances: an unnamed pin is less useful to the user.
    garages.sort((a, b) => a.km + (a.name.endsWith('repair shop') ? 3 : 0) - (b.km + (b.name.endsWith('repair shop') ? 3 : 0)));
    const top = garages.slice(0, 60);
    let place = '';
    try {
      const g = (await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon }))[0];
      place = [g?.district || g?.subregion, g?.city].filter(Boolean).join(', ') || g?.region || '';
    } catch {
      // the header just shows "your location"
    }
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), area, place, garages: top }));
    return { status: 'ok', garages: top, lat, lon, place };
  } catch {
    return { status: 'error' };
  }
}
