import { buildNeon, type Neon } from '@/constants/neon';

export const COLORS = {
  background: '#1B0829',
  surface: '#260D38',
  primary: '#B42BFF',
  text: '#FFFFFF',
  secondaryText: '#D0C4DA',
};

/**
 * The app's colours now come from the MyAssistant "Daylight" design system (constants/neon.ts).
 * The names below are the app's existing ones, remapped, so every screen that already reads
 * `colors.primary`, `colors.card` and the rest follows the new palette without being touched.
 * New code should prefer `neon` (from useTheme) for the full token set.
 */
export function makeColors(n: Neon) {
  return {
    background: n.bg,
    backgroundSecondary: n.surfaceHigh,
    foreground: n.textHi,
    card: n.surface,
    primary: n.violet,
    secondary: n.cyan,
    muted: n.surfaceHigh,
    mutedForeground: n.textLo,
    border: n.line,
    input: n.surfaceHigh,
    destructive: n.error,
    sidebarBackground: n.surface,
    sidebarPrimary: n.violet,
    sidebarAccent: n.surfaceHigh,
    success: n.success,
    warning: n.warning,
  };
}

export function makeGradients(n: Neon) {
  // Dark is the aurora: royal blue through violet into magenta. Light keeps the violet / partner / cyan family.
  const hero = n.isDark ? ([n.gBrand[0], n.violet, n.gBrand[1]] as const) : ([n.violet, n.pink, n.cyan] as const);
  return {
    primary: hero,
    primaryHorizontal: n.gBrand,
    purple: n.isDark ? ([n.blue, n.violet, n.pink] as const) : ([n.violet, n.pink, n.accentF] as const),
    orange: [n.accentD, n.pink, n.violet] as const,
    pinkPurple: [n.pink, n.violet] as const,
    bluePurple: [n.accentF, n.violet] as const,
    hero,
    assistant: [n.cyan, n.accentF, n.violet] as const,
  };
}

const lightNeon = buildNeon('light');
const darkNeon = buildNeon('aurora');

export const lightColors = makeColors(lightNeon);
export const darkColors = makeColors(darkNeon);
export const gradients = makeGradients(lightNeon);

/**
 * Accents for the big choice cards in assistant setup and the permissions screen. These are mid
 * tones on purpose: they stay legible as text on a light card and as text on a dark one, so a
 * single value works for both themes.
 */
export const choiceAccents = {
  orange: '#D97706',
  pink: '#DB2777',
  purple: '#A855F7',
  blue: '#3B5BDB',
  cyan: '#0891B2',
  green: '#16A34A',
  amber: '#F59E0B',
} as const;

export type ChoiceAccent = (typeof choiceAccents)[keyof typeof choiceAccents];

/** Two-stop gradients matched to the accents above, for icon tiles and avatars. */
export const choiceGradients: readonly (readonly [string, string])[] = [
  ['#D97706', '#DB2777'],
  ['#A855F7', '#7C3AED'],
  ['#3B5BDB', '#0891B2'],
  ['#16A34A', '#65A30D'],
  ['#F59E0B', '#D97706'],
  ['#DB2777', '#A855F7'],
];

export default {
  light: lightColors,
  dark: darkColors,
  gradients,
};
