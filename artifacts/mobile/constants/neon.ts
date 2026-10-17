/**
 * WishMe's design tokens: colours, radii, spacing and motion for light and dark. Every screen reads them through
 * useTheme() (`neon` directly, or `colors` / `gradients` derived from it in constants/colors.ts).
 */

// ─── colour maths ────────────────────────────────────────────────────────────

export type RGB = { r: number; g: number; b: number };
export type HSL = { h: number; s: number; l: number };

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const c = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

export function hexToHsl(hex: string): HSL {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

export function hslToHex({ h, s, l }: HSL): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return rgbToHex({ r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 });
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a), y = hexToRgb(b);
  return rgbToHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
}

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── the tokens ──────────────────────────────────────────────────────────────

export const radius = { sm: 12, md: 16, lg: 20, xl: 28, pill: 100 } as const;
export const spacing = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s7: 32, s8: 40 } as const;
export const motion = { fast: 180, med: 300, slow: 600 } as const;

export interface Neon {
  isDark: boolean;
  violet: string;
  cyan: string;
  pink: string;
  lime: string;
  bg: string;
  surface: string;
  surfaceHigh: string;
  success: string;
  warning: string;
  error: string;
  textHi: string;
  textLo: string;
  textDim: string;
  /** Ground colour for things painted in textHi (text on the primary button). */
  onInk: string;
  line: string;
  lineBright: string;
  accentA: string; // primary
  accentB: string; // people / promises
  accentC: string; // documents / data
  accentD: string; // money
  accentE: string; // calls
  accentF: string; // system
  gBrand: readonly [string, string];
  gVioletCyan: readonly [string, string];
  gPinkViolet: readonly [string, string];
  gCyanLime: readonly [string, string];
  gOrb: readonly [string, string, string, string];
  radius: typeof radius;
  spacing: typeof spacing;
  /** A tile gradient from ONE accent: the colour lifted, and the colour deepened. */
  tile: (c: string) => readonly [string, string];
  /** The secondary brand colour (purple): buttons and gradient partners. */
  blue: string;
  /** A card's fill. */
  glass: string;
  /** A glass card's outline. */
  cardBorder: string;
  /** The bottom dock's fill. */
  dock: string;
  /** The dark disc inside the mic ring. */
  orbDisc: string;
  /** Unselected tab icons and labels. */
  navIdle: string;
  /** The three wash stops of the page, top to bottom. */
  wash: readonly [string, string, string];
  /** Optional coloured pools behind the page (unused: WishMe keeps the page calm). */
  aurora: { blue: string; violet: string; magenta: string } | null;
}

/** WishMe's brand colours: the orange, pink and purple of the logo gradient, and the gold of a star. */
export const BRAND = {
  orange: '#FF6B33',
  pink: '#E8527A',
  purple: '#B44CFF',
  gold: '#FFC14D',
} as const;

/** The palette has one fixed seed (WishMe has no accent picker); kept for code that keys caches on it. */
export const BRAND_ACCENT = BRAND.orange;

const tile = (c: string) => {
  const h = hexToHsl(c);
  const deep = hslToHex({ h: h.h, s: clamp(h.s * 1.05, 0.3, 1), l: clamp(h.l * 0.62, 0.18, 0.55) });
  return [mix(c, '#FFFFFF', 0.16), deep] as const;
};

/**
 * The tokens for one theme: WishMe's own look.
 *
 * DARK is a warm night: a deep plum page with a quiet wash (no aurora), solid plum cards, the WishMe orange as the
 * primary, the brand gradient orange to purple, and star gold as the highlight. LIGHT is warm cream with the same
 * accents deepened for contrast on white. The token names are historical (`violet` is the primary, `cyan` the
 * highlight); their values are WishMe's.
 */
export function buildNeon(isDark: boolean): Neon {
  if (isDark) {
    const primary = '#FF7F4D';
    const pink = '#F06A8F';
    const purple = '#C27BFF';
    const gold = BRAND.gold;
    const bg = '#120A1E';
    return {
      isDark,
      violet: primary, cyan: gold, pink, lime: '#9BE15D', bg, surface: '#1C1230', surfaceHigh: '#261A3D',
      success: '#34D399',
      warning: '#FBBF24',
      error: '#F87171',
      textHi: '#FFFFFF',
      textLo: '#E4D9F2',
      textDim: '#A898BF',
      onInk: bg,
      line: 'rgba(255,214,235,0.12)',
      lineBright: 'rgba(255,214,235,0.22)',
      accentA: primary,
      accentB: pink,
      accentC: purple,
      accentD: gold,
      accentE: '#2FD58A',
      accentF: '#8E8CFF',
      gBrand: [BRAND.orange, BRAND.purple],
      gVioletCyan: [primary, gold],
      gPinkViolet: [pink, purple],
      gCyanLime: [gold, primary],
      gOrb: [BRAND.orange, BRAND.pink, BRAND.purple, BRAND.orange],
      radius,
      spacing,
      tile,
      blue: purple,
      glass: '#1C1230',
      cardBorder: '#33244D',
      dock: '#170E27',
      orbDisc: '#1C1230',
      navIdle: '#A898BF',
      wash: ['#1D1030', '#150C24', '#100819'],
      aurora: null,
    };
  }

  const primary = '#EA580C';
  const pink = '#DB2777';
  const purple = '#9333EA';
  const bg = '#FFF9F5';
  return {
    isDark,
    violet: primary, cyan: '#B45309', pink, lime: '#4D7C0F', bg, surface: '#FFFFFF', surfaceHigh: '#F8EEE7',
    success: '#16A34A',
    warning: '#D97706',
    error: '#DC2626',
    textHi: '#1F1724',
    textLo: '#5E5468',
    textDim: '#A096A8',
    onInk: bg,
    line: 'rgba(31,23,36,0.08)',
    lineBright: 'rgba(31,23,36,0.14)',
    accentA: primary,
    accentB: pink,
    accentC: purple,
    accentD: '#B45309',
    accentE: '#0F9D58',
    accentF: '#4F46E5',
    gBrand: [BRAND.orange, BRAND.purple],
    gVioletCyan: [primary, pink],
    gPinkViolet: [pink, purple],
    gCyanLime: ['#B45309', primary],
    gOrb: [BRAND.orange, BRAND.pink, BRAND.purple, BRAND.orange],
    radius,
    spacing,
    tile,
    blue: purple,
    glass: '#FFFFFF',
    cardBorder: 'rgba(31,23,36,0.10)',
    dock: '#FFFFFF',
    orbDisc: '#FFFFFF',
    navIdle: '#A096A8',
    wash: [mix(bg, BRAND.orange, 0.06), mix(bg, BRAND.pink, 0.03), bg],
    aurora: null,
  };
}

/** A soft tinted elevation, the light-theme "glow". */
export function glow(color: string, alpha = 0.22, blur = 24) {
  return {
    shadowColor: color,
    shadowOpacity: alpha,
    shadowRadius: blur,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  } as const;
}

export function cardShadow(isDark: boolean) {
  return {
    shadowColor: '#000',
    shadowOpacity: isDark ? 0.4 : 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: isDark ? 4 : 2,
  } as const;
}
