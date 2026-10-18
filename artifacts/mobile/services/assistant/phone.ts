/**
 * Phone-level actions for the assistant: open links, launch other apps, place calls.
 * Android first; iOS needs per-app URL schemes and always confirms calls itself.
 */

import * as Contacts from 'expo-contacts';
import * as IntentLauncher from 'expo-intent-launcher';
import { AppState, Linking, PermissionsAndroid, Platform } from 'react-native';
import { LAUNCH_HINTS } from './appCatalog';
import { ensureAppIndex, nativeApps, refreshInstalledApps } from './installedApps';
import { closestInstalled, matchApp, type AppTarget } from './installedAppMatch';
import { pickContacts } from './nameMatch';

let permissionDialogs = 0;

/**
 * True while Android's own permission dialog is on screen. The dialog makes WishMe look like it went to the
 * background, and the assistant shuts itself down when that lasts a few seconds, which used to cut the
 * conversation off in the middle of "call Rahul" the first time the contacts permission was asked for.
 */
export const isPermissionDialogOpen = () => permissionDialogs > 0;

async function whileAsking<T>(ask: () => Promise<T>): Promise<T> {
  permissionDialogs += 1;
  try {
    return await ask();
  } finally {
    permissionDialogs -= 1;
  }
}

/** How long to wait for an immediate "no such app" before assuming the launch worked. */
const LAUNCH_SETTLE_MS = 400;

/**
 * Starts an Android activity without waiting for it to finish. IntentLauncher resolves only when
 * the launched activity returns to us (a call or another app can take minutes), but we want to
 * answer straight away. A launch failure (app not installed) rejects almost instantly.
 */
export async function launchActivity(
  action: string,
  params: IntentLauncher.IntentLauncherParams,
): Promise<'launched' | 'failed'> {
  const launch = IntentLauncher.startActivityAsync(action, params).then(
    () => 'launched' as const,
    (e: unknown) => {
      if (__DEV__) console.log('[apps] intent failed:', (e as { code?: string; message?: string })?.code ?? (e as Error)?.message);
      return 'failed' as const;
    },
  );
  const settled = new Promise<'launched'>((resolve) => setTimeout(() => resolve('launched'), LAUNCH_SETTLE_MS));
  return Promise.race([launch, settled]);
}

// ─── Websites ────────────────────────────────────────────────────────────────

export async function openWebsite(input: { url?: string; searchQuery?: string }) {
  let target: string | null = null;

  if (input.url) {
    let url = input.url.trim();
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = `https://${url}`;
    // Only ever open web links — never intent:, file:, tel: or other schemes from speech.
    if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'Only http/https links can be opened.' };
    target = url;
  } else if (input.searchQuery) {
    target = `https://www.google.com/search?q=${encodeURIComponent(input.searchQuery.trim())}`;
  }
  if (!target) return { ok: false, error: 'No website or search text was given.' };

  try {
    await Linking.openURL(target);
    return { ok: true, opened: target };
  } catch {
    return { ok: false, error: 'Could not open the browser.' };
  }
}

// ─── Other apps ──────────────────────────────────────────────────────────────

const NEW_TASK = 0x10000000; // FLAG_ACTIVITY_NEW_TASK
const RESET_TASK_IF_NEEDED = 0x00200000; // FLAG_ACTIVITY_RESET_TASK_IF_NEEDED

/** The same app asked for twice (the quick-open and the model's own call, or a repeat after leaving) is opened once. */
let lastOpen: { label: string; at: number } | null = null;
const DUPLICATE_WINDOW_MS = 5000;

/** Said to the model after every successful launch: the user has already left, so more words or calls are wasted. */
const DONE = 'The app is already open on the phone. Do not call open_app again and say nothing more (at most "Done").';

/** For tests: forget the app that was just opened, so the next request is not taken for a repeat. */
export function forgetLastOpenedApp() {
  lastOpen = null;
}

export interface OpenAppOptions {
  /** Called once the app is known and about to be launched (the assistant lets go of the mic and speaker). */
  onLeave?: () => void;
  /** True when the user agreed to search the Play Store for an app that was not found. */
  playStore?: boolean;
}

/** Where the phone's own default app for a role opens from a plain link: these cannot jam the way an activity result can. */
const ROLE_URLS: Record<string, () => string[]> = {
  Contacts: () => ['content://contacts/people/', 'content://com.android.contacts/contacts'],
  Phone: () => ['tel:'],
  Messages: () => ['sms:'],
  Gallery: () => ['content://media/external/images/media'],
  Calendar: () => [`content://com.android.calendar/time/${Date.now()}`],
  Email: () => ['mailto:'],
  Browser: () => ['https://www.google.com'],
};

/**
 * Starts one app. It tries, in order and stopping at the first that works: the native module (by package or by what the
 * app does), a plain link to the phone's default app for that role, a plain system intent, and the older ways that do
 * not need the native module (the app's own launcher, its launcher activity by name, its deep-link scheme).
 * Never pass a package without an activity to startActivityAsync: expo-intent-launcher ignores the package then, and Android
 * picks whatever app it likes (which is how "open Expo" once opened YouTube).
 */
async function launchTarget(t: AppTarget): Promise<boolean> {
  if (nativeApps) {
    if (t.pkg && (t.installed || !t.intent)) {
      try {
        if (await nativeApps.launchApp(t.pkg, t.activity ?? null)) return true;
      } catch {
        // fall through to the next way
      }
    }
    if (t.intent) {
      try {
        const ok = await nativeApps.launchIntent(
          t.intent.category ? { action: t.intent.action, selectorCategory: t.intent.category } : { action: t.intent.action },
        );
        if (ok) return true;
      } catch {
        // fall through
      }
      try {
        const pkg = t.label === 'Messages' ? await nativeApps.getDefaultSmsPackage() : t.label === 'Phone' ? await nativeApps.getDefaultDialerPackage() : null;
        if (pkg && (await nativeApps.launchApp(pkg, null))) return true;
      } catch {
        // fall through
      }
    }
  }

  for (const url of ROLE_URLS[t.label]?.() ?? []) {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      // no app handles it
    }
  }

  if (t.intent) {
    if (!t.intent.category) {
      try {
        await Linking.sendIntent(t.intent.action);
        return true;
      } catch {
        // fall through
      }
    }
    const r = await launchActivity(t.intent.action, { category: t.intent.category, flags: NEW_TASK });
    if (r === 'launched') return true;
  }

  if (t.pkg) {
    const hint = LAUNCH_HINTS[t.pkg];
    for (const pkg of [t.pkg, ...(hint?.alts ?? [])]) {
      try {
        IntentLauncher.openApplication(pkg);
        return true;
      } catch {
        // not visible to us, or not installed: try the next way
      }
    }
    const activity = t.activity ?? hint?.activity;
    if (activity) {
      const r = await launchActivity('android.intent.action.MAIN', {
        packageName: t.pkg,
        className: activity,
        category: 'android.intent.category.LAUNCHER',
        flags: NEW_TASK | RESET_TASK_IF_NEEDED,
      });
      if (r === 'launched') return true;
    }
    if (hint?.scheme) {
      try {
        await Linking.openURL(hint.scheme);
        return true;
      } catch {
        // no app handles it
      }
    }
  }
  return false;
}

/**
 * Opens an app on the phone by the name the user said, without asking anything. When the native module is in the build it
 * reads the phone's real list of installed apps, so any app that is on the phone opens (ChatGPT, a bank, a game...);
 * before that, the catalogue in appCatalog.ts covers the popular ones.
 */
export async function openApp(name: string, opts: OpenAppOptions = {}) {
  if (Platform.OS !== 'android') {
    return { ok: false, error: 'Opening other apps is only supported on Android for now.' };
  }
  const query = name.trim();

  if (opts.playStore) {
    opts.onLeave?.();
    try {
      await Linking.openURL(`market://search?q=${encodeURIComponent(query)}`);
      return { ok: true, opened: 'the Play Store search' };
    } catch {
      return { ok: false, error: "I couldn't open the Play Store." };
    }
  }

  let idx = await ensureAppIndex();
  let ranked = matchApp(query, idx);
  if (!ranked.length && nativeApps) {
    // The app may have been installed a moment ago: read the phone's list again before giving up.
    idx = await refreshInstalledApps(true);
    ranked = matchApp(query, idx);
  }
  if (!ranked.length) {
    const loose = closestInstalled(query, idx);
    // One installed app is plainly the one meant (a recogniser's spelling of it): open it rather than ask.
    if (loose.length && loose[0].score >= 80 && (loose.length === 1 || loose[0].score - loose[1].score >= 10)) {
      ranked = [loose[0]];
    } else {
      return {
        ok: false,
        not_found: true,
        error: idx.hasInstalled ? `No app called "${query}" is installed on this phone.` : `I don't know an app called "${query}".`,
        ...(loose.length ? { closest_installed: loose.slice(0, 5).map((m) => m.target.label) } : {}),
        instruction:
          'If one of closest_installed is plainly the app the user meant, call open_app again at once with that exact name, without asking. Otherwise say in one short sentence that you could not find that app, and ask whether to search the Play Store for it. If they say yes, call open_app again with play_store=true.',
      };
    }
  }

  const top = ranked[0];
  // The phone's list is known and this app is not on it (only a catalogue entry matched): say so honestly.
  if (idx.hasInstalled && !top.target.installed && !top.target.intent) {
    return {
      ok: false,
      not_installed: true,
      error: `${top.target.label} is not installed on this phone.`,
      instruction: 'Tell the user in one short sentence that it is not installed, and ask whether to search the Play Store for it. If they say yes, call open_app again with play_store=true.',
    };
  }

  const now = Date.now();
  if (lastOpen && lastOpen.label === top.target.label && (now - lastOpen.at < DUPLICATE_WINDOW_MS || AppState.currentState !== 'active')) {
    return { ok: true, opened: top.target.label, instruction: DONE };
  }
  lastOpen = { label: top.target.label, at: now };
  opts.onLeave?.();

  for (const m of ranked.filter((r) => r.score >= top.score - 5).slice(0, 3)) {
    if (await launchTarget(m.target)) return { ok: true, opened: m.target.label, instruction: DONE };
  }

  // Nothing started it. Read the phone's list again (it may have changed), and as the very last resort show its store page.
  if (nativeApps) void refreshInstalledApps(true);
  if (top.target.pkg) {
    try {
      await Linking.openURL(`market://details?id=${top.target.pkg}`);
      return {
        ok: false,
        opened_store: true,
        error: `I couldn't start ${top.target.label} directly, so I opened its Play Store page. If it is installed, tap Open there.`,
      };
    } catch {
      // fall through
    }
  }
  return { ok: false, error: `I couldn't open ${top.target.label}.` };
}

// ─── Calls ───────────────────────────────────────────────────────────────────

export interface ContactMatch {
  name: string;
  number: string;
}

const cleanNumber = (n: string) => n.replace(/[^\d+]/g, '');

export interface ContactLookup {
  matches: ContactMatch[];
  error?: string;
  /** True when contacts are blocked, so the assistant can ask for the number instead. */
  permissionDenied?: boolean;
  /** False once Android stops showing the permission dialog: only Settings can turn it back on. */
  canAskAgain?: boolean;
}

/** Opens this app's own page in the phone's settings, where Contacts can be switched back on. */
export async function openAppSettings() {
  try {
    await Linking.openSettings();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: 'Could not open the settings screen.' };
  }
}

interface StoredContact {
  name: string;
  nickname?: string;
  numbers: { number: string; mobile: boolean }[];
}

/** The whole address book, kept for a minute: a call needs one lookup, and re-reading thousands of contacts is slow. */
let contactCache: { at: number; list: StoredContact[] } | null = null;
/** Reading a big address book blocks the app for a moment, so it is kept for a while (a miss re-reads it once, below). */
const CONTACT_CACHE_MS = 10 * 60_000;

const contactsFresh = () => !!contactCache && Date.now() - contactCache.at < CONTACT_CACHE_MS;

async function loadContacts(force = false): Promise<StoredContact[]> {
  if (!force && contactCache && contactsFresh()) return contactCache.list;
  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Nickname],
  });
  const list: StoredContact[] = [];
  for (const c of data) {
    const numbers = (c.phoneNumbers ?? [])
      .filter((p) => p.number)
      .map((p) => ({
        number: cleanNumber(p.number!),
        mobile: !!p.isPrimary || /mobile|cell|main/i.test(p.label ?? ''),
      }))
      .filter((p) => p.number.length >= 3);
    if (c.name && numbers.length) list.push({ name: c.name, nickname: c.nickname || undefined, numbers });
  }
  contactCache = { at: Date.now(), list };
  return list;
}

/**
 * Reads the address book ahead of time so "call Rahul" does not wait for it. Never shows a permission dialog:
 * if contacts are not allowed yet, the lookup asks at the moment it is actually needed.
 */
export async function warmContacts() {
  try {
    if ((await Contacts.getPermissionsAsync()).granted) await loadContacts();
  } catch {
    /* the real lookup will report any problem */
  }
}

/**
 * Finds contacts by the name the user said. The name may come back from speech recognition in any script
 * ("राहुल", "ರಾಹುಲ್") while the contact is saved as "Rahul", so matching is by sound, not by letters (nameMatch.ts).
 */
export async function findContacts(query: string): Promise<ContactLookup> {
  // Checking first means an already-granted permission never shows a dialog, and a permanently
  // denied one is reported as such instead of silently doing nothing.
  let perm = await Contacts.getPermissionsAsync();
  if (!perm.granted && perm.canAskAgain) perm = await whileAsking(() => Contacts.requestPermissionsAsync());
  if (!perm.granted) {
    return {
      matches: [],
      permissionDenied: true,
      canAskAgain: perm.canAskAgain,
      error: perm.canAskAgain
        ? 'The contacts permission was not granted.'
        : 'Contacts are blocked for WishMe in the phone settings.',
    };
  }

  let contacts: StoredContact[];
  const wasCached = contactsFresh();
  try {
    contacts = await loadContacts();
    let matches = pickContacts(query, contacts);
    // Someone saved a minute ago is not in the kept list: look again once before saying there is no such contact.
    if (!matches.length && wasCached) {
      contacts = await loadContacts(true);
      matches = pickContacts(query, contacts);
    }
    return { matches };
  } catch {
    return { matches: [], error: 'The contacts could not be read.' };
  }
}

/** Places the call. On Android with the call permission it dials straight away, otherwise it opens the dialer. */
export async function placeCall(number: string) {
  const num = cleanNumber(number);
  if (num.length < 3) return { ok: false, error: 'That phone number looks invalid.' };

  if (Platform.OS === 'android') {
    try {
      const granted = await whileAsking(() => PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CALL_PHONE));
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        const result = await launchActivity('android.intent.action.CALL', {
          data: `tel:${num}`,
          flags: 0x10000000,
        });
        if (result === 'launched') return { ok: true, calling: num };
      }
    } catch {
      /* fall through to the dialer */
    }
  }
  try {
    await Linking.openURL(`tel:${num}`);
    return { ok: true, calling: num, note: 'Opened the dialer; press call to connect.' };
  } catch {
    return { ok: false, error: 'Could not start the call.' };
  }
}
