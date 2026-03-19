export const lightColors = {
  background: '#FFFFFF',
  backgroundSecondary: '#F5F6F8',
  foreground: '#151921',
  card: '#FFFFFF',
  primary: '#FF6B33',
  secondary: '#B44CFF',
  muted: '#EDEEF1',
  mutedForeground: '#6B7085',
  border: '#DCDFE5',
  input: '#E6E8EC',
  destructive: '#EF4444',
  sidebarBackground: '#F5F6F8',
  sidebarPrimary: '#FF6B33',
  sidebarAccent: '#EDEEF1',
  success: '#22C55E',
  warning: '#F59E0B',
};

export const darkColors = {
  background: '#1E283E',
  backgroundSecondary: '#253049',
  foreground: '#F0F1F4',
  card: '#1A2035',
  primary: '#FF7F4D',
  secondary: '#C266FF',
  muted: '#1F2940',
  mutedForeground: '#919199',
  border: '#252F47',
  input: '#1A2035',
  destructive: '#EF4444',
  sidebarBackground: '#171E30',
  sidebarPrimary: '#FF7F4D',
  sidebarAccent: '#1F2940',
  success: '#22C55E',
  warning: '#F59E0B',
};

export const gradients = {
  primary: ['#FF6B33', '#E8527A', '#B44CFF'] as const,
  primaryHorizontal: ['#FF6B33', '#B44CFF'] as const,
  purple: ['#B44CFF', '#7B2FFF', '#4B0082'] as const,
  orange: ['#FF6B33', '#FF8C42', '#FFB347'] as const,
  pinkPurple: ['#E8527A', '#B44CFF'] as const,
  bluePurple: ['#4B83FF', '#7B2FFF'] as const,
  hero: ['#FF6B33', '#E8527A', '#B44CFF'] as const,
};

export default {
  light: lightColors,
  dark: darkColors,
  gradients,
};
