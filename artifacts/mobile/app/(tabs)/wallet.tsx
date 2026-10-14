import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/Icon';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useAgentPrefill } from '@/context/AgentStateContext';
import { useWallet } from '@/hooks/useWallet';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

const WALLET_TABS = ['Transactions', 'Referral Earnings'] as const;
type WalletTab = (typeof WALLET_TABS)[number];

const CREDIT_TYPES = new Set(['deposit', 'admin_credit', 'commission_earning', 'referral_commission']);

const STATUS_COLORS: Record<string, string> = {
  completed: '#22C55E',
  pending: '#F59E0B',
  failed: '#EF4444',
  rejected: '#EF4444',
};

const LEVEL_COLORS: Record<number, string> = { 1: '#7B5CFA', 2: '#1F7BFF' };

const QUICK_AMOUNTS = [100, 500, 1000, 2000, 5000];

function generateWMId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'WM';
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

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
    voice_call_wish: 'AI Voice Call',
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
    music_generation: { name: 'music', color: '#7B5CFA' },
    music_download: { name: 'music', color: '#7B5CFA' },
    greeting_card_generation: { name: 'gift', color: '#EC4899' },
    referral_commission: { name: 'users', color: '#EC4899' },
    image_promotion: { name: 'image', color: '#3B82F6' },
    photo_wish: { name: 'image', color: '#06B6D4' },
    celebrity_call: { name: 'phone', color: '#EAB308' },
    voice_call: { name: 'phone', color: '#EAB308' },
    voice_call_wish: { name: 'mic', color: '#EAB308' },
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

    const fetchWalletTxns = async (uid: string): Promise<TxItem[]> => {
      const res = await supabaseFetch(
        `/rest/v1/wallet_transactions?user_id=eq.${uid}&select=*&order=created_at.desc`,
        {},
        session.access_token!,
      );
      if (!res.ok) return [];
      return ((await res.json()) as TxItem[]) ?? [];
    };

    Promise.all([
      fetchWalletTxns(profileId).then(async (rows) => {
        if (rows.length === 0 && user?.id && user.id !== profileId) {
          return fetchWalletTxns(user.id);
        }
        return rows;
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
        <ActivityIndicator color="#7B5CFA" />
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
        <ActivityIndicator color="#1F7BFF" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.tabContent, { paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={['#7C3AED', '#1F7BFF']}
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
          colors={['#7B5CFA', '#1F7BFF']}
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
          const lvlColor = LEVEL_COLORS[lvl] ?? '#7B5CFA';
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

interface BankDetails {
  id: string;
  account_number: string;
  bank_name: string;
  ifsc_code: string;
  account_holder_name: string;
  is_default?: boolean;
}

export default function WalletScreen() {
  const { colors } = useTheme();
  const { user, session } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = insets.top;
  const bottomPad = insets.bottom + 20;
  const [activeTab, setActiveTab] = useState<WalletTab>('Transactions');

  const { balance, refetch } = useWallet();
  const agentPrefill = useAgentPrefill();

  // Deposit state
  const [depositModal, setDepositModal] = useState(false);
  const [depositAmt, setDepositAmt] = useState('');
  const [depositStep, setDepositStep] = useState<'amount' | 'processing' | 'success'>('amount');
  const [depositPaymentId, setDepositPaymentId] = useState('');
  const [depositError, setDepositError] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);

  // Withdraw state
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [withdrawAmt, setWithdrawAmt] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);
  const [celebAvailableBalance, setCelebAvailableBalance] = useState<number>(0);
  const [celebId, setCelebId] = useState<string>('');
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [bankLoading, setBankLoading] = useState(false);

  // Agent: auto-open deposit modal and pre-fill amount
  useEffect(() => {
    if (agentPrefill.addAmount) {
      setDepositAmt(String(agentPrefill.addAmount));
      setDepositModal(true);
    }
  }, [agentPrefill.addAmount]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const handleDeposit = async () => {
    const amount = parseInt(depositAmt, 10);
    if (!amount || amount < 100) {
      setDepositError('Minimum deposit is ₹100');
      return;
    }
    setDepositLoading(true);
    setDepositError('');

    const profileId = user?.profileId ?? '';
    const receipt = `wallet_${profileId}_${Date.now()}`.slice(0, 40);

    try {
      const orderRes = await fetch(`${SUPABASE_URL}/functions/v1/create-razorpay-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          amount,
          currency: 'INR',
          receipt,
          notes: { user_id: profileId, type: 'wallet_deposit' },
        }),
      });
      if (!orderRes.ok) throw new Error('Could not create payment order. Please try again.');
      const order = await orderRes.json() as { id: string; amount: number; key_id: string };

      setDepositStep('processing');
      const RazorpayCheckout = require('react-native-razorpay').default;
      const paymentData = await RazorpayCheckout.open({
        key: order.key_id,
        amount: order.amount,
        currency: 'INR',
        name: 'WishMe',
        description: 'Add money to wallet',
        order_id: order.id,
        prefill: {
          name: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
          email: user?.email ?? '',
          contact: user?.phone ?? '',
        },
        theme: { color: '#7B5CFA' },
      });

      const verifyRes = await fetch(`${SUPABASE_URL}/functions/v1/verify-razorpay-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          razorpay_order_id: paymentData.razorpay_order_id,
          razorpay_payment_id: paymentData.razorpay_payment_id,
          razorpay_signature: paymentData.razorpay_signature,
        }),
      });
      const verifyData = await verifyRes.json() as { success?: boolean; wishme_payment_id?: string; error?: string };
      if (!verifyData.success) throw new Error(verifyData.error ?? 'Payment verification failed');

      const wmId = verifyData.wishme_payment_id ?? generateWMId();

      await fetch(`${SUPABASE_URL}/rest/v1/wallet_transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session?.access_token}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          user_id: profileId,
          transaction_type: 'deposit',
          amount,
          status: 'completed',
          payment_method: 'razorpay',
          description: `Wallet deposit of ₹${amount}`,
          transaction_details: {
            razorpay_order_id: paymentData.razorpay_order_id,
            razorpay_payment_id: paymentData.razorpay_payment_id,
          },
        }),
      });

      await fetch(`${SUPABASE_URL}/rest/v1/payment_transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session?.access_token}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          wishme_payment_id: wmId,
          user_id: profileId,
          amount,
          payment_method: 'razorpay',
          service_type: 'deposit',
          razorpay_payment_id: paymentData.razorpay_payment_id,
          razorpay_order_id: paymentData.razorpay_order_id,
          description: `Wallet deposit of ₹${amount}`,
          status: 'completed',
          paid_at: new Date().toISOString(),
        }),
      });

      setDepositPaymentId(wmId);
      setDepositStep('success');
      refetch();

    } catch (err: unknown) {
      const msg = (err as { description?: string })?.description;
      if (msg?.toLowerCase().includes('cancel')) {
        setDepositStep('amount');
        setDepositLoading(false);
        return;
      }
      setDepositError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
      setDepositStep('amount');
    } finally {
      setDepositLoading(false);
    }
  };

  const closeDepositModal = () => {
    setDepositModal(false);
    setDepositAmt('');
    setDepositStep('amount');
    setDepositPaymentId('');
    setDepositError('');
    setDepositLoading(false);
  };

  const openWithdrawModal = async () => {
    setWithdrawModal(true);
    setWithdrawSuccess(false);
    setWithdrawError('');
    setWithdrawAmt('');

    if (user?.role === 'celebrity') {
      setBankLoading(true);
      const profileId = user?.profileId ?? '';
      try {
        const [celebRes, bankRes] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/celebrities?profile_id=eq.${profileId}&select=id,available_balance&limit=1`, {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${session?.access_token}`,
            },
          }),
          fetch(`${SUPABASE_URL}/rest/v1/bank_details?user_id=eq.${profileId}&order=is_default.desc&select=*&limit=1`, {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${session?.access_token}`,
            },
          }),
        ]);

        if (celebRes.ok) {
          const celebRows = await celebRes.json() as Array<{ id: string; available_balance: number }>;
          if (celebRows?.length) {
            setCelebId(celebRows[0].id);
            setCelebAvailableBalance(celebRows[0].available_balance ?? 0);
          }
        }

        if (bankRes.ok) {
          const bankRows = await bankRes.json() as BankDetails[];
          setBankDetails(bankRows?.length ? bankRows[0] : null);
        }
      } catch {}
      setBankLoading(false);
    }
  };

  const closeWithdrawModal = () => {
    setWithdrawModal(false);
    setWithdrawAmt('');
    setWithdrawError('');
    setWithdrawSuccess(false);
    setWithdrawLoading(false);
    setCelebAvailableBalance(0);
    setCelebId('');
    setBankDetails(null);
  };

  const handleWithdraw = async () => {
    const amount = parseInt(withdrawAmt, 10);
    if (!amount || amount <= 0) {
      setWithdrawError('Please enter a valid amount');
      return;
    }
    if (amount > celebAvailableBalance) {
      setWithdrawError(`Amount exceeds available balance of ₹${celebAvailableBalance}`);
      return;
    }
    if (!bankDetails) {
      setWithdrawError('No bank details found. Please add bank details in Edit Profile.');
      return;
    }

    setWithdrawLoading(true);
    setWithdrawError('');

    try {
      const profileId = user?.profileId ?? '';

      const payoutRes = await fetch(`${SUPABASE_URL}/rest/v1/payout_requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session?.access_token}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          celebrity_id: celebId,
          profile_id: profileId,
          requested_amount: amount,
          bank_account_number: bankDetails.account_number,
          bank_name: bankDetails.bank_name,
          ifsc_code: bankDetails.ifsc_code,
          account_holder_name: bankDetails.account_holder_name,
          status: 'pending',
        }),
      });

      if (!payoutRes.ok) throw new Error('Failed to submit withdrawal request. Please try again.');

      await fetch(`${SUPABASE_URL}/rest/v1/celebrities?id=eq.${celebId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session?.access_token}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ available_balance: celebAvailableBalance - amount }),
      });

      setWithdrawSuccess(true);
    } catch (err: unknown) {
      setWithdrawError(err instanceof Error ? err.message : 'Request failed. Please try again.');
    } finally {
      setWithdrawLoading(false);
    }
  };

  const maskAccount = (acc: string) => {
    if (!acc || acc.length < 4) return acc;
    return 'XXXX XXXX ' + acc.slice(-4);
  };

  return (
    <AmbientBackground><View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)' as never))}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Wallet</Text>
        <View style={{ width: 22 }} />
      </View>

      <LinearGradient
        colors={['#7B5CFA', '#1F7BFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <Text style={styles.heroBalanceLabel}>Total Balance</Text>
        <Text style={styles.heroBalanceAmt}>₹{balance.toLocaleString('en-IN')}</Text>

        <View style={styles.heroActionRow}>
          <TouchableOpacity
            style={styles.heroActionBtn}
            onPress={() => setDepositModal(true)}
            activeOpacity={0.85}
          >
            <Icon name="plus" size={15} color="#fff" />
            <Text style={styles.heroActionBtnText}>Add Money</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.heroActionBtn}
            onPress={openWithdrawModal}
            activeOpacity={0.85}
          >
            <Icon name="chevron-up" size={15} color="#fff" />
            <Text style={styles.heroActionBtnText}>Withdraw</Text>
          </TouchableOpacity>
        </View>
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

      {/* Deposit Modal */}
      <Modal
        visible={depositModal}
        animationType="slide"
        transparent
        onRequestClose={() => depositStep !== 'processing' && closeDepositModal()}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
            {depositStep === 'amount' && (
              <>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Money to Wallet</Text>

                <View style={styles.modalBalanceRow}>
                  <Icon name="wallet" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.modalBalanceText, { color: colors.mutedForeground }]}>
                    Current Balance: ₹{balance.toLocaleString('en-IN')}
                  </Text>
                </View>

                <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Quick Amount</Text>
                <View style={styles.chipsRow}>
                  {QUICK_AMOUNTS.map((amt) => (
                    <TouchableOpacity
                      key={amt}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: depositAmt === String(amt) ? colors.primary : colors.card,
                          borderColor: depositAmt === String(amt) ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => { setDepositAmt(String(amt)); setDepositError(''); }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: depositAmt === String(amt) ? '#fff' : colors.foreground },
                        ]}
                      >
                        ₹{amt.toLocaleString('en-IN')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Or enter amount</Text>
                <View style={[styles.amtInputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <Text style={[styles.amtCurrency, { color: colors.foreground }]}>₹</Text>
                  <TextInput
                    value={depositAmt}
                    onChangeText={(v) => { setDepositAmt(v.replace(/[^0-9]/g, '')); setDepositError(''); }}
                    keyboardType="numeric"
                    placeholder="Enter amount"
                    placeholderTextColor={colors.mutedForeground}
                    style={[styles.amtInput, { color: colors.foreground }]}
                  />
                </View>

                {depositError ? (
                  <Text style={styles.errorText}>{depositError}</Text>
                ) : null}

                <TouchableOpacity
                  onPress={handleDeposit}
                  disabled={depositLoading}
                  style={{ marginTop: 16, borderRadius: 14, overflow: 'hidden' }}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#7B5CFA', '#1F7BFF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.payBtn}
                  >
                    {depositLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.payBtnText}>Pay Now</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={closeDepositModal} style={styles.cancelLink}>
                  <Text style={[styles.cancelLinkText, { color: colors.mutedForeground }]}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}

            {depositStep === 'processing' && (
              <View style={styles.centeredSection}>
                <ActivityIndicator size="large" color="#7B5CFA" />
                <Text style={[styles.processingText, { color: colors.foreground }]}>Processing payment...</Text>
                <Text style={[styles.processingSubText, { color: colors.mutedForeground }]}>
                  Please do not close this screen
                </Text>
              </View>
            )}

            {depositStep === 'success' && (
              <View style={styles.centeredSection}>
                <View style={styles.successIconCircle}>
                  <Icon name="check" size={36} color="#fff" />
                </View>
                <Text style={[styles.successTitle, { color: colors.foreground }]}>Payment Successful!</Text>
                <Text style={[styles.successSubText, { color: colors.mutedForeground }]}>
                  WishMe ID: {depositPaymentId}
                </Text>
                <Text style={[styles.successAmt, { color: '#22C55E' }]}>
                  ₹{parseInt(depositAmt, 10).toLocaleString('en-IN')} added to wallet
                </Text>
                <TouchableOpacity
                  onPress={closeDepositModal}
                  style={{ marginTop: 24, borderRadius: 14, overflow: 'hidden', width: '100%' }}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#22C55E', '#16A34A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.payBtn}
                  >
                    <Text style={styles.payBtnText}>Done</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Withdraw Modal */}
      <Modal
        visible={withdrawModal}
        animationType="slide"
        transparent
        onRequestClose={closeWithdrawModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
            {user?.role !== 'celebrity' ? (
              <>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Withdraw Funds</Text>
                <View style={styles.centeredSection}>
                  <View style={[styles.infoIconCircle, { backgroundColor: '#7B5CFA20' }]}>
                    <Icon name="info" size={32} color="#7B5CFA" />
                  </View>
                  <Text style={[styles.infoText, { color: colors.foreground }]}>
                    Withdrawals are available for celebrity accounts. Regular users can use their wallet balance to book services.
                  </Text>
                  <TouchableOpacity
                    style={[styles.supportBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => Linking.openURL('mailto:support@wishme.today')}
                    activeOpacity={0.85}
                  >
                    <Icon name="mail" size={16} color={colors.primary} />
                    <Text style={[styles.supportBtnText, { color: colors.primary }]}>Contact Support</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={closeWithdrawModal} style={styles.cancelLink}>
                  <Text style={[styles.cancelLinkText, { color: colors.mutedForeground }]}>Close</Text>
                </TouchableOpacity>
              </>
            ) : withdrawSuccess ? (
              <View style={styles.centeredSection}>
                <View style={styles.successIconCircle}>
                  <Icon name="check" size={36} color="#fff" />
                </View>
                <Text style={[styles.successTitle, { color: colors.foreground }]}>Request Submitted!</Text>
                <Text style={[styles.infoText, { color: colors.mutedForeground, textAlign: 'center' }]}>
                  Withdrawal request submitted! Admin will process it within 3-5 business days.
                </Text>
                <TouchableOpacity
                  onPress={closeWithdrawModal}
                  style={{ marginTop: 24, borderRadius: 14, overflow: 'hidden', width: '100%' }}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#22C55E', '#16A34A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.payBtn}
                  >
                    <Text style={styles.payBtnText}>Done</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Withdraw Funds</Text>

                {bankLoading ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                    <ActivityIndicator color="#7B5CFA" />
                  </View>
                ) : (
                  <>
                    <View style={[styles.celebBalanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Available Balance</Text>
                      <Text style={[styles.celebBalanceAmt, { color: '#22C55E' }]}>
                        ₹{celebAvailableBalance.toLocaleString('en-IN')}
                      </Text>
                    </View>

                    {bankDetails ? (
                      <View style={[styles.bankCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Bank Account</Text>
                        <Text style={[styles.bankName, { color: colors.foreground }]}>{bankDetails.bank_name}</Text>
                        <Text style={[styles.bankAcc, { color: colors.mutedForeground }]}>
                          {maskAccount(bankDetails.account_number)}
                        </Text>
                        <Text style={[styles.bankIfsc, { color: colors.mutedForeground }]}>
                          IFSC: {bankDetails.ifsc_code}
                        </Text>
                        <Text style={[styles.bankHolder, { color: colors.mutedForeground }]}>
                          {bankDetails.account_holder_name}
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.bankCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                          No bank details found.
                        </Text>
                        <TouchableOpacity onPress={() => { closeWithdrawModal(); router.push('/edit-profile' as never); }}>
                          <Text style={[styles.linkText, { color: colors.primary }]}>
                            Please add bank details in Edit Profile
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Amount to Withdraw</Text>
                    <View style={[styles.amtInputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
                      <Text style={[styles.amtCurrency, { color: colors.foreground }]}>₹</Text>
                      <TextInput
                        value={withdrawAmt}
                        onChangeText={(v) => { setWithdrawAmt(v.replace(/[^0-9]/g, '')); setWithdrawError(''); }}
                        keyboardType="numeric"
                        placeholder={`Max ₹${celebAvailableBalance.toLocaleString('en-IN')}`}
                        placeholderTextColor={colors.mutedForeground}
                        style={[styles.amtInput, { color: colors.foreground }]}
                      />
                    </View>

                    {withdrawError ? (
                      <Text style={styles.errorText}>{withdrawError}</Text>
                    ) : null}

                    <TouchableOpacity
                      onPress={handleWithdraw}
                      disabled={withdrawLoading || !bankDetails}
                      style={{ marginTop: 16, borderRadius: 14, overflow: 'hidden', opacity: !bankDetails ? 0.5 : 1 }}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={['#7B5CFA', '#1F7BFF']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.payBtn}
                      >
                        {withdrawLoading ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.payBtnText}>Request Withdrawal</Text>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={closeWithdrawModal} style={styles.cancelLink}>
                      <Text style={[styles.cancelLinkText, { color: colors.mutedForeground }]}>Cancel</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </View></AmbientBackground>
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
