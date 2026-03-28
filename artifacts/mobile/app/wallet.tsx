import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
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

const WALLET_TABS = ['Add Money', 'Transactions', 'Referral Earnings'] as const;
type WalletTab = (typeof WALLET_TABS)[number];

const QUICK_AMOUNTS = [500, 1000, 2500, 5000];

const CREDIT_TYPES = new Set(['deposit', 'admin_credit', 'referral_commission', 'refund', 'commission_earning']);

const STATUS_COLORS: Record<string, string> = {
  completed: '#22C55E',
  pending: '#F59E0B',
  failed: '#EF4444',
};
const LEVEL_COLORS: Record<string, string> = { L1: '#FF6B33', L2: '#B44CFF' };

function generateWishMePaymentId(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const rand = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `WM${yy}${mm}${rand}`;
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
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
    deposit: 'Wallet Recharge',
    admin_credit: 'Admin Credit',
    referral_commission: 'Referral Commission',
    commission_earning: 'Commission Earning',
    refund: 'Refund',
    debit: 'Service Charge',
    booking: 'Celebrity Booking',
    music_generation: 'AI Music',
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
    tts: 'Text to Speech',
    voice_convert: 'Voice Convert',
    voice_clone: 'Voice Clone',
    sfx: 'Sound Effects',
    isolate: 'Audio Isolation',
    img_music: 'Image Music',
  };
  return map[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

type TxIconInfo = { name: IconName; color: string };

function txIconInfo(type: string): TxIconInfo {
  const map: Record<string, TxIconInfo> = {
    deposit: { name: 'trending-up', color: '#22C55E' },
    admin_credit: { name: 'trending-up', color: '#22C55E' },
    booking: { name: 'video', color: '#F97316' },
    music_generation: { name: 'music', color: '#A855F7' },
    music_download: { name: 'music', color: '#A855F7' },
    greeting_card_generation: { name: 'gift', color: '#EC4899' },
    referral_commission: { name: 'users', color: '#EC4899' },
    commission_earning: { name: 'users', color: '#EC4899' },
    image_promotion: { name: 'image', color: '#3B82F6' },
    ugc_video: { name: 'video', color: '#F97316' },
    photo_wish: { name: 'image', color: '#06B6D4' },
    celebrity_call: { name: 'phone', color: '#EAB308' },
    voice_call: { name: 'phone', color: '#EAB308' },
    celebrity_subscription: { name: 'star', color: '#F59E0B' },
    plan_upgrade: { name: 'star', color: '#F59E0B' },
    service_payment: { name: 'shopping-bag', color: '#6366F1' },
  };
  const found = map[type];
  if (found) return found;
  return { name: 'credit-card', color: '#6B7280' };
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

async function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.Razorpay) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.body.appendChild(script);
  });
}

type ColorsType = ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors'];

interface AddMoneyModalProps {
  visible: boolean;
  onClose: () => void;
  initialAmount?: string;
  profileId: string;
  colors: ColorsType;
  session: { access_token: string } | null;
  user: { firstName: string; lastName: string; email: string; phone: string } | null;
  onSuccess: () => void;
}

function AddMoneyModal({ visible, onClose, initialAmount, profileId, colors, session, user, onSuccess }: AddMoneyModalProps) {
  const [amount, setAmount] = useState(initialAmount ?? '');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (visible) setAmount(initialAmount ?? '');
  }, [visible, initialAmount]);

  const handleRazorpay = useCallback(async () => {
    const numAmount = parseInt(amount || '0', 10);
    if (!numAmount || numAmount < 100) {
      Alert.alert('Invalid Amount', 'Please enter at least ₹100 to add.');
      return;
    }
    if (!session?.access_token) {
      Alert.alert('Not logged in', 'Please log in to add money.');
      return;
    }
    setPaying(true);
    try {
      const orderRes = await supabaseFetch(
        '/functions/v1/create-razorpay-order',
        {
          method: 'POST',
          body: JSON.stringify({
            amount: numAmount,
            currency: 'INR',
            receipt: `wall_${profileId.slice(0, 8)}_${Date.now()}`.slice(0, 40),
            notes: { user_id: profileId, type: 'wallet_deposit' },
          }),
        },
        session.access_token,
      );
      if (!orderRes.ok) {
        const e = await orderRes.json().catch(() => ({})) as Record<string, string>;
        Alert.alert('Error', e.error ?? 'Failed to create payment order. Please try again.');
        return;
      }
      const order = await orderRes.json() as { id: string; amount: number; currency: string; key_id: string };

      const verifyAndCredit = async (paymentId: string, orderId: string, signature: string) => {
        const verRes = await supabaseFetch(
          '/functions/v1/verify-razorpay-payment',
          {
            method: 'POST',
            body: JSON.stringify({
              razorpay_payment_id: paymentId,
              razorpay_order_id: orderId,
              razorpay_signature: signature,
              amount: numAmount,
              user_id: profileId,
            }),
          },
          session.access_token,
        );
        if (verRes.ok) {
          const paidAt = new Date().toISOString();
          const wishmePaymentId = generateWishMePaymentId();

          await supabaseFetch(
            '/rest/v1/wallet_transactions',
            {
              method: 'POST',
              headers: { Prefer: 'return=minimal' } as Record<string, string>,
              body: JSON.stringify({
                user_id: profileId,
                transaction_type: 'deposit',
                amount: numAmount,
                status: 'completed',
                payment_method: 'razorpay',
                description: `Wallet deposit of ₹${numAmount}`,
                transaction_details: {
                  razorpay_order_id: orderId,
                  razorpay_payment_id: paymentId,
                },
              }),
            },
            session.access_token,
          );

          await supabaseFetch(
            '/rest/v1/payment_transactions',
            {
              method: 'POST',
              headers: { Prefer: 'return=minimal' } as Record<string, string>,
              body: JSON.stringify({
                wishme_payment_id: wishmePaymentId,
                user_id: profileId,
                amount: numAmount,
                payment_method: 'razorpay',
                service_type: 'deposit',
                razorpay_payment_id: paymentId,
                razorpay_order_id: orderId,
                description: `Wallet deposit of ₹${numAmount}`,
                status: 'completed',
                paid_at: paidAt,
              }),
            },
            session.access_token,
          );

          onSuccess();
          onClose();
          Alert.alert('Success', `₹${numAmount} added to your wallet!`);
        } else {
          Alert.alert('Verification Failed', 'Payment verification failed. Please contact support if money was deducted.');
        }
      };

      const prefillName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : '';

      if (Platform.OS === 'web') {
        await loadRazorpayScript();
        const rzp = new window.Razorpay({
          key: order.key_id,
          amount: order.amount,
          currency: order.currency ?? 'INR',
          order_id: order.id,
          name: 'WishMe',
          description: 'Wallet Recharge',
          prefill: {
            name: prefillName,
            email: user?.email ?? '',
            contact: user?.phone ?? '',
          },
          theme: { color: '#FF6B33' },
          handler: async (response: Record<string, string>) => {
            await verifyAndCredit(response.razorpay_payment_id, response.razorpay_order_id, response.razorpay_signature);
          },
        });
        rzp.open();
      } else {
        type RazorpayModule = { open: (opts: Record<string, unknown>) => Promise<{ razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }> };
        let razorpayModule: RazorpayModule | null = null;
        try {
          const mod = require('react-native-razorpay') as { default?: RazorpayModule } & RazorpayModule;
          const candidate = mod.default ?? mod;
          if (candidate && typeof candidate.open === 'function') {
            razorpayModule = candidate;
          }
        } catch {
          // native module not linked
        }

        if (!razorpayModule) {
          setPaying(false);
          Alert.alert(
            'Native Checkout Not Available',
            'Razorpay native checkout requires a custom development build (not Expo Go). Please use the production app.',
            [{ text: 'OK' }],
          );
          return;
        }

        const data = await razorpayModule.open({
          key: order.key_id,
          amount: String(order.amount),
          currency: order.currency ?? 'INR',
          order_id: order.id,
          name: 'WishMe',
          description: 'Wallet Recharge',
          prefill: {
            name: prefillName,
            email: user?.email ?? '',
            contact: user?.phone ?? '',
          },
          theme: { color: '#FF6B33' },
        });

        if (data?.razorpay_payment_id) {
          await verifyAndCredit(data.razorpay_payment_id, data.razorpay_order_id, data.razorpay_signature);
        }
      }
    } catch (err) {
      const errMsg = (err as Record<string, string>)?.description ?? 'Something went wrong. Please try again.';
      if (!errMsg.toLowerCase().includes('cancel')) {
        Alert.alert('Payment Error', errMsg);
      }
    } finally {
      setPaying(false);
    }
  }, [amount, session, user, profileId, onSuccess, onClose]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Money</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.foreground, marginBottom: 8 }]}>Enter Amount</Text>
          <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[styles.rupeeSign, { color: colors.foreground }]}>₹</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.amtInput, { color: colors.foreground }]}
            />
          </View>

          <Text style={[styles.quickLabel, { color: colors.mutedForeground, marginTop: 12, marginBottom: 8 }]}>Quick Add</Text>
          <View style={styles.quickRow}>
            {QUICK_AMOUNTS.map((a) => (
              <TouchableOpacity
                key={a}
                onPress={() => setAmount(String(a))}
                style={[
                  styles.quickChip,
                  { borderColor: colors.primary, backgroundColor: colors.background },
                  amount === String(a) && { backgroundColor: colors.primary },
                ]}
              >
                <Text style={[styles.quickChipText, { color: amount === String(a) ? '#fff' : colors.primary }]}>
                  ₹{a.toLocaleString('en-IN')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity activeOpacity={0.85} style={[styles.razorpayBtn, { marginTop: 20 }]} onPress={handleRazorpay} disabled={paying}>
            <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.razorpayGrad}>
              <View style={styles.razorpayInner}>
                {paying ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="credit-card" size={18} color="#fff" />
                    <Text style={styles.razorpayText}>Pay via Razorpay</Text>
                  </>
                )}
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={[styles.safeNote, { color: colors.mutedForeground, marginTop: 8 }]}>
            Secured by Razorpay · 256-bit SSL encrypted
          </Text>
        </View>
      </View>
    </Modal>
  );
}

interface TxItem {
  id: string;
  transaction_type: string;
  amount: number;
  status: string;
  description?: string;
  created_at: string;
  wishme_payment_id?: string;
}

interface TxTabProps {
  colors: ColorsType;
  bottomPad: number;
  profileId: string;
  session: { access_token: string } | null;
}

function TransactionsTab({ colors, bottomPad, profileId, session }: TxTabProps) {
  const [items, setItems] = useState<TxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!profileId || !session?.access_token) { setLoading(false); return; }

    Promise.all([
      supabaseFetch(
        `/rest/v1/wallet_transactions?user_id=eq.${profileId}&order=created_at.desc&limit=100`,
        {},
        session.access_token,
      ).then(async (res) => {
        if (!res.ok) return [] as TxItem[];
        return (await res.json() as TxItem[]) ?? [];
      }).catch(() => [] as TxItem[]),

      supabaseFetch(
        `/rest/v1/referral_transactions?referrer_id=eq.${profileId}&order=created_at.desc&limit=100`,
        {},
        session.access_token,
      ).then(async (res) => {
        if (!res.ok) return [] as TxItem[];
        const rows = await res.json() as Array<{
          id: string;
          commission_amount: number;
          status: string;
          created_at: string;
          booking_id?: string;
        }>;
        return (rows ?? []).map((r) => ({
          id: `ref_${r.id}`,
          transaction_type: 'referral_commission',
          amount: r.commission_amount ?? 0,
          status: r.status,
          description: r.booking_id ? `Referral Bonus – Booking #${r.booking_id.slice(0, 8)}` : 'Referral Commission',
          created_at: r.created_at,
        }));
      }).catch(() => [] as TxItem[]),

      supabaseFetch(
        `/rest/v1/payment_transactions?user_id=eq.${profileId}&order=created_at.desc&limit=100`,
        {},
        session.access_token,
      ).then(async (res) => {
        if (!res.ok) return {} as Record<string, string>;
        const rows = await res.json() as Array<{ razorpay_order_id?: string; wishme_payment_id?: string }>;
        const map: Record<string, string> = {};
        for (const r of rows ?? []) {
          if (r.razorpay_order_id && r.wishme_payment_id) {
            map[r.razorpay_order_id] = r.wishme_payment_id;
          }
        }
        return map;
      }).catch(() => ({} as Record<string, string>)),
    ]).then(([walletTxns, refTxns, paymentMap]) => {
      const merged: TxItem[] = [
        ...(walletTxns as TxItem[]).map((t) => ({
          ...t,
          wishme_payment_id: (t as { transaction_details?: { razorpay_order_id?: string } }).transaction_details?.razorpay_order_id
            ? (paymentMap as Record<string, string>)[(t as { transaction_details?: { razorpay_order_id?: string } }).transaction_details!.razorpay_order_id!]
            : undefined,
        })),
        ...(refTxns as TxItem[]),
      ];
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setItems(merged);
    }).finally(() => setLoading(false));
  }, [profileId, session]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 }}>
        <ActivityIndicator color="#FF6B33" />
      </View>
    );
  }

  const filtered = search.trim()
    ? items.filter((item) => item.wishme_payment_id?.toLowerCase().includes(search.toLowerCase().trim()))
    : items;

  const displayed = showAll ? filtered : filtered.slice(0, 5);

  return (
    <ScrollView contentContainerStyle={[styles.tabContent, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
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
            return (
              <View key={item.id} style={[styles.txRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.txIconCircle, { backgroundColor: iconInfo.color + '20' }]}>
                  <Icon name={iconInfo.name} size={18} color={iconInfo.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.txTopRow}>
                    <Text style={[styles.txDesc, { color: colors.foreground }]}>{txLabel(item.transaction_type, item.description)}</Text>
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
                  {item.wishme_payment_id ? (
                    <Text style={[styles.wmId, { color: colors.mutedForeground }]}>{item.wishme_payment_id}</Text>
                  ) : null}
                </View>
                <Text style={[styles.txAmt, { color: isCredit ? '#22C55E' : '#EF4444' }]}>
                  {isCredit ? '+' : '-'}₹{item.amount.toLocaleString('en-IN')}
                </Text>
              </View>
            );
          })}

          {filtered.length > 5 && (
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
  level: string;
  status: string;
  created_at: string;
}

interface RefTabProps {
  colors: ColorsType;
  bottomPad: number;
  profileId: string;
  session: { access_token: string } | null;
}

function ReferralEarningsTab({ colors, bottomPad, profileId, session }: RefTabProps) {
  const [items, setItems] = useState<RefItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profileId || !session?.access_token) { setLoading(false); return; }
    supabaseFetch(
      `/rest/v1/referral_transactions?referrer_id=eq.${profileId}&order=created_at.desc&limit=100`,
      {},
      session.access_token,
    )
      .then(async (res) => {
        if (res.ok) {
          const rows = await res.json() as RefItem[];
          setItems(rows ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profileId, session]);

  const completed = items.filter((r) => r.status === 'completed');
  const pending = items.filter((r) => r.status === 'pending');
  const total = completed.reduce((s, r) => s + (r.commission_amount ?? 0), 0);
  const uniqueFriends = new Set(completed.map((r) => r.referred_id).filter(Boolean)).size;

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 }}>
        <ActivityIndicator color="#B44CFF" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.tabContent, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={['#7B2FFF', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.refEarningCard}>
        <Text style={styles.balanceLabel}>Total Referral Earnings</Text>
        <Text style={styles.balanceAmt}>₹{total.toLocaleString('en-IN')}</Text>
        <Text style={[styles.balanceLabel, { marginTop: 4 }]}>Credited to wallet</Text>

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
        <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.inviteBtnGrad}>
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
          const lvlColor = LEVEL_COLORS[item.level] ?? '#FF6B33';
          const statusColor = STATUS_COLORS[item.status] ?? '#F59E0B';
          return (
            <View key={item.id} style={[styles.refRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <View style={styles.refTopRow}>
                  <Text style={[styles.txDesc, { color: colors.foreground }]}>
                    {item.booking_id ? `Booking #${item.booking_id.slice(0, 8)}` : 'Referral Bonus'}
                  </Text>
                  <View style={[styles.levelBadge, { backgroundColor: lvlColor + '20' }]}>
                    <Text style={[styles.levelText, { color: lvlColor }]}>{item.level}</Text>
                  </View>
                </View>
                <View style={styles.txBottomRow}>
                  <Text style={[styles.txDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
                  </View>
                </View>
              </View>
              <Text style={[styles.txAmt, { color: '#22C55E' }]}>+₹{(item.commission_amount ?? 0).toLocaleString('en-IN')}</Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

interface AddMoneyTabProps {
  colors: ColorsType;
  onOpenModal: (amount?: string) => void;
}

function AddMoneyTab({ colors, onOpenModal }: AddMoneyTabProps) {
  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Saved Methods</Text>
        <View style={styles.savedMethodRow}>
          <View style={[styles.savedMethodIcon, { backgroundColor: '#1A56DB20' }]}>
            <Icon name="credit-card" size={20} color="#1A56DB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.savedMethodName, { color: colors.foreground }]}>VISA ••••4242</Text>
            <Text style={[styles.savedMethodSub, { color: colors.mutedForeground }]}>Credit Card</Text>
          </View>
        </View>
        <View style={[styles.savedMethodDivider, { backgroundColor: colors.border }]} />
        <View style={styles.savedMethodRow}>
          <View style={[styles.savedMethodIcon, { backgroundColor: '#22C55E20' }]}>
            <Icon name="phone" size={20} color="#22C55E" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.savedMethodName, { color: colors.foreground }]}>rahul@axl</Text>
            <Text style={[styles.savedMethodSub, { color: colors.mutedForeground }]}>UPI</Text>
          </View>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.assistRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Need Assistance?</Text>
            <Text style={[styles.assistSub, { color: colors.mutedForeground }]}>Our support team is here to help you.</Text>
          </View>
          <TouchableOpacity
            style={styles.chatBtn}
            onPress={() => router.push('/messages' as never)}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chatBtnGrad}>
              <Text style={styles.chatBtnText}>Chat Now</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

export default function WalletScreen() {
  const { colors } = useTheme();
  const { user, session } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = insets.bottom + 20;
  const [activeTab, setActiveTab] = useState<WalletTab>('Add Money');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalInitialAmount, setModalInitialAmount] = useState('');

  const { balance, profileId, refetch } = useWallet();

  useEffect(() => { refetch(); }, [refetch]);

  const openModal = useCallback((amount?: string) => {
    setModalInitialAmount(amount ?? '');
    setModalVisible(true);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Wallet</Text>
        <View style={{ width: 22 }} />
      </View>

      <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
        <Text style={styles.heroBalanceLabel}>Total Balance</Text>
        <Text style={styles.heroBalanceAmt}>₹{balance.toLocaleString('en-IN')}</Text>
        <View style={styles.heroActions}>
          <TouchableOpacity style={styles.heroActionBtn} onPress={() => openModal()} activeOpacity={0.85}>
            <Icon name="plus" size={16} color="#fff" />
            <Text style={styles.heroActionText}>Add Funds</Text>
          </TouchableOpacity>
          <View style={styles.heroActionDivider} />
          <TouchableOpacity style={styles.heroActionBtn} activeOpacity={0.85} onPress={() => Alert.alert('Withdraw', 'Withdrawal feature coming soon.')}>
            <Icon name="arrow-up-right" size={16} color="#fff" />
            <Text style={styles.heroActionText}>Withdraw</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={[styles.quickRechargeSection, { backgroundColor: colors.background }]}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Quick Recharge</Text>
          <View style={styles.quickRow}>
            {QUICK_AMOUNTS.map((a) => (
              <TouchableOpacity
                key={a}
                onPress={() => openModal(String(a))}
                style={[styles.quickChip, { borderColor: colors.primary, backgroundColor: colors.background }]}
              >
                <Text style={[styles.quickChipText, { color: colors.primary }]}>₹{a.toLocaleString('en-IN')}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => openModal('')}
              style={[styles.quickChip, { borderColor: colors.mutedForeground, backgroundColor: colors.background }]}
            >
              <Text style={[styles.quickChipText, { color: colors.mutedForeground }]}>Custom</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={[styles.tabBar, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        {WALLET_TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
          >
            <Text style={[styles.tabLabel, { color: activeTab === tab ? colors.primary : colors.mutedForeground },
              activeTab === tab && styles.tabLabelActive,
            ]}>
              {tab}
            </Text>
            {activeTab === tab && <View style={[styles.tabUnderline, { backgroundColor: colors.primary }]} />}
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'Add Money' && (
        <AddMoneyTab colors={colors} onOpenModal={openModal} />
      )}
      {activeTab === 'Transactions' && (
        <TransactionsTab colors={colors} bottomPad={bottomPad} profileId={profileId} session={session} />
      )}
      {activeTab === 'Referral Earnings' && (
        <ReferralEarningsTab colors={colors} bottomPad={bottomPad} profileId={profileId} session={session} />
      )}

      <AddMoneyModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        initialAmount={modalInitialAmount}
        profileId={profileId}
        colors={colors}
        session={session}
        user={user}
        onSuccess={refetch}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  heroCard: {
    marginHorizontal: 16, marginTop: 16, marginBottom: 4,
    borderRadius: 20, padding: 24,
  },
  heroBalanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: 'Inter_500Medium', marginBottom: 4 },
  heroBalanceAmt: { color: '#fff', fontSize: 40, fontFamily: 'Inter_700Bold', marginBottom: 16 },
  heroActions: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, overflow: 'hidden',
  },
  heroActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  heroActionText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  heroActionDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.3)' },
  quickRechargeSection: { paddingHorizontal: 16, paddingVertical: 12 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 14, position: 'relative' },
  tabItemActive: {},
  tabLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  tabLabelActive: { fontFamily: 'Inter_700Bold' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 8, right: 8, height: 2, borderRadius: 1 },
  tabContent: { padding: 16, gap: 12 },
  balanceCard: { borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 4 },
  refEarningCard: { borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 4 },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: 'Inter_500Medium', marginBottom: 6 },
  balanceAmt: { color: '#fff', fontSize: 38, fontFamily: 'Inter_700Bold' },
  refStatsRow: { flexDirection: 'row', marginTop: 16, gap: 24 },
  refStatItem: { alignItems: 'center' },
  refStatNumber: { color: '#fff', fontSize: 24, fontFamily: 'Inter_700Bold' },
  refStatLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 2 },
  refStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)', alignSelf: 'stretch' },
  inviteBtn: { borderRadius: 12, overflow: 'hidden' },
  inviteBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  inviteBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  card: { borderRadius: 16, padding: 20, borderWidth: 1, gap: 12 },
  sectionLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, height: 52, gap: 4,
  },
  rupeeSign: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  amtInput: { flex: 1, fontSize: 24, fontFamily: 'Inter_700Bold' },
  quickLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  quickRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  quickChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999, borderWidth: 1.5 },
  quickChipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  razorpayBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 4 },
  razorpayGrad: { paddingVertical: 15 },
  razorpayInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  razorpayText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  safeNote: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  savedMethodRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  savedMethodIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  savedMethodName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  savedMethodSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  savedMethodDivider: { height: 1 },
  assistRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  assistSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  chatBtn: { borderRadius: 10, overflow: 'hidden' },
  chatBtnGrad: { paddingHorizontal: 14, paddingVertical: 10 },
  chatBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14,
    padding: 14, borderWidth: 1,
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1,
  },
  viewAllText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  refRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14,
    padding: 14, borderWidth: 1,
  },
  refTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  levelBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  levelText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  emptyText: { marginTop: 12, fontSize: 14, fontFamily: 'Inter_400Regular' },
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
    gap: 0,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
});
