// Layered over app.json.
//
// Every build: android.versionCode comes from expo.version (1.2.3 -> 10203, the formula in services/appUpdate.ts), so
// each released version installs over the previous one, which the in-app updater relies on. Bump "version" in
// app.json for a release; never set versionCode by hand.
//
// When the app is built against a plain-http backend (a local WishMe backend, e.g.
// EXPO_PUBLIC_SUPABASE_URL=http://localhost:3000 with `adb reverse tcp:3000 tcp:3000`), it becomes a separate
// "WishMe Local" app that installs next to the real one, and is allowed cleartext HTTP, which Android release builds
// otherwise block.
const { withAndroidManifest } = require('expo/config-plugins');

function versionCodeFor(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version ?? '');
  if (!m) throw new Error(`app.json "version" must look like 1.2.3 (got ${version})`);
  const [major, minor, patch] = m.slice(1).map(Number);
  if (minor > 99 || patch > 99) throw new Error('minor and patch versions must be below 100');
  return major * 10000 + minor * 100 + patch;
}

function withCleartextTraffic(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) app.$['android:usesCleartextTraffic'] = 'true';
    return cfg;
  });
}

module.exports = ({ config }) => {
  const versioned = { ...config, android: { ...config.android, versionCode: versionCodeFor(config.version) } };
  const backend = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  if (!backend.startsWith('http://')) return versioned;
  const local = {
    ...versioned,
    name: `${config.name} Local`,
    android: { ...versioned.android, package: `${config.android.package}.local` },
    ios: { ...config.ios, bundleIdentifier: `${config.ios.bundleIdentifier}.local` },
  };
  return withCleartextTraffic(local);
};
