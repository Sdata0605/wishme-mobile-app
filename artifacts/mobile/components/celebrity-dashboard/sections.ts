import type { IconName } from '@/components/Icon';

/** One screen of the celebrity dashboard. The side bar lists them; each opens as its own full screen. */
export interface DashSection {
  key: string;
  label: string;
  icon: IconName;
  /** The colour of the section's icon tile in the side bar and its header. */
  accent: string;
  /** One line under the label in the side bar. */
  blurb: string;
  /** One line at the top of the section's screen: what this page is for. */
  purpose: string;
  group: 'Home' | 'Work' | 'Money' | 'Account';
}

export const BRAND_GRADIENT = ['#B026FF', '#FF2E88', '#FF5F1F'] as const;

export const DASH_SECTIONS: DashSection[] = [
  { key: 'overview', label: 'Overview', icon: 'home', accent: '#B026FF', blurb: 'Your day at a glance', purpose: 'What needs you today, and how you are doing.', group: 'Home' },
  { key: 'orders', label: 'Orders', icon: 'shopping-bag', accent: '#FF2E88', blurb: 'Wishes & promotions to make', purpose: 'Every order fans have placed with you.', group: 'Work' },
  { key: 'messages', label: 'Messages', icon: 'message-circle', accent: '#FF5F1F', blurb: 'Chat with your fans', purpose: 'Conversations with your fans.', group: 'Work' },
  { key: 'reviews', label: 'Reviews', icon: 'star', accent: '#F5B83D', blurb: 'What fans say about you', purpose: 'Ratings and reviews from your fans.', group: 'Work' },
  { key: 'content', label: 'Content', icon: 'image', accent: '#2EC4B6', blurb: 'Photos & media you upload', purpose: 'Photos and media that power your wishes.', group: 'Work' },
  { key: 'wallet', label: 'Wallet', icon: 'wallet', accent: '#22C55E', blurb: 'Balance, withdraw, earnings', purpose: 'Your balance, withdrawals and earnings.', group: 'Money' },
  { key: 'tds', label: 'TDS', icon: 'newspaper', accent: '#94A3B8', blurb: 'Tax deducted statements', purpose: 'Tax deducted on your earnings, by financial year.', group: 'Money' },
  { key: 'followers', label: 'Followers', icon: 'heart', accent: '#FF5C8A', blurb: 'People subscribed to you', purpose: 'How many fans have subscribed to you.', group: 'Account' },
  { key: 'profile', label: 'Profile', icon: 'user', accent: '#B026FF', blurb: 'Your details & bank', purpose: 'Your photo, bio, contact and payout details.', group: 'Account' },
];

export const GROUP_ORDER: DashSection['group'][] = ['Home', 'Work', 'Money', 'Account'];

export const sectionByKey = (key: string): DashSection => DASH_SECTIONS.find(s => s.key === key) ?? DASH_SECTIONS[0];
