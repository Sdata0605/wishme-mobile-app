import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { AnimatedSplash } from '@/components/splash/AnimatedSplash';

const STORAGE_ONBOARDING = '@wishme/onboarding_seen';
const STORAGE_USER = '@wishme/user';

/** Where the app should open, from what is stored on the phone. Never throws: the worst case is onboarding. */
async function resolveDestination(): Promise<string> {
  try {
    const [seenStr, userStr] = await AsyncStorage.multiGet([STORAGE_ONBOARDING, STORAGE_USER]).then((pairs) => [
      pairs[0][1],
      pairs[1][1],
    ]);

    if (userStr) {
      try {
        const user = JSON.parse(userStr) as { role?: string };
        if (user?.role === 'celebrity') return '/celebrity-dashboard';
        if (user?.role === 'user') return '/(tabs)/assistant';
      } catch {}
    }

    return seenStr === '1' ? '/(auth)' : '/onboarding';
  } catch {
    return '/onboarding';
  }
}

/**
 * The entry route: plays the animated splash while the destination is worked out, and only navigates once the
 * splash has finished its exit, so the first screen never pops in under a half-played animation.
 */
export default function Index() {
  const [destination, setDestination] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    resolveDestination().then((dest) => {
      if (!cancelled) setDestination(dest);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const go = useCallback(() => {
    if (destination) router.replace(destination as never);
  }, [destination]);

  return <AnimatedSplash ready={destination !== null} onDone={go} />;
}
