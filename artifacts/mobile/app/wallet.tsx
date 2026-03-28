import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/Icon';
import { supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useWallet } from '@/hooks/useWallet';

const WALLET_TABS = ['Transactions', 'Referral Earnings'] as const;
type WalletTab = (typeof WALLET_TABS)[number];

const CREDIT_TYPES = new Set(['deposit', 'admin_credit', 'commission_earning', 'referral_commission']);

const STATUS_COLORS: Record<string, string> = {
  completed: '#22C55E',
  pending: '#F59E0B',
  failed: '#EF4444',
  rejected: '#EF4444',
};

const LEVEL_COLORS: Record<number, string> = { 1: '#FF6B33', 2: '#B44CFF' };

function fmtDate(iso: string) {
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

function txLabel(type: string, description?: string) {
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
    celebrity_subscription: 'Celebrity Subscription',
    plan_upgrade: 'Plan Upgrade',
    service_payment: 'Service Payment',
  };
  return map[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

type TxIconInfo = { name: IconName; color: string };

function txIconInfo(type: string): TxIconInfo {
  const map: Record<string, TxIconInfo> = {
    deposit: { name: 'trending-up', color: '#22C55E' },
    admin_credit: { name: 'trending-up', color: '#22C55E' },
    commission_earning: { name: 'trending-up', color: '#22C55E' },
    booking: { name: 'video', color: '#F97316' },
    ugc_video: { name: 'video', color: '#F97316' },
    music_generation: { name: 'music', color: '#A855F7' },
    music_download: { name: 'music', color: '#A855F7' },
    greeting_card_generation: { name: 'gift', color: '#EC4899' },
    referral_commission: { name: 'users', color: '#EC4899' },
    image_promotion: { name: 'image', color: '#3B82F6' },
    photo_wish: { name: 'image', color: '#06B6D4' },
    celebrity_call: { name: 'phone', color: '#EAB308' },
    voice_call: { name: 'phone', color: '#EAB308' },
    celebrity_subscription: { name: 'star', color: '#F59E0B' },
    plan_upgrade: { name: 'star', color: '#F59E0B' },
    service_payment: { name: 'shopping-bag', color: '#6366F1' },
  };
  return map[type] ?? { name: 'credit-card', color: '#6B7280' };
}

type ColorsType = ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors'];
type AuthUser = ReturnType<typeof import('@/context/AuthContext').useAuth>['user'];
type AuthSession = ReturnType<typeof import('@/context/AuthContext').useAuth>['session'];

interface TxItem {
  id: string;
  transaction_type: string;
  amount: number;
  status: string;
  description?: string;
  created_at: string;
  source?: string;
}

interface TxTabProps {
  colors: ColorsType;
  bottomPad: number;
  user: AuthUser;
  session: AuthSession;
}

function TransactionsTab({ colors, bottomPad, user, session }: TxTabProps) {
  const [items, setItems] = useState<TxItem[]>([]);
  const [paymentLookup, setPaymentLookup] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  const profileId = user?.profileId ?? '';

  useEffect(() => {
    if (!profileId || !session?.access_token) {
      setLoading(false);
      return;
    }

    Promise.all([
      supabaseFetch(
        `/rest/v1/wallet_transactions?user_id=eq.${profileId}&select=*&order=created_at.desc`,
        {},
        session.access_token,
      ).then(async (res) => {
        if (!res.ok) return [] as TxItem[];
        return ((await res.json()) as TxItem[]) ?? [];
      }).catch(() => [] as TxItem[]),

      supabaseFetch(
        `/rest/v1/referral_transactions?referrer_id=eq.${profileId}&select=*&order=created_at.desc`,
        {},
        session.access_token,
      ).then(async (res) => {
        if (!res.ok) return [] as TxItem[];
        const rows = (await res.json()) as Array<{
          id: string;
          commission_amount: number;
          status: string;
          created_at: string;
          booking_id?: string;
          [key: string]: unknown;
        }>;
        return (rows ?? []).map((r) => ({
          ...r,
          source: 'referral',
          transaction_type: 'referral_commission',
          amount: r.commission_amount ?? 0,
          status: r.status,
          description: r.booking_id ? `Referral – Booking #${String(r.booking_id).slice(0, 8)}` : 'Referral Bonus',
        } as TxItem));
      }).catch(() => [] as TxItem[]),

      supabaseFetch(
        `/rest/v1/payment_transactions?user_id=eq.${profileId}&select=wishme_payment_id,user_id,amount,paid_at&order=paid_at.desc`,
        {},
        session.access_token,
      ).then(async (res) => {
        if (!res.ok) return {} as Record<string, string>;
        const rows = (await res.json()) as Array<{ wishme_payment_id?: string; amount?: number }>;
        const lookup: Record<string, string> = {};
        for (const r of rows ?? []) {
          if (r.wishme_payment_id && r.amount != null) {
            const key = String(Math.abs(r.amount));
            if (!lookup[key]) lookup[key] = r.wishme_payment_id;
          }
        }
        return lookup;
      }).catch(() => ({} as Record<string, string>)),
    ]).then(([walletTxns, refTxns, lookup]) => {
      const merged: TxItem[] = [
        ...(walletTxns as TxItem[]).map((t) => ({ ...t, source: 'wallet' })),
        ...(refTxns as TxItem[]),
      ];
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setItems(merged);
      setPaymentLookup(lookup as Record<string, string>);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [profileId, session]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 }}>
        <ActivityIndicator color="#FF6B33" />
      </View>
    );
  }

  const filtered = search.trim()
    ? items.filter((tx) => {
        const wmId = paymentLookup[String(Math.abs(tx.amount))] ?? '';
        return wmId.toLowerCase().includes(search.toLowerCase().trim());
      })
    : items;

  const displayed = showAll ? filtered : filtered.slice(0, 10);

  return (
    <ScrollView
      contentContainerStyle={[styles.tabContent, { paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.searchWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Icon name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by WishMe Payment ID"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
          autoCapitalize="characters"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Icon name="x" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {!filtered.length ? (
        <View style={{ alignItems: 'center', paddingTop: 60 }}>
          <Icon name="credit-card" size={36} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {search ? 'No results found' : 'No transactions yet'}
          </Text>
        </View>
      ) : (
        <>
          {displayed.map((item) => {
            const isCredit = CREDIT_TYPES.has(item.transaction_type);
            const statusColor = STATUS_COLORS[item.status] ?? '#F59E0B';
            const iconInfo = txIconInfo(item.transaction_type);
            const wmId = paymentLookup[String(Math.abs(item.amount))];
            return (
              <View
                key={`${item.id}-${item.source}`}
                style={[styles.txRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[styles.txIconCircle, { backgroundColor: iconInfo.color + '20' }]}>
                  <Icon name={iconInfo.name} size={18} color={iconInfo.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.txTopRow}>
                    <Text style={[styles.txDesc, { color: colors.foreground }]}>
                      {txLabel(item.transaction_type, item.description)}
                    </Text>
                    <View style={[styles.typeBadge, { backgroundColor: isCredit ? '#22C55E20' : '#EF444420' }]}>
                      <Text style={[styles.typeBadgeText, { color: isCredit ? '#22C55E' : '#EF4444' }]}>
                        {isCredit ? 'Credit' : 'Debit'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.txBottomRow}>
                    <Text style={[styles.txDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                      <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
                    </View>
                  </View>
                  {wmId ? (
                    <Text style={[styles.wmId, { color: colors.mutedForeground }]}>{wmId}</Text>
                  ) : null}
                </View>
                <Text style={[styles.txAmt, { color: isCredit ? '#22C55E' : '#EF4444' }]}>
                  {isCredit ? '+' : '-'}₹{Math.abs(item.amount).toLocaleString('en-IN')}
                </Text>
              </View>
            );
          })}

          {filtered.length > 10 && (
            <TouchableOpacity
              onPress={() => setShowAll((v) => !v)}
              style={[styles.viewAllBtn, { borderColor: colors.border }]}
            >
              <Text style={[styles.viewAllText, { color: colors.primary }]}>
                {showAll ? 'Show Less' : `View All (${filtered.length})`}
              </Text>
              <Icon name={showAll ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
            </TouchableOpacity>
          )}
        </>
      )}
    </ScrollView>
  );
}

interface RefItem {
  id: string;
  referred_id?: string;
  booking_id?: string;
  commission_amount: number;
  commission_level?: number;
  order_type?: string;
  status: string;
  created_at: string;
}

interface RefTabProps {
  colors: ColorsType;
  bottomPad: number;
  user: AuthUser;
  session: AuthSession;
}

function ReferralEarningsTab({ colors, bottomPad, user, session }: RefTabProps) {
  const [items, setItems] = useState<RefItem[]>([]);
  const [loading, setLoading] = useState(true);

  const profileId = user?.profileId ?? '';

  useEffect(() => {
    if (!profileId || !session?.access_token) {
      setLoading(false);
      return;
    }
    supabaseFetch(
      `/rest/v1/referral_transactions?referrer_id=eq.${profileId}&select=*`,
      {},
      session.access_token,
    )
      .then(async (res) => {
        if (res.ok) {
          const rows = (await res.json()) as RefItem[];
          setItems(rows ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profileId, session]);

  const completed = items.filter((r) => r.status === 'completed');
  const pending = items.filter((r) => r.status === 'pending');
  const totalEarned = completed.reduce((s, r) => s + (r.commission_amount ?? 0), 0);
  const uniqueFriends = new Set(completed.map((r) => r.referred_id).filter(Boolean)).size;

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 }}>
        <ActivityIndicator color="#B44CFF" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.tabContent, { paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={['#7B2FFF', '#B44CFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.refEarningCard}
      >
        <Text style={styles.refEarningLabel}>Total Referral Earnings</Text>
        <Text style={styles.refEarningAmt}>₹{totalEarned.toLocaleString('en-IN')}</Text>
        <Text style={[styles.refEarningLabel, { marginTop: 4 }]}>Credited to wallet</Text>

        <View style={styles.refStatsRow}>
          <View style={styles.refStatItem}>
            <Text style={styles.refStatNumber}>{uniqueFriends}</Text>
            <Text style={styles.refStatLabel}>Friends</Text>
          </View>
          <View style={styles.refStatDivider} />
          <View style={styles.refStatItem}>
            <Text style={styles.refStatNumber}>{pending.length}</Text>
            <Text style={styles.refStatLabel}>Pending</Text>
          </View>
        </View>
      </LinearGradient>

      <TouchableOpacity
        style={styles.inviteBtn}
        onPress={() => router.push('/referrals' as never)}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['#FF6B33', '#B44CFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.inviteBtnGrad}
        >
          <Icon name="users" size={18} color="#fff" />
          <Text style={styles.inviteBtnText}>Invite Friends</Text>
        </LinearGradient>
      </TouchableOpacity>

      {!items.length ? (
        <View style={{ alignItems: 'center', paddingTop: 40 }}>
          <Icon name="users" size={36} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No referral earnings yet</Text>
        </View>
      ) : (
        items.map((item) => {
          const lvl = item.commission_level ?? 1;
          const lvlColor = LEVEL_COLORS[lvl] ?? '#FF6B33';
          const statusColor = STATUS_COLORS[item.status] ?? '#F59E0B';
          return (
            <View key={item.id} style={[styles.refRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <View style={styles.refTopRow}>
                  <Text style={[styles.txDesc, { color: colors.foreground }]}>
                    {item.booking_id ? `Booking #${String(item.booking_id).slice(0, 8)}` : 'Referral Bonus'}
                  </Text>
                  <View style={[styles.levelBadge, { backgroundColor: lvlColor + '20' }]}>
                    <Text style={[styles.levelText, { color: lvlColor }]}>L{lvl}</Text>
                  </View>
                </View>
                <View style={styles.txBottomRow}>
                  <Text style={[styles.txDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
                  </View>
                </View>
              </View>
              <Text style={[styles.txAmt, { color: '#22C55E' }]}>
                +₹{(item.commission_amount ?? 0).toLocaleString('en-IN')}
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

export default function WalletScreen() {
  const { colors } = useTheme();
  const { user, session } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = insets.top;
  const bottomPad = insets.bottom + 20;
  const [activeTab, setActiveTab] = useState<WalletTab>('Transactions');

  const { balance, refetch } = useWallet();

  useEffect(() => {
    refetch();
  }, [refetch]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Wallet</Text>
        <View style={{ width: 22 }} />
      </View>

      <LinearGradient
        colors={['#FF6B33', '#B44CFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <Text style={styles.heroBalanceLabel}>Total Balance</Text>
        <Text style={styles.heroBalanceAmt}>₹{balance.toLocaleString('en-IN')}</Text>
      </LinearGradient>

      <View style={[styles.tabBar, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        {WALLET_TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: activeTab === tab ? colors.primary : colors.mutedForeground },
                activeTab === tab && styles.tabLabelActive,
              ]}
            >
              {tab}
            </Text>
            {activeTab === tab && (
              <View style={[styles.tabUnderline, { backgroundColor: colors.primary }]} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'Transactions' && (
        <TransactionsTab colors={colors} bottomPad={bottomPad} user={user} session={session} />
      )}
      {activeTab === 'Referral Earnings' && (
        <ReferralEarningsTab colors={colors} bottomPad={bottomPad} user={user} session={session} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
    paddingVertical: 28,
  },
  heroBalanceLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    marginBottom: 6,
  },
  heroBalanceAmt: { color: '#fff', fontSize: 40, fontFamily: 'Inter_700Bold' },
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
});
