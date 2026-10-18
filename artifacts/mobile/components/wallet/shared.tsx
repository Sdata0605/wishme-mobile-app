/**
 * Everything the wallet screen's parts have in common: the tab names, transaction labels/icons/colours, date
 * formatting, the auth and theme types, and the stylesheet. The two tabs and the two modal sheets live beside
 * this file.
 */
import { StyleSheet } from 'react-native';
import { type IconName } from '@/components/Icon';

export const WALLET_TABS = ['Transactions', 'Referral Earnings'] as const;

export type WalletTab = (typeof WALLET_TABS)[number];

export const CREDIT_TYPES = new Set(['deposit', 'admin_credit', 'commission_earning', 'referral_commission']);

export const STATUS_COLORS: Record<string, string> = {
  completed: '#22C55E',
  pending: '#F59E0B',
  failed: '#EF4444',
  rejected: '#EF4444',
};

export const LEVEL_COLORS: Record<number, string> = { 1: '#7B5CFA', 2: '#1F7BFF' };

export const QUICK_AMOUNTS = [100, 500, 1000, 2000, 5000];

export function generateWMId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'WM';
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

export function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
}

export function txLabel(type: string, description?: string) {
  if (description) return description;
  const map: Record<string, string> = {
    deposit: 'Wallet Top-up',
    admin_credit: 'Admin Credit',
    referral_commission: 'Referral Bonus',
    commission_earning: 'Commission Earned',
    refund: 'Refund',
    debit: 'Service Charge',
    withdrawal: 'Withdrawal',
    booking: 'Video Shoutout',
    music_generation: 'Music Generation',
    music_download: 'Music Download',
    greeting_card_generation: 'Greeting Card',
    image_promotion: 'Image Promotion',
    ugc_video: 'UGC Video',
    photo_wish: 'Photo Wish',
    celebrity_call: 'Celebrity Call',
    voice_call: 'Voice Call',
    voice_call_wish: 'AI Voice Call',
    celebrity_subscription: 'Celebrity Subscription',
    plan_upgrade: 'Plan Upgrade',
    service_payment: 'Service Payment',
  };
  return map[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

type TxIconInfo = { name: IconName; color: string };

export function txIconInfo(type: string): TxIconInfo {
  const map: Record<string, TxIconInfo> = {
    deposit: { name: 'trending-up', color: '#22C55E' },
    admin_credit: { name: 'trending-up', color: '#22C55E' },
    commission_earning: { name: 'trending-up', color: '#22C55E' },
    booking: { name: 'video', color: '#F97316' },
    ugc_video: { name: 'video', color: '#F97316' },
    music_generation: { name: 'music', color: '#7B5CFA' },
    music_download: { name: 'music', color: '#7B5CFA' },
    greeting_card_generation: { name: 'gift', color: '#EC4899' },
    referral_commission: { name: 'users', color: '#EC4899' },
    image_promotion: { name: 'image', color: '#1F7BFF' },
    photo_wish: { name: 'image', color: '#25DFFF' },
    celebrity_call: { name: 'phone', color: '#EAB308' },
    voice_call: { name: 'phone', color: '#EAB308' },
    voice_call_wish: { name: 'mic', color: '#EAB308' },
    celebrity_subscription: { name: 'star', color: '#F59E0B' },
    plan_upgrade: { name: 'star', color: '#F59E0B' },
    service_payment: { name: 'shopping-bag', color: '#7B5CFA' },
  };
  return map[type] ?? { name: 'credit-card', color: '#6B7280' };
}

export type ColorsType = ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors'];

export type AuthUser = ReturnType<typeof import('@/context/AuthContext').useAuth>['user'];

export type AuthSession = ReturnType<typeof import('@/context/AuthContext').useAuth>['session'];

export const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
  },
  heroBalanceLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    marginBottom: 6,
  },
  heroBalanceAmt: { color: '#fff', fontSize: 40, fontFamily: 'Inter_700Bold', marginBottom: 20 },
  heroActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  heroActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  heroActionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 14, position: 'relative' },
  tabItemActive: {},
  tabLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  tabLabelActive: { fontFamily: 'Inter_700Bold' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 8, right: 8, height: 2, borderRadius: 1 },
  tabContent: { padding: 16, gap: 12 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  txIconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  txTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  txBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  txDesc: { fontSize: 13, fontFamily: 'Inter_600SemiBold', flex: 1 },
  txDate: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  txAmt: { fontSize: 15, fontFamily: 'Inter_700Bold', minWidth: 60, textAlign: 'right' },
  wmId: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 4, fontVariant: ['tabular-nums'] },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  typeBadgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  statusText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  viewAllText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  refEarningCard: { borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 4 },
  refEarningLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: 'Inter_500Medium', marginBottom: 6 },
  refEarningAmt: { color: '#fff', fontSize: 38, fontFamily: 'Inter_700Bold' },
  refStatsRow: { flexDirection: 'row', marginTop: 16, gap: 24 },
  refStatItem: { alignItems: 'center' },
  refStatNumber: { color: '#fff', fontSize: 24, fontFamily: 'Inter_700Bold' },
  refStatLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 2 },
  refStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)', alignSelf: 'stretch' },
  inviteBtn: { borderRadius: 12, overflow: 'hidden' },
  inviteBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  inviteBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  refTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  levelBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  levelText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  emptyText: { marginTop: 12, fontSize: 14, fontFamily: 'Inter_400Regular' },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    marginBottom: 16,
  },
  modalBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  modalBalanceText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  modalLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  amtInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 4,
  },
  amtCurrency: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    marginRight: 6,
  },
  amtInput: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Inter_400Regular',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    marginTop: 6,
    marginBottom: 4,
  },
  payBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  payBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelLinkText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  centeredSection: {
    alignItems: 'center',
    paddingVertical: 24,
    width: '100%',
  },
  processingText: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 16,
  },
  processingSubText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginTop: 8,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
  },
  successSubText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginBottom: 8,
  },
  successAmt: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  infoIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
    marginBottom: 16,
  },
  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  supportBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  celebBalanceCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  celebBalanceAmt: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    marginTop: 4,
  },
  bankCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
    gap: 4,
  },
  bankName: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    marginTop: 4,
  },
  bankAcc: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    fontVariant: ['tabular-nums'],
  },
  bankIfsc: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  bankHolder: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  linkText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 4,
  },
});
