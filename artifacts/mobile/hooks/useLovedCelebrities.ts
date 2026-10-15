import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

const KEY = 'wishme.lovedCelebrities.v1';

/**
 * Celebrities the user marked with the heart on a profile. Kept on the device per user (like Saved Shortcuts).
 * One module-level store so the profile heart and the Favorites screen always agree.
 */
const store = {
  /** undefined = nothing loaded yet; null = signed out. */
  loadedFor: undefined as string | null | undefined,
  ready: false,
  ids: [] as string[],
  listeners: new Set<() => void>(),
};

const notify = () => store.listeners.forEach(l => l());
const keyFor = (userId: string) => `${KEY}:${userId}`;

async function load(userId: string | null) {
  if (store.loadedFor === userId) return;
  store.loadedFor = userId;
  store.ids = [];
  store.ready = userId === null;
  notify();
  if (userId === null) return;
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (store.loadedFor !== userId) return;
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) store.ids = parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    // unreadable list: start empty
  }
  if (store.loadedFor === userId) {
    store.ready = true;
    notify();
  }
}

export function useLovedCelebrities() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [, setTick] = useState(0);

  useEffect(() => {
    const rerender = () => setTick(t => t + 1);
    store.listeners.add(rerender);
    return () => { store.listeners.delete(rerender); };
  }, []);

  useEffect(() => { void load(userId); }, [userId]);

  const ids = store.loadedFor === userId ? store.ids : [];
  const lovedIds = useMemo(() => new Set(ids), [ids]);

  const isLoved = useCallback((celebrityId: string) => lovedIds.has(celebrityId), [lovedIds]);

  /** Flips the heart. Returns the new state, or null when signed out / still loading. */
  const toggle = useCallback((celebrityId: string): boolean | null => {
    if (!userId || store.loadedFor !== userId || !store.ready) return null;
    const has = store.ids.includes(celebrityId);
    store.ids = has ? store.ids.filter(x => x !== celebrityId) : [celebrityId, ...store.ids];
    AsyncStorage.setItem(keyFor(userId), JSON.stringify(store.ids)).catch(() => {});
    notify();
    return !has;
  }, [userId]);

  return { lovedIds, isLoved, toggle, ready: store.loadedFor === userId && store.ready };
}
