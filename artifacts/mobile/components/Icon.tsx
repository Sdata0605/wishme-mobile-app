import { Feather } from '@expo/vector-icons';
import React from 'react';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const iconMap = {
  home: 'home',
  phone: 'phone',
  'credit-card': 'credit-card',
  calendar: 'calendar',
  heart: 'heart',
  'shopping-bag': 'shopping-bag',
  'message-circle': 'message-circle',
  users: 'users',
  music: 'music',
  'music-2': 'music',
  image: 'image',
  star: 'star',
  video: 'video',
  briefcase: 'briefcase',
  mail: 'mail',
  zap: 'zap',
  search: 'search',
  'share-2': 'share-2',
  'trending-up': 'trending-up',
  gift: 'gift',
  bell: 'bell',
  sparkles: 'zap',
  settings: 'settings',
  'log-out': 'log-out',
  x: 'x',
  check: 'check',
  'check-circle': 'check-circle',
  circle: 'circle',
  'alert-circle': 'alert-circle',
  'arrow-left': 'arrow-left',
  'arrow-right': 'arrow-right',
  eye: 'eye',
  'eye-off': 'eye-off',
  lock: 'lock',
  menu: 'menu',
  sliders: 'sliders',
  'play-circle': 'play-circle',
  pause: 'pause',
  'volume-x': 'volume-x',
  'volume-2': 'volume-2',
  'edit-2': 'edit-2',
  key: 'key',
  'mail-check': 'check-circle',
  'phone-call': 'phone-call',
  mic: 'mic',
  camera: 'camera',
  upload: 'upload',
  plus: 'plus',
  minus: 'minus',
  'trash-2': 'trash-2',
  info: 'info',
  shield: 'shield',
  award: 'award',
  'bar-chart-2': 'bar-chart-2',
  wallet: 'credit-card',
  copy: 'copy',
  send: 'send',
} as const satisfies Record<string, FeatherName>;

export type IconName = keyof typeof iconMap;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 20, color = '#000' }: IconProps) {
  const featherName = iconMap[name];
  if (!featherName) return null;
  return <Feather name={featherName} size={size} color={color} />;
}
