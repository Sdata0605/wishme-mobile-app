// Layered over app.json. Production builds are unchanged. When the app is built against a plain-http backend
// (a local WishMe backend, e.g. EXPO_PUBLIC_SUPABASE_URL=http://localhost:3000 with `adb reverse tcp:3000 tcp:3000`),
// it becomes a separate "WishMe Local" app that installs next to the store build, and is allowed cleartext HTTP,
// which Android release builds otherwise block.
const { withAndroidManifest } = require('expo/config-plugins');

function withCleartextTraffic(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) app.$['android:usesCleartextTraffic'] = 'true';
    return cfg;
  });
}

module.exports = ({ config }) => {
  const backend = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  if (!backend.startsWith('http://')) return config;
  const local = {
    ...config,
    name: `${config.name} Local`,
    android: { ...config.android, package: `${config.android.package}.local` },
    ios: { ...config.ios, bundleIdentifier: `${config.ios.bundleIdentifier}.local` },
  };
  return withCleartextTraffic(local);
};
