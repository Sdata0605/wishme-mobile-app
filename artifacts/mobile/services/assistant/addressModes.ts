import type { AddressMode } from '@/context/AuthContext';

/** Where the user changes the choice later. Keep in step with the drawer and the Settings screens. */
export const ADDRESS_SETTINGS_PATH = 'Menu (\u2630) > Settings > AI Assistant > How I address you';

export const ADDRESS_OPTIONS: { key: AddressMode; label: string; helper?: string; saved: string }[] = [
  { key: 'sir', label: 'Sir', saved: 'Sir' },
  { key: 'madam', label: "Ma'am", saved: "Ma'am" },
  {
    key: 'voice',
    label: 'Decide by my voice',
    helper: 'I\u2019ll say just \u201cHello\u201d, listen to you, then pick sir or ma\u2019am for that chat.',
    saved: 'sir or ma\u2019am, decided from your voice in each conversation',
  },
];

/** The dialog shown right after the user picks one. */
export function savedMessage(mode: AddressMode): string {
  const o = ADDRESS_OPTIONS.find((x) => x.key === mode)!;
  return `Saved for this account. I\u2019ll address you as ${o.saved} from now on.\n\nTo change it later, go to ${ADDRESS_SETTINGS_PATH}.`;
}

/** Short form for the Settings list ("Sir", "Ma'am", "By voice"). */
export const addressShort = (mode?: AddressMode): string => (mode === 'sir' ? 'Sir' : mode === 'madam' ? "Ma'am" : mode === 'voice' ? 'By voice' : 'Not set');
