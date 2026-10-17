import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { View } from 'react-native';

export const TOUR_STORAGE_KEY = '@wishme/tour_seen_v1';

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
    body: 'Tap and just speak. Ask it to find a celebrity, book a wish, call someone or open any screen.',
    target: { kind: 'tab', index: 2 },
  },
  {
    id: 'celebrities',
    title: 'Stars',
    body: 'Browse celebrities and book personalised wishes, calls and promotions.',
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
  /** Called by Home when it is focused: shows the tour once per install. Returns a cleanup that hides it again. */
  begin: () => () => void;
  registerTarget: (id: TourTargetId, ref: React.RefObject<View | null>) => void;
  getTarget: (id: TourTargetId) => React.RefObject<View | null> | undefined;
}

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const targets = useRef(new Map<TourTargetId, React.RefObject<View | null>>());
  const seen = useRef<boolean | null>(null);

  const registerTarget = useCallback((id: TourTargetId, ref: React.RefObject<View | null>) => {
    targets.current.set(id, ref);
  }, []);
  const getTarget = useCallback((id: TourTargetId) => targets.current.get(id), []);

  const finish = useCallback(() => {
    seen.current = true;
    setVisible(false);
    setStep(0);
    AsyncStorage.setItem(TOUR_STORAGE_KEY, '1').catch(() => {});
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
      if (seen.current === null) {
        try {
          seen.current = (await AsyncStorage.getItem(TOUR_STORAGE_KEY)) === '1';
        } catch {
          seen.current = true; // never nag if storage is unreadable
        }
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
