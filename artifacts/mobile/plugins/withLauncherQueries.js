// Lets the app look up which other apps can be launched, so the voice assistant can open any installed app by its
// package ("open WhatsApp", "open Expo"). Android 11+ hides other apps from an app unless its manifest has a <queries>
// block. This asks only for apps that have a launcher icon, not for the full package list (QUERY_ALL_PACKAGES), which
// Google Play restricts.
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withLauncherQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    if (!manifest.queries?.length) manifest.queries = [{}];
    const q = manifest.queries[0];
    q.intent = q.intent ?? [];
    const exists = q.intent.some(
      (i) =>
        (i.action ?? []).some((a) => a.$['android:name'] === 'android.intent.action.MAIN') &&
        (i.category ?? []).some((c) => c.$['android:name'] === 'android.intent.category.LAUNCHER'),
    );
    if (!exists) {
      q.intent.push({
        action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
        category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
      });
    }
    return cfg;
  });
};
