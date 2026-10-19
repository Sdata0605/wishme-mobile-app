/**
 * Module hooks for scripts/assistantFlow.selfcheck.ts: they swap the phone-only packages (address book, Android
 * intents, React Native, the server) for fakes that record what the assistant asked of them, and leave every
 * other module real, so the assistant's own code (tools, phone actions, name matching, number checks) runs as is.
 */

const FAKES = {
  'expo-contacts': `
    export const Fields = { PhoneNumbers: 'phoneNumbers', Nickname: 'nickname' };
    export async function getPermissionsAsync() { return globalThis.__perm; }
    export async function requestPermissionsAsync() {
      globalThis.__asked = (globalThis.__asked ?? 0) + 1;
      if (globalThis.__permAfterAsk) globalThis.__perm = globalThis.__permAfterAsk;
      return globalThis.__perm;
    }
    // Like the real one: a "name" option is a plain, case-insensitive substring search on the display name.
    export async function getContactsAsync(options = {}) {
      const wanted = options.name?.toLowerCase();
      return { data: globalThis.__contacts.filter((c) => !wanted || c.name.toLowerCase().includes(wanted)) };
    }
  `,
  'expo-intent-launcher': `
    export async function startActivityAsync(action, params) {
      (globalThis.__intents ??= []).push({ action, ...params });
      if (globalThis.__notInstalled?.includes(params?.packageName)) throw new Error('ActivityNotFoundException');
      return new Promise(() => {}); // like Android: resolves only when the other app returns to us
    }
    export function openApplication(pkg) {
      (globalThis.__apps ??= []).push(pkg);
      // Like Android 11+: only packages the manifest <queries> lets the app see can be started this way.
      if (!globalThis.__visibleApps?.includes(pkg)) throw new Error('not visible to this app');
    }
  `,
  '@/modules/installed-apps': `export default globalThis.__nativeApps ?? null;`,
  'react-native': `
    export const Platform = { OS: 'android' };
    export const AppState = { currentState: 'active', addEventListener: () => ({ remove() {} }) };
    export const Linking = {
      openURL: async (url) => { (globalThis.__opened ??= []).push(url); },
      sendIntent: async (action) => { (globalThis.__sent ??= []).push(action); },
      openSettings: async () => { (globalThis.__opened ??= []).push('settings'); },
    };
    export const PermissionsAndroid = {
      PERMISSIONS: { CALL_PHONE: 'android.permission.CALL_PHONE' },
      RESULTS: { GRANTED: 'granted' },
      request: async () => 'granted',
    };
  `,
  '@react-native-async-storage/async-storage': `export default { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} };`,
  '@/constants/supabase': `
    export const SUPABASE_URL = 'https://example.invalid';
    export const SUPABASE_ANON_KEY = 'anon-test-key';
    export async function supabaseFetch(path, init) {
      (globalThis.__requests ??= []).push({ path, body: init?.body ? JSON.parse(init.body) : null });
      return { ok: true, status: 200, json: async () => ({ callId: 'call-1', status: 'queued' }) };
    }
  `,
  '@/components/all-services/hotelData': `export const HOTEL_CITIES = [];`,
  './uiTools': `
    export const UI_FUNCTION_DECLARATIONS = [];
    export async function runUiTool({ name }) { return name === 'read_screen' ? { ok: true, controls: [] } : null; }
  `,
  './hubTools': `export const HUB_FUNCTION_DECLARATIONS = []; export async function runHubTool() { return null; }`,
  './docTools': `export const DOC_FUNCTION_DECLARATIONS = []; export async function runDocTool() { return null; }`,
  './moreTools': `export const MORE_FUNCTION_DECLARATIONS = []; export async function runMoreTool() { return null; }`,
  './everydayTools': `export const EVERYDAY_FUNCTION_DECLARATIONS = []; export async function runEverydayTool() { return null; }`,
};

export async function resolve(specifier, context, next) {
  if (specifier in FAKES) return { url: `fake:${encodeURIComponent(specifier)}`, shortCircuit: true };
  try {
    return await next(specifier, context);
  } catch (error) {
    if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier)) return next(`${specifier}.ts`, context);
    throw error;
  }
}

export async function load(url, context, next) {
  if (url.startsWith('fake:')) {
    return { format: 'module', source: FAKES[decodeURIComponent(url.slice(5))], shortCircuit: true };
  }
  return next(url, context);
}
