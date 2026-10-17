import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, type Href } from 'expo-router';
import { Bus, Hotel, Plane, Ticket, type LucideIcon } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { BILL_SERVICES, groupForKind, type BillGroup, type BillKind } from './billData';

/** The All Services filter chips and the shortcut groups share these names. */
export type ShortcutCategory = BillGroup | 'travel';

export const CATEGORY_LABEL: Record<ShortcutCategory, string> = {
  bills: 'Bills',
  recharge: 'Recharge',
  travel: 'Travel',
  finance: 'Finance',
};

export const CATEGORY_ORDER: ShortcutCategory[] = ['bills', 'recharge', 'travel', 'finance'];

export interface ShortcutDef {
  id: string;
  /** Caption under the chip and the row title in the picker. */
  sub: string;
  /** A provider wordmark shown inside the chip; shortcuts without one show `Icon`. */
  brand?: string;
  Icon: LucideIcon;
  color: string;
  bg: string;
  category: ShortcutCategory;
  /** The `/services` view to open, plus the pay-form kind and provider id for bill shortcuts. */
  start: string;
  kind?: BillKind;
  provider?: string;
}

/** One shortcut per bill type, taken from the bill catalogue so icon, colour and name stay in step with it. */
const SHORT_NAME: Record<BillKind, string> = {
  electricity: 'Electricity',
  water: 'Water',
  gas: 'Gas',
  broadband: 'Broadband',
  landline: 'Landline',
  mobile: 'Mobile',
  dth: 'DTH',
  fastag: 'FASTag',
  creditCard: 'Credit Card',
  loanEmi: 'Loan EMI',
  insurance: 'Insurance',
};

const billShortcuts: ShortcutDef[] = BILL_SERVICES.map((s) => ({
  id: s.key,
  sub: SHORT_NAME[s.key],
  Icon: s.Icon,
  color: s.color,
  bg: s.bg,
  category: groupForKind(s.key),
  start: 'billPay',
  kind: s.key,
}));

/** Brand presets: they open the pay form with that provider already chosen (ids from billData's provider lists). */
const preset = (
  id: string,
  brand: string,
  kind: BillKind,
  provider: string,
  color: string,
  bg: string,
): ShortcutDef => {
  const base = billShortcuts.find((b) => b.id === kind)!;
  return { ...base, id, brand, provider, color, bg };
};

const presets: ShortcutDef[] = [
  preset('bescom', 'BESCOM', 'electricity', 'bescom', '#F59E0B', '#F5F0FF'),
  preset('airtel', 'airtel', 'mobile', 'airtel', '#E4002B', '#FEE2E2'),
  preset('jio', 'Jio', 'mobile', 'jio', '#0A5CD6', '#DBEAFE'),
  preset('tataplay', 'Tata Play', 'dth', 'tata', '#B026FF', '#F5F3FF'),
  preset('hdfc', 'HDFC', 'creditCard', 'hdfc-cc', '#004B8D', '#DBEAFE'),
  preset('icici', 'ICICI', 'creditCard', 'icici-cc', '#B45309', '#FEF3C7'),
];

const travelShortcuts: ShortcutDef[] = [
  { id: 'flights', sub: 'Flights', Icon: Plane, color: '#0B1F6B', bg: '#E0E7FF', category: 'travel', start: 'flights' },
  { id: 'hotels', sub: 'Hotels', Icon: Hotel, color: '#FF5F1F', bg: '#EFF6FF', category: 'travel', start: 'hotels' },
  { id: 'bus', sub: 'Bus Tickets', Icon: Bus, color: '#D97706', bg: '#FFFBEB', category: 'travel', start: 'busTickets' },
  { id: 'mytickets', sub: 'My Tickets', Icon: Ticket, color: '#B026FF', bg: '#F5F3FF', category: 'travel', start: 'myTickets' },
];

export const SHORTCUT_CATALOG: ShortcutDef[] = [...presets, ...billShortcuts, ...travelShortcuts];

const BY_ID = new Map(SHORTCUT_CATALOG.map((d) => [d.id, d]));
export const shortcutById = (id: string) => BY_ID.get(id);

export const MAX_SHORTCUTS = 8;
export const DEFAULT_SHORTCUT_IDS = ['bescom', 'airtel', 'flights', 'hdfc', 'fastag'];

/** Opens the service behind a shortcut. `push`, so Back returns to the All Services tab. */
export function openShortcut(def: ShortcutDef) {
  const params: Record<string, string> = { start: def.start };
  if (def.kind) params.kind = def.kind;
  if (def.provider) params.provider = def.provider;
  router.push({ pathname: '/services', params } as Href);
}

const KEY = 'wishme.savedShortcuts.v1';

/** The user's saved shortcut ids, kept on this phone per account. `ids` is null until the first read finishes. */
export function useSavedShortcuts() {
  const { user } = useAuth();
  const storageKey = `${KEY}:${user?.id ?? 'guest'}`;
  const [ids, setIds] = useState<string[] | null>(null);
  const keyRef = useRef(storageKey);
  keyRef.current = storageKey;

  useEffect(() => {
    let alive = true;
    setIds(null);
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (!alive) return;
        let saved: string[] | null = null;
        try {
          const parsed = raw ? JSON.parse(raw) : null;
          if (Array.isArray(parsed)) saved = parsed.filter((x): x is string => typeof x === 'string' && BY_ID.has(x));
        } catch {
          saved = null;
        }
        // Never saved before (or unreadable) -> the defaults. A saved empty list means the user removed them all.
        setIds((saved ?? DEFAULT_SHORTCUT_IDS).slice(0, MAX_SHORTCUTS));
      })
      .catch(() => alive && setIds(DEFAULT_SHORTCUT_IDS));
    return () => {
      alive = false;
    };
  }, [storageKey]);

  const update = useCallback((next: string[]) => {
    const clean = next.slice(0, MAX_SHORTCUTS);
    setIds(clean);
    AsyncStorage.setItem(keyRef.current, JSON.stringify(clean)).catch(() => {});
  }, []);

  const add = useCallback((id: string) => {
    setIds((cur) => {
      if (!cur || cur.includes(id) || cur.length >= MAX_SHORTCUTS || !BY_ID.has(id)) return cur;
      const next = [...cur, id];
      AsyncStorage.setItem(keyRef.current, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setIds((cur) => {
      if (!cur) return cur;
      const next = cur.filter((x) => x !== id);
      AsyncStorage.setItem(keyRef.current, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const move = useCallback((id: string, dir: -1 | 1) => {
    setIds((cur) => {
      if (!cur) return cur;
      const i = cur.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      AsyncStorage.setItem(keyRef.current, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const reset = useCallback(() => update(DEFAULT_SHORTCUT_IDS), [update]);

  return { ids, add, remove, move, reset };
}
