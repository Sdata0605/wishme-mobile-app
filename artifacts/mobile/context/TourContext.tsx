import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { View } from 'react-native';

export const TOUR_STORAGE_KEY = '@wishme/tour_seen_v2';
/** Key for the user ID stored by AuthContext — used to detect a new user logging in. */
const AUTH_USER_KEY = '@wishme/user';

/** Header things the tour can point at. The tab-bar steps are positioned from the bar's geometry. */
export type TourTargetId = 'menu' | 'scan';

export interface TourStep {
  id: string;
  title: string;
  body: string;
  /** A measured on-screen element, or the Nth button (0-4) of the bottom bar. */
  target: { kind: 'ref'; id: TourTargetId } | { kind: 'tab'; index: number };
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'menu',
    title: 'Your side menu',
    body: 'Open it for your orders, wishes, wallet, referrals, settings and more.',
    target: { kind: 'ref', id: 'menu' },
  },
  {
    id: 'scan',
    title: 'Scan & Pay',
    body: 'Scan any QR code to pay in seconds. It sits next to your wallet balance.',
    target: { kind: 'ref', id: 'scan' },
  },
  {
    id: 'home',
    title: 'Home',
    body: 'Celebrities, offers and everything WishMe can do, all on one screen.',
    target: { kind: 'tab', index: 0 },
  },
  {
    id: 'services',
    title: 'Services',
    body: 'Flights, hotels, buses, bill payments and more in one place.',
    target: { kind: 'tab', index: 1 },
  },
  {
    id: 'assistant',
    title: 'Your AI assistant',
    body: 'Tap and just speak. Ask it to call someone, set a reminder, book something or open any screen.',
    target: { kind: 'tab', index: 2 },
  },
  {
    id: 'hub',
    title: 'Hub',
    body: 'Your calendar, reminders and call history, together.',
    target: { kind: 'tab', index: 3 },
  },
  {
    id: 'profile',
    title: 'Profile',
    body: 'Your account, plan, wallet and settings live here.',
    target: { kind: 'tab', index: 4 },
  },
];

interface TourContextValue {
  /** True while the tour is on screen. */
  visible: boolean;
  step: number;
  next: () => void;
  skip: () => void;
  /** Called by Home when it is focused: shows the tour once per user per install. Returns a cleanup that hides it again. */
  begin: () => () => void;
  registerTarget: (id: TourTargetId, ref: React.RefObject<View | null>) => void;
  getTarget: (id: TourTargetId) => React.RefObject<View | null> | undefined;
}

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const targets = useRef(new Map<TourTargetId, React.RefObject<View | null>>());

  /**
   * `null`  = not yet checked for the current user
   * `true`  = this user has already seen the tour
   * `false` = this user has NOT seen the tour yet
   *
   * Reset to `null` whenever we detect a different user has logged in so the
   * new user always gets the tour on their first visit to Home.
   */
  const seen = useRef<boolean | null>(null);
  /** The user ID that `seen` was last resolved for. */
  const seenForUserId = useRef<string | null>(null);

  const registerTarget = useCallback((id: TourTargetId, ref: React.RefObject<View | null>) => {
    targets.current.set(id, ref);
  }, []);
  const getTarget = useCallback((id: TourTargetId) => targets.current.get(id), []);

  const finish = useCallback(() => {
    seen.current = true;
    setVisible(false);
    setStep(0);
    AsyncStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify({ seen: true, userId: seenForUserId.current })).catch(() => {});
  }, []);

  const next = useCallback(() => {
    setStep((s) => {
      if (s >= TOUR_STEPS.length - 1) {
        finish();
        return 0;
      }
      return s + 1;
    });
  }, [finish]);

  const begin = useCallback(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        // Determine the currently logged-in user's ID.
        const userStr = await AsyncStorage.getItem(AUTH_USER_KEY);
        const currentUserId: string | null = userStr
          ? ((JSON.parse(userStr) as { id?: string }).id ?? null)
          : null;

        // If the user changed since we last resolved the tour flag, invalidate the cache.
        if (currentUserId !== seenForUserId.current) {
          seen.current = null;
          seenForUserId.current = currentUserId;
        }

        // Read the flag from disk only when not yet cached for this user.
        if (seen.current === null) {
          try {
            const raw = await AsyncStorage.getItem(TOUR_STORAGE_KEY);
            if (raw) {
              const stored = JSON.parse(raw) as { seen?: boolean; userId?: string };
              // Only honour the stored flag if it was recorded for the same user.
              seen.current = stored.seen === true && stored.userId === currentUserId;
            } else {
              seen.current = false;
            }
          } catch {
            seen.current = true; // never nag if storage is unreadable
          }
        }
      } catch {
        // If we can't read the user at all, fall back to the legacy single-flag behaviour.
        if (seen.current === null) seen.current = false;
      }

      if (cancelled || seen.current) return;
      // Let Home finish laying out so the header buttons can be measured.
      timer = setTimeout(() => { if (!cancelled) setVisible(true); }, 700);
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      setVisible(false); // paused (not finished) while Home is not in front; resumes at the same step
    };
  }, []);

  const value = useMemo<TourContextValue>(
    () => ({ visible, step, next, skip: finish, begin, registerTarget, getTarget }),
    [visible, step, next, finish, begin, registerTarget, getTarget],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used inside TourProvider');
  return ctx;
}

/** Returns a ref to put on the view the tour should highlight. */
export function useTourTarget(id: TourTargetId) {
  const { registerTarget } = useTour();
  const ref = useRef<View | null>(null);
  registerTarget(id, ref);
  return ref;
}
