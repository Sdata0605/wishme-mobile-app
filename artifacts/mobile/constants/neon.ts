/**
 * MYASSISTANT "Daylight" design system, ported 1:1 from lib/design/neon_tokens.dart.
 * Same names, same values, same derivations: light is paper-white with deep accents; dark is a violet-cast
 * near-black with bright accents. A user-chosen accent re-derives the whole family exactly as the Flutter app does.
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
  /** The royal blue of the aurora palette (buttons, the left of the gradient). */
  blue: string;
  /** A glass card's fill: translucent, so the aurora shows through. */
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
  /** The aurora's pools: blue, violet, magenta. Null in light, where the page stays calm. */
  aurora: { blue: string; violet: string; magenta: string } | null;
  /** The four stops of the light swoosh across the lower right of the dark page. */
  swoosh: readonly [string, string, string, string];
}

/**
 * The themes a user can pick in Settings → Appearance. Aurora (the default) shares the MyAssistant colours; Neon
 * Celebration, Electric Lime and Holi Neon are the WishMe design directions.
 */
export type ThemeId = 'light' | 'aurora' | 'neon' | 'lime' | 'holi';

export const THEMES: { id: ThemeId; name: string; blurb: string; swatches: readonly string[] }[] = [
  { id: 'aurora', name: 'Aurora', blurb: 'Royal navy with electric blue, violet and magenta', swatches: ['#0A1556', '#25DFFF', '#9473F5', '#E555FF'] },
  { id: 'light', name: 'Light', blurb: 'Bright and clean', swatches: ['#F7F7FB', '#A855F7', '#DB2777', '#0891B2'] },
  { id: 'neon', name: 'Neon Celebration', blurb: 'Plum night with neon orange, hot pink and gold', swatches: ['#12081F', '#FF5F1F', '#FF2E88', '#B026FF', '#FFD23F'] },
  { id: 'lime', name: 'Electric Lime', blurb: 'True black with fluoro lime, neon pink and violet', swatches: ['#07070C', '#C6FF00', '#FF2E97', '#7C4DFF'] },
  { id: 'holi', name: 'Holi Neon', blurb: 'Festival saffron, magenta, green and yellow', swatches: ['#1A0716', '#FF9F1C', '#FF1F8F', '#39FF14', '#FFE600'] },
];

export const DEFAULT_DARK_THEME: Exclude<ThemeId, 'light'> = 'aurora';

/**
 * One dark theme's fixed colours. `violet` is the primary (buttons, selection) and always takes white text;
 * `cyan` is the highlight (links, rings, special moments) and is read on the dark page; `blue` is the left of the
 * aurora and of custom-accent gradients.
 */
interface DarkPalette {
  violet: string;
  pink: string;
  blue: string;
  cyan: string;
  lime: string;
  bg: string;
  surface: string;
  surfaceHigh: string;
  textLo: string;
  textDim: string;
  /** The primary as r,g,b, for the hairlines. */
  lineRgb: string;
  brand: readonly [string, string];
  accents: readonly [string, string, string, string, string, string];
  glass: string;
  cardBorder: string;
  dock: string;
  orbDisc: string;
  wash: readonly [string, string, string];
  /** The page's colour pools, when they differ from blue / violet / pink. */
  aurora?: { blue: string; violet: string; magenta: string };
  swoosh: readonly [string, string, string, string];
}

const DARK: Record<Exclude<ThemeId, 'light'>, DarkPalette> = {
  // "Aurora", the MyAssistant colours: a deep royal-navy page with a blue pool top-left and a magenta swoosh
  // lower-right, glass cards outlined in blue-violet, a cyan highlight and a blue-to-magenta brand gradient.
  aurora: {
    violet: '#9473F5',
    pink: '#E555FF',
    blue: '#2A6BFF',
    cyan: '#25DFFF',
    lime: '#BDF64B',
    bg: '#0A1556',
    surface: '#0A1B50',
    surfaceHigh: '#10215E',
    textLo: '#C9DBFB',
    textDim: '#9EAFE2',
    lineRgb: '120,150,255',
    brand: ['#0264FF', '#CA00EF'],
    accents: ['#2B7BFF', '#D83BE0', '#12D3D9', '#F5A00F', '#0AF0A0', '#3B82FF'],
    glass: 'rgba(9,24,84,0.72)',
    cardBorder: '#2F3F9A',
    dock: '#0B1E53',
    orbDisc: '#14195C',
    wash: ['#18165B', '#0B1759', '#071048'],
    aurora: { blue: '#2A4BFF', violet: '#7B3CF0', magenta: '#FF2BD6' },
    swoosh: ['#3A7BFF', '#8A5CFF', '#E23CE8', '#FF7BE6'],
  },
  // "Neon Celebration": a deep plum night lit by neon orange, hot pink and electric purple, with glowing gold for the
  // special moments.
  neon: {
    violet: '#B026FF', // electric purple
    pink: '#FF2E88', // hot pink
    blue: '#FF5F1F', // neon orange
    cyan: '#FFD23F', // neon gold
    lime: '#BDF64B',
    bg: '#12081F', // plum night
    surface: '#1F0A31',
    surfaceHigh: '#2B0D43',
    textLo: '#D9C9FB',
    textDim: '#AE9ECF',
    lineRgb: '176,38,255',
    brand: ['#FF5F1F', '#FF2E88'],
    accents: ['#B026FF', '#FF2E88', '#FFD23F', '#FF5F1F', '#0AF0A0', '#C051FF'],
    glass: 'rgba(18,8,31,0.72)',
    cardBorder: '#3D1F5C',
    dock: '#1A0F2E',
    orbDisc: '#190A2A',
    wash: ['#280C3E', '#1B0A2C', '#12081F'],
    swoosh: ['#FF5F1F', '#B026FF', '#FF2E88', '#FFD23F'],
  },
  // "Electric Lime": true black with fluorescent lime, neon pink and electric violet. Lime is the highlight; violet
  // carries the buttons so their white text stays legible.
  lime: {
    violet: '#7C4DFF', // electric violet
    pink: '#FF2E97', // neon pink
    blue: '#7C4DFF',
    cyan: '#C6FF00', // fluoro lime
    lime: '#C6FF00',
    bg: '#07070C',
    surface: '#13131C',
    surfaceHigh: '#1D1D29',
    textLo: '#D2DBC8',
    textDim: '#9AA3A0',
    lineRgb: '198,255,0',
    brand: ['#7C4DFF', '#FF2E97'],
    accents: ['#7C4DFF', '#FF2E97', '#C6FF00', '#FFB347', '#4DF0A6', '#9B7BFF'],
    glass: 'rgba(7,7,12,0.74)',
    cardBorder: '#2A2F1C',
    dock: '#0B0B12',
    orbDisc: '#07070C',
    wash: ['#12160A', '#0B0C0D', '#07070C'],
    swoosh: ['#7C4DFF', '#FF2E97', '#C6FF00', '#7CFF4F'],
  },
  // "Holi Neon": India's festival colours as light, neon saffron, hot magenta, fluorescent green and electric yellow
  // on a deep magenta-black.
  holi: {
    violet: '#E0177D', // hot magenta, deep enough for white text
    pink: '#FF9F1C', // neon saffron
    blue: '#FF9F1C',
    cyan: '#FFE600', // electric yellow
    lime: '#39FF14', // fluoro green
    bg: '#1A0716',
    surface: '#2A0D24',
    surfaceHigh: '#3A1232',
    textLo: '#F2CFE2',
    textDim: '#C39AB4',
    lineRgb: '255,31,143',
    brand: ['#FF9F1C', '#FF1F8F'],
    accents: ['#FF1F8F', '#FF9F1C', '#FFE600', '#FF7A1C', '#39FF14', '#FF5FB0'],
    glass: 'rgba(26,7,22,0.72)',
    cardBorder: '#4A1840',
    dock: '#200A1C',
    orbDisc: '#1F0A1B',
    wash: ['#36101F', '#230A1D', '#1A0716'],
    swoosh: ['#FF9F1C', '#FF1F8F', '#FFE600', '#39FF14'],
  },
};

/**
 * The tokens for one theme and one (optional) user accent.
 *
 * The dark themes are the WishMe design directions (see DARK). LIGHT keeps the Daylight values. Choosing any accent
 * other than the default re-derives the primary / partner / brand gradient from it; the theme's page stays.
 */
export function buildNeon(theme: ThemeId, accent: string | null = DEFAULT_ACCENT): Neon {
  const isDark = theme !== 'light';
  const custom = !!accent && accent.toLowerCase() !== DEFAULT_ACCENT.toLowerCase();
  let accentPartner: string | null = null;
  let accentInk: string | null = null;
  if (custom) {
    const h = hexToHsl(accent!);
    // 22 degrees: a short analogous step keeps every gradient in the same family.
    accentPartner = hslToHex({
      h: (h.h + 22) % 360,
      s: clamp(h.s * 1.02, 0.35, 1),
      l: clamp(h.l + 0.04, 0.35, 0.8),
    });
    accentInk = hslToHex({ h: h.h, s: clamp(h.s * 1.05, 0.45, 1), l: clamp(h.l * 0.52, 0.24, 0.48) });
  }

  if (theme !== 'light') {
    const d = DARK[theme];
    const violet = custom ? accent! : d.violet;
    const pink = custom ? accentPartner! : d.pink;
    const blue = custom ? mix(accent!, d.blue, 0.5) : d.blue;
    const cyan = d.cyan;
    const [accentA, accentB, accentC, accentD, accentE, accentF] = d.accents;
    return {
      isDark,
      violet, cyan, pink, lime: d.lime, bg: d.bg, surface: d.surface, surfaceHigh: d.surfaceHigh,
      success: '#4DF0A6',
      warning: '#FFB347',
      error: '#FF8585',
      textHi: '#FFFFFF',
      textLo: d.textLo,
      textDim: d.textDim,
      onInk: d.bg,
      line: `rgba(${d.lineRgb},0.20)`,
      lineBright: `rgba(${d.lineRgb},0.36)`,
      accentA,
      accentB,
      accentC,
      accentD,
      accentE,
      accentF,
      gBrand: custom ? [violet, pink] : d.brand,
      gVioletCyan: [violet, cyan],
      gPinkViolet: [pink, violet],
      gCyanLime: [cyan, d.lime],
      gOrb: [violet, cyan, pink, violet],
      radius,
      spacing,
      tile: (c: string) => {
        const h = hexToHsl(c);
        const deep = hslToHex({ h: h.h, s: clamp(h.s * 1.05, 0.3, 1), l: clamp(h.l * 0.62, 0.18, 0.55) });
        return [mix(c, '#FFFFFF', 0.16), deep] as const;
      },
      blue,
      glass: d.glass,
      cardBorder: d.cardBorder,
      dock: d.dock,
      orbDisc: d.orbDisc,
      navIdle: d.textDim,
      wash: d.wash,
      aurora: d.aurora ?? { blue: d.blue, violet: d.violet, magenta: d.pink },
      swoosh: d.swoosh,
    };
  }

  const violet = custom ? accentInk! : '#A855F7';
  const cyan = '#0891B2';
  const pink = custom
    ? (() => {
        const p = hexToHsl(accentPartner!);
        return hslToHex({ ...p, l: clamp(p.l * 0.55, 0.26, 0.5) });
      })()
    : '#DB2777';
  const bg = '#F7F7FB';
  return {
    isDark,
    violet, cyan, pink, lime: '#65A30D', bg, surface: '#FFFFFF', surfaceHigh: '#EEEFF6',
    success: '#16A34A',
    warning: '#D97706',
    error: '#EF4444',
    textHi: '#1B1D28',
    textLo: '#585E70',
    textDim: '#9BA0B0',
    onInk: bg,
    line: 'rgba(20,22,39,0.08)',
    lineBright: 'rgba(20,22,39,0.14)',
    accentA: violet,
    accentB: pink,
    accentC: cyan,
    accentD: '#D97706',
    accentE: '#0F9D58',
    accentF: '#3B5BDB',
    gBrand: [violet, pink],
    gVioletCyan: [violet, cyan],
    gPinkViolet: [pink, violet],
    gCyanLime: [cyan, '#65A30D'],
    gOrb: [violet, cyan, pink, violet],
    radius,
    spacing,
    tile: (c: string) => {
      const h = hexToHsl(c);
      const deep = hslToHex({ h: h.h, s: clamp(h.s * 1.05, 0.3, 1), l: clamp(h.l * 0.62, 0.18, 0.55) });
      return [mix(c, '#FFFFFF', 0.16), deep] as const;
    },
    blue: '#2563EB',
    glass: 'rgba(255,255,255,0.92)',
    cardBorder: 'rgba(20,22,39,0.10)',
    dock: '#FFFFFF',
    orbDisc: '#FFFFFF',
    navIdle: '#9BA0B0',
    wash: [mix(bg, violet, 0.07), mix(bg, violet, 0.03), bg],
    aurora: null,
    swoosh: [violet, pink, cyan, pink],
  };
}

/** What everyone gets until they choose (Flutter: AccentController.defaultSeed). */
export const DEFAULT_ACCENT = '#C77DFF';

/** The swatches in Settings → Theme colour (Flutter: AccentController.swatches). */
export const ACCENT_CHOICES: { name: string; color: string }[] = [
  { name: 'Violet', color: '#C77DFF' },
  { name: 'Indigo', color: '#8B9CFF' },
  { name: 'Ocean', color: '#4FC3F7' },
  { name: 'Teal', color: '#3FE0C8' },
  { name: 'Mint', color: '#6EE7A8' },
  { name: 'Lime', color: '#BDF64B' },
  { name: 'Amber', color: '#FFC24B' },
  { name: 'Coral', color: '#FF8A65' },
  { name: 'Rose', color: '#FF7BA3' },
  { name: 'Magenta', color: '#FF6FD8' },
  { name: 'Crimson', color: '#FF6B6B' },
  { name: 'Slate', color: '#9FB3C8' },
];

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
