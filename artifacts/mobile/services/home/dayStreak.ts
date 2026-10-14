import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * DAILY STREAK (Flutter: services/streak_service.dart): how many days in a row the app has been opened.
 * Stored as a date string rather than a timestamp: "did they come back today" is a calendar question, and a
 * timestamp would make someone who opens the app at 11:58pm and again at 12:02am look like a two-day streak.
 */
const K_COUNT = 'streak_count_v1';
const K_BEST = 'streak_best_v1';
const K_LAST = 'streak_last_day_v1';

const day = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export interface Streak { count: number; best: number; grewToday: boolean }

/** Call once per launch or resume; safe to call repeatedly. A missing streak must never block the app. */
export async function touchStreak(): Promise<Streak> {
  try {
    const [[, last], [, countRaw], [, bestRaw]] = await AsyncStorage.multiGet([K_LAST, K_COUNT, K_BEST]);
    const today = day(new Date());
    let count = parseInt(countRaw ?? '0', 10) || 0;
    let best = parseInt(bestRaw ?? '0', 10) || 0;
    if (last === today) return { count, best, grewToday: false };

    const yesterday = day(new Date(Date.now() - 86400000));
    count = last === yesterday ? count + 1 : 1;
    if (count > best) best = count;
    await AsyncStorage.multiSet([[K_LAST, today], [K_COUNT, String(count)], [K_BEST, String(best)]]);
    return { count, best, grewToday: true };
  } catch {
    return { count: 0, best: 0, grewToday: false };
  }
}
