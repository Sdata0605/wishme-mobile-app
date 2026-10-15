import { router } from 'expo-router';
import type { IconName } from '@/components/Icon';

/** The three things a subscriber can order from a celebrity. Each one opens the app's own screen, with the celebrity already chosen. */
export type ServiceKey = 'wish' | 'ad' | 'video';

export const SERVICES: Record<ServiceKey, {
  /** Full name, as in the sidebar. */
  title: string;
  /** Tile label. */
  short: string;
  /** One word for the small buttons on a card. */
  compact: string;
  subtitle: string;
  emoji: string;
  icon: IconName;
  pathname: string;
}> = {
  wish: { title: 'Wish a Friend', short: 'Wish a Friend', compact: 'Wish', subtitle: 'Personalised video wish', emoji: '💜', icon: 'video', pathname: '/wish-friend' },
  ad: { title: 'UGC Ad', short: 'UGC Ad', compact: 'UGC', subtitle: 'Creator-style promo video for your brand', emoji: '🎬', icon: 'zap', pathname: '/ugc-ads' },
  video: { title: 'Image Promotion', short: 'Promotion', compact: 'Promo', subtitle: 'AI promo image for your brand', emoji: '🖼', icon: 'image', pathname: '/image-promotions' },
};

export const SERVICE_KEYS: ServiceKey[] = ['wish', 'ad', 'video'];

/** Opens the sidebar screen for this service with the celebrity preselected (read as the `celebrity` param). */
export function openCelebrityService(service: ServiceKey, celebrityId: string) {
  router.push({ pathname: SERVICES[service].pathname, params: { celebrity: celebrityId } } as never);
}
