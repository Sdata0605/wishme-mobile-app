import { buildNeon, hexToHsl, withAlpha, type Neon } from '@/constants/neon';
import { useTheme } from '@/context/ThemeContext';

/**
 * The All Services screens were drawn light-only with fixed hex colours. Rather than rewrite 16k lines, every
 * colour that sits on a surface goes through T(colour, role): in light mode it is returned untouched, in dark mode
 * it becomes the matching WishMe dark colour. The role says what the colour is used for:
 *   bg      a fill: white cards, the page, grey chips, pastel tints (strong brand fills are left alone)
 *   border  a hairline or an outline
 *   fg      text, icons
 *   page    a screen's own background: transparent in dark, so the aurora behind every screen shows through
 * Stylesheets are built by a factory and cached per theme (see useThemedStyles), so a theme change re-themes everything.
 */
type Role = 'bg' | 'border' | 'fg' | 'page';

let cur: { isDark: boolean; neon: Neon } = { isDark: false, neon: buildNeon(false) };

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function expand(hex: string): string {
  return hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
}

/** The bright dark-mode token for a hue (degrees), used for coloured text and for tints. */
function hueToken(neon: Neon, h: number): string {
  if (h < 18 || h >= 340) return neon.error;
  if (h < 70) return neon.warning;
  if (h < 170) return neon.success;
  if (h < 200) return neon.cyan;
  if (h < 250) return neon.accentF;
  if (h < 300) return neon.violet;
  return neon.pink;
}

export function T(colour: string, role: Role): string {
  if (!cur.isDark || !HEX.test(colour)) return colour;
  const { neon } = cur;
  if (role === 'page') return 'transparent';
  const hex = expand(colour);
  const { h, s, l } = hexToHsl(hex);
  const neutral = s < 0.2;
  // Near-black inks (#151921, #111827, #0D0C35...) are slightly blue, so treat them as neutral ink, not as a hue.
  const ink = l <= 0.24;
  // The module's two brand colours: a strong orange and a strong purple.
  const brandOrange = s > 0.7 && h >= 20 && h < 60 && l >= 0.35 && l <= 0.62;
  const brandPurple = s > 0.5 && h >= 240 && h < 295 && l >= 0.4 && l <= 0.72;

  if (role === 'bg') {
    if (ink) return neon.glass; // a dark hero slab becomes glass over the aurora
    if (neutral) {
      if (l >= 0.985) return neon.surface; // white card
      if (hex.toLowerCase() === '#f5f6f8') return neon.bg; // the page
      if (l >= 0.88) return neon.surfaceHigh; // grey chip / input well
      if (l >= 0.78) return neon.lineBright; // inactive dots and tracks
      if (l <= 0.2) return neon.surfaceHigh; // the dark navy hero card
      return colour;
    }
    if (l >= 0.8) return withAlpha(hueToken(neon, h), l >= 0.93 ? 0.12 : 0.18); // pastel tint
    if (brandOrange) return neon.blue; // solid orange fill -> royal blue
    if (brandPurple) return neon.violet; // solid purple fill -> violet
    return colour;
  }
  if (role === 'border') {
    if (ink) return neon.cardBorder;
    if (neutral) return l >= 0.78 ? neon.line : colour;
    if (l >= 0.78) return withAlpha(hueToken(neon, h), 0.3);
    if (brandOrange) return neon.cyan; // a selected outline
    if (brandPurple) return neon.violet;
    return colour;
  }
  // fg
  if (ink) return neon.textHi;
  if (neutral) {
    if (l <= 0.3) return neon.textHi;
    if (l <= 0.6) return neon.textLo;
    if (l <= 0.85) return neon.textDim;
    return colour; // white text on a coloured fill stays white
  }
  if (brandOrange) return neon.cyan; // highlight text and icons
  if (brandPurple) return neon.violet;
  if (l < 0.55) return hueToken(neon, h); // dark green / amber / blue / red text, lifted to the bright token
  return colour;
}

const cache = new WeakMap<object, Map<string, unknown>>();

/** Builds a StyleSheet from `make` for the current theme, once per theme, and re-renders when the theme changes. */
export function useThemedStyles<S>(make: () => S): S {
  const { isDark, neon, accent } = useTheme();
  cur = { isDark, neon };
  const key = `${isDark ? 'd' : 'l'}:${accent}`;
  let byKey = cache.get(make);
  if (!byKey) { byKey = new Map(); cache.set(make, byKey); }
  let styles = byKey.get(key) as S | undefined;
  if (!styles) { styles = make(); byKey.set(key, styles); }
  return styles;
}

/** Pick by theme: dk(darkValue, lightValue). Works inside the style factories and inside components. */
export const dk = <V,>(dark: V, light: V): V => (cur.isDark ? dark : light);

/** The current theme's tokens, for style factories (which run after the theme is set). */
export const N = (): Neon => cur.neon;

/** A glass card: translucent navy fill, blue-violet outline, rounded. Nothing in light (the card keeps its own look). */
export function glass(r = 22) {
  return cur.isDark
    ? ({ backgroundColor: cur.neon.glass, borderColor: cur.neon.cardBorder, borderWidth: 1.5, borderRadius: r } as const)
    : ({} as const);
}

/** The sticky bottom bar in dark: the dock's fill, an outlined top edge, rounded top corners. */
export function dockBar() {
  return cur.isDark
    ? ({
        backgroundColor: cur.neon.dock,
        borderTopWidth: 1.5,
        borderTopColor: cur.neon.cardBorder,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
      } as const)
    : ({} as const);
}
