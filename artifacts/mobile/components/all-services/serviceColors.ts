/**
 * Shared palette for All Services screens — aligned with WishMe-UI brand
 * (orange primary + purple secondary) instead of the old Wish-Me purple hub look.
 */
export const serviceColors = {
  purple: '#FF6B33',
  purpleLight: '#E8527A',
  orange: '#FF8C42',
  green: '#22C55E',
  navy: '#B44CFF',
  darkBg: '#151921',
  white: '#FFFFFF',
  gray: '#6B7085',
  lightGray: '#EDEEF1',
  border: '#DCDFE5',
  text: '#151921',
  textLight: '#6B7085',
  pageBg: '#F5F6F8',
  soldIcon: '#9CA3AF',
  soldBg: '#F3F4F6',
  soldBorder: '#E5E7EB',
  pinkBg: '#FDF2F8',
  pinkBorder: '#FBCFE8',
  greenDark: '#15803D',
  blue: '#2563EB',
  blueLight: '#EFF6FF',
  pink: '#EC4899',
  red: '#EF4444',
  amber: '#D97706',
  amberLight: '#FEF3C7',
  greenLight: '#DCFCE7',
  dark: '#111827',
} as const;

export type ServiceColorKey = keyof typeof serviceColors;
