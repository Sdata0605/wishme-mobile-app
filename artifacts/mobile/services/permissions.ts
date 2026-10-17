/**
 * One place to read and request the OS permissions the app needs.
 *
 * Nothing in here throws. A permission we cannot read — a missing native module, a platform that
 * has no such concept, a development build without the right entitlement — comes back as
 * 'unsupported' instead, because a failed check must never be able to stop someone using the app.
 *
 * Deliberately absent: CALL_PHONE and anything call-recording related. Android does not let apps
 * record calls at all, and the dialer permission is asked for in context, at the moment the
 * assistant actually places a call, rather than up front.
 */

import { Camera } from 'expo-camera';
import * as Contacts from 'expo-contacts';
import * as MediaLibrary from 'expo-media-library';
import * as Notifications from 'expo-notifications';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { Linking, Platform } from 'react-native';
import { ensureChannels } from '@/services/notifications';

export type PermissionKind =
  | 'microphone'
  | 'speechRecognition'
  | 'contacts'
  | 'camera'
  | 'mediaLibrary'
  | 'notifications';

export type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export interface PermissionState {
  kind: PermissionKind;
  status: PermissionStatus;
  granted: boolean;
  /**
   * False once the OS will no longer show its own dialog. The only way forward then is the system
   * settings app, so the UI must offer that instead of another Allow button.
   */
  canAskAgain: boolean;
}

export type PermissionStates = Record<PermissionKind, PermissionState>;

export const PERMISSION_KINDS: readonly PermissionKind[] = [
  'microphone',
  'speechRecognition',
  'contacts',
  'camera',
  'mediaLibrary',
  'notifications',
];

/** The shape every Expo permission module returns; narrowed so one adapter covers them all. */
interface RawResponse {
  status: string;
  granted: boolean;
  canAskAgain: boolean;
}

interface Probe {
  /** Whether asking makes any sense on this platform. */
  supported: () => boolean;
  read: () => Promise<RawResponse>;
  ask: () => Promise<RawResponse>;
}

const native = () => Platform.OS === 'ios' || Platform.OS === 'android';

const PROBES: Record<PermissionKind, Probe> = {
  // Covers both the assistant's recogniser and the two-way audio engine: one RECORD_AUDIO grant.
  microphone: {
    supported: native,
    read: () => ExpoSpeechRecognitionModule.getMicrophonePermissionsAsync(),
    ask: () => ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync(),
  },
  // iOS treats speech recognition as a separate grant; Android folds it into the microphone.
  speechRecognition: {
    supported: () => Platform.OS === 'ios',
    read: () => ExpoSpeechRecognitionModule.getSpeechRecognizerPermissionsAsync(),
    ask: () => ExpoSpeechRecognitionModule.requestSpeechRecognizerPermissionsAsync(),
  },
  contacts: {
    supported: native,
    read: () => Contacts.getPermissionsAsync(),
    ask: () => Contacts.requestPermissionsAsync(),
  },
  camera: {
    supported: native,
    read: () => Camera.getCameraPermissionsAsync(),
    ask: () => Camera.requestCameraPermissionsAsync(),
  },
  mediaLibrary: {
    supported: native,
    read: () => MediaLibrary.getPermissionsAsync(),
    ask: () => MediaLibrary.requestPermissionsAsync(),
  },
  // Reminders are local notifications, so without this none of them can alert the user.
  notifications: {
    supported: native,
    read: () => Notifications.getPermissionsAsync(),
    // Android 13+ only shows its dialog once a notification channel exists.
    ask: async () => {
      await ensureChannels();
      return Notifications.requestPermissionsAsync();
    },
  },
};

const unsupported = (kind: PermissionKind): PermissionState => ({
  kind,
  status: 'unsupported',
  granted: false,
  canAskAgain: false,
});

const adapt = (kind: PermissionKind, raw: RawResponse): PermissionState => ({
  kind,
  status: raw.granted ? 'granted' : raw.status === 'undetermined' ? 'undetermined' : 'denied',
  granted: raw.granted,
  canAskAgain: raw.canAskAgain,
});

async function run(kind: PermissionKind, action: 'read' | 'ask'): Promise<PermissionState> {
  const probe = PROBES[kind];
  if (!probe.supported()) return unsupported(kind);
  try {
    return adapt(kind, await probe[action]());
  } catch {
    return unsupported(kind);
  }
}

/** Whether this permission is worth showing the user on this platform. */
export function isSupported(kind: PermissionKind): boolean {
  try {
    return PROBES[kind].supported();
  } catch {
    return false;
  }
}

/** Reads one permission without ever showing a dialog. */
export function getPermissionState(kind: PermissionKind): Promise<PermissionState> {
  return run(kind, 'read');
}

/** Reads every permission at once, for a screen that lists them all. */
export async function getPermissionStates(): Promise<PermissionStates> {
  const states = await Promise.all(PERMISSION_KINDS.map((kind) => getPermissionState(kind)));
  return states.reduce((acc, state) => {
    acc[state.kind] = state;
    return acc;
  }, {} as PermissionStates);
}

/** Shows the OS dialog for one permission and reports where things ended up. */
export function request(kind: PermissionKind): Promise<PermissionState> {
  return run(kind, 'ask');
}

/** Opens this app's page in the system settings, for permissions the OS will no longer ask about. */
export async function openSettings(): Promise<boolean> {
  try {
    await Linking.openSettings();
    return true;
  } catch {
    return false;
  }
}

/** True when the OS has stopped asking, so only the settings app can change this one. */
export const isBlocked = (state: PermissionState): boolean =>
  state.status === 'denied' && !state.canAskAgain;
