/**
 * Makes every Alert.alert in the app dismissible with hardware Back and a tap outside.
 *
 * React Native sends `cancelable: false` to Android unless the caller passes otherwise, so an
 * informational alert swallowed Back and every other tap until OK was pressed — the QA audit lost
 * ten consecutive actions to one (H-03). Patching the default here fixes all call sites at once,
 * including future ones; a destructive confirmation can still opt out with `{ cancelable: false }`.
 *
 * Imported for its side effect by app/_layout.tsx, before any screen can raise an alert.
 */
import { Alert, type AlertButton, type AlertOptions } from 'react-native';

const show = Alert.alert;

Alert.alert = (title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) =>
  show(title, message, buttons, { cancelable: true, ...options });
