/**
 * Keeps WishMe up to date on its own (Android). When a newer release is published on GitHub (see services/appUpdate.ts),
 * the APK is downloaded in the background and a card offers to install it. Installing hands the file to Android's
 * package installer, which asks the user once to confirm (and, the very first time, to allow installs from WishMe).
 *
 * Checks on launch and whenever the app returns to the foreground, at most every few hours. "WishMe Local" builds
 * (a different app id, pointed at a local backend) never update themselves.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';
import {
  formatVersion,
  parseVersion,
  pickUpdate,
  UPDATE_REPO,
  type AvailableUpdate,
} from '@/services/appUpdate';

const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;
const LAST_CHECK_KEY = 'app_update_last_check_v1';
const UPDATE_DIR = `${FileSystem.cacheDirectory ?? ''}updates/`;
const GRANT_READ_URI_PERMISSION = 1;
const APK_MIME = 'application/vnd.android.package-archive';

type Phase = { kind: 'idle' } | { kind: 'downloading'; update: AvailableUpdate; progress: number } | { kind: 'ready'; update: AvailableUpdate; uri: string };

const installed = parseVersion(Constants.expoConfig?.version);
const isLocalBuild = (Constants.expoConfig?.android?.package ?? '').endsWith('.local');
const enabled = Platform.OS === 'android' && !!installed && !isLocalBuild && !__DEV__;

async function fetchUpdate(): Promise<AvailableUpdate | null> {
  const res = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases?per_page=15`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) return null;
  const releases = await res.json();
  if (!Array.isArray(releases) || !installed) return null;
  return pickUpdate(releases, installed, Device.supportedCpuArchitectures ?? []);
}

/** Downloads the APK (reusing a complete earlier download) and returns its file URI. */
async function download(update: AvailableUpdate, onProgress: (p: number) => void): Promise<string> {
  await FileSystem.makeDirectoryAsync(UPDATE_DIR, { intermediates: true }).catch(() => {});
  const target = `${UPDATE_DIR}wishme-${formatVersion(update.version)}.apk`;
  // Older downloads are of no use once a newer version is out.
  for (const name of await FileSystem.readDirectoryAsync(UPDATE_DIR).catch(() => [] as string[])) {
    if (`${UPDATE_DIR}${name}` !== target) await FileSystem.deleteAsync(`${UPDATE_DIR}${name}`, { idempotent: true });
  }
  const info = await FileSystem.getInfoAsync(target);
  if (info.exists && update.sizeBytes && info.size === update.sizeBytes) return target;

  const part = `${target}.part`;
  const task = FileSystem.createDownloadResumable(update.apkUrl, part, {}, (p) => {
    if (p.totalBytesExpectedToWrite > 0) onProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
  });
  const done = await task.downloadAsync();
  if (!done || done.status !== 200) throw new Error(`Download failed (${done?.status ?? 'no response'})`);
  await FileSystem.moveAsync({ from: part, to: target });
  return target;
}

async function install(uri: string): Promise<void> {
  const contentUri = await FileSystem.getContentUriAsync(uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: APK_MIME,
    flags: GRANT_READ_URI_PERMISSION,
  });
}

export function AppUpdateGate() {
  const { colors, gradients } = useTheme();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const check = useCallback(async (force = false) => {
    if (!enabled || busy.current) return;
    busy.current = true;
    try {
      if (!force) {
        const last = Number((await AsyncStorage.getItem(LAST_CHECK_KEY).catch(() => null)) ?? 0);
        if (Date.now() - last < CHECK_EVERY_MS) return;
      }
      const update = await fetchUpdate();
      await AsyncStorage.setItem(LAST_CHECK_KEY, String(Date.now())).catch(() => {});
      if (!update) return;
      setPhase({ kind: 'downloading', update, progress: 0 });
      const uri = await download(update, (progress) => setPhase({ kind: 'downloading', update, progress }));
      setPhase({ kind: 'ready', update, uri });
    } catch {
      // No network, GitHub rate limit or a failed download: try again on the next check.
      setPhase({ kind: 'idle' });
      await AsyncStorage.removeItem(LAST_CHECK_KEY).catch(() => {});
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    void check(true);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);

  if (phase.kind !== 'ready' || dismissed) return null;
  const { update, uri } = phase;

  const onInstall = async () => {
    setError(null);
    try {
      await install(uri);
    } catch {
      setError('Could not open the installer. Allow WishMe to install apps in Settings, then try again.');
    }
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 8 }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.row}>
          <Icon name="download" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>WishMe {formatVersion(update.version)} is ready</Text>
            <Text style={[styles.body, { color: colors.mutedForeground }]} numberOfLines={3}>
              {error ?? (update.notes || 'A new version of WishMe has been downloaded.')}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable onPress={() => setDismissed(true)} style={styles.later} accessibilityRole="button">
            <Text style={[styles.laterText, { color: colors.mutedForeground }]}>Later</Text>
          </Pressable>
          <Pressable onPress={onInstall} accessibilityRole="button" accessibilityLabel={`Install WishMe ${formatVersion(update.version)}`}>
            <LinearGradient colors={gradients.primaryHorizontal} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.install}>
              <Text style={styles.installText}>Install update</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 1000, elevation: 1000 },
  card: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 12, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  title: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  body: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8 },
  later: { paddingHorizontal: 14, paddingVertical: 10 },
  laterText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  install: { borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  installText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
});
