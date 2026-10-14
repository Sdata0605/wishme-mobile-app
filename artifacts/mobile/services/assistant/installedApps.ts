/**
 * The apps really installed on this phone (name + package), read by the native `installed-apps` module and kept fresh.
 *
 * The list never leaves the phone: the assistant is only ever told the name of the app it opened, or a few close names
 * when nothing matched. In a build made before the native module existed `nativeApps` is null (a JavaScript reload
 * cannot add native code), and everything keeps working from the hand-written catalogue.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import nativeApps from '@/modules/installed-apps';
import { buildAppIndex, type AppIndex, type LaunchableApp } from './installedAppMatch';

export { nativeApps };

const KEY = 'assistant.installedApps.v1';
const FRESH_MS = 3 * 60_000;

let index: AppIndex = buildAppIndex(null);
let loadedAt = 0;
let hydrated: Promise<void> | null = null;
let loading: Promise<AppIndex> | null = null;

/** The current index, at once (for the quick "open <app>" check that runs while the user is still talking). */
export const getAppIndex = (): AppIndex => index;

/** Reads the phone's launcher apps again (at most every 3 minutes unless forced). */
export function refreshInstalledApps(force = false): Promise<AppIndex> {
  if (!nativeApps || (!force && Date.now() - loadedAt < FRESH_MS)) return Promise.resolve(index);
  if (!loading) {
    loading = nativeApps
      .getLaunchableApps()
      .then(
        (apps) => {
          if (apps.length) {
            index = buildAppIndex(apps);
            loadedAt = Date.now();
            void AsyncStorage.setItem(KEY, JSON.stringify(apps)).catch(() => {});
          }
          if (__DEV__) console.log('[apps] installed:', apps.length);
          return index;
        },
        (e) => {
          if (__DEV__) console.log('[apps] could not read the installed apps:', e instanceof Error ? e.message : e);
          return index;
        },
      )
      .finally(() => {
        loading = null;
      });
  }
  return loading;
}

/** The index to match against: the saved list at once, refreshed in the background (the very first run waits ~1 s for it). */
export async function ensureAppIndex(): Promise<AppIndex> {
  if (!nativeApps) return index;
  hydrated ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      const apps: LaunchableApp[] = raw ? JSON.parse(raw) : [];
      if (apps.length && !loadedAt) index = buildAppIndex(apps);
    })
    .catch(() => {});
  await hydrated;
  if (!index.hasInstalled) return refreshInstalledApps(true);
  void refreshInstalledApps();
  return index;
}

if (nativeApps) {
  void ensureAppIndex();
  AppState.addEventListener('change', (s) => {
    if (s === 'active') void refreshInstalledApps();
  });
}
