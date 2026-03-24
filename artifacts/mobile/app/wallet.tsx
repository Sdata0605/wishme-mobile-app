import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useWallet } from '@/hooks/useWallet';

const WALLET_TABS = ['Add Money', 'Transactions', 'Referral Earnings'] as const;
type WalletTab = (typeof WALLET_TABS)[number];

const QUICK_AMOUNTS = ['₹100', '₹500', '₹1,000', '₹2,000'];

const CREDIT_TYPES = new Set(['deposit', 'admin_credit', 'referral_commission', 'refund']);

const STATUS_COLORS: Record<string, string> = {
  completed: '#22C55E',
  pending: '#F59E0B',
  failed: '#EF4444',
};
const LEVEL_COLORS: Record<string, string> = { L1: '#FF6B33', L2: '#B44CFF' };

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
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
    refund: 'Refund',
    debit: 'Service Charge',
    music_generation: 'AI Music',
    tts: 'Text to Speech',
    voice_convert: 'Voice Convert',
    voice_clone: 'Voice Clone',
    sfx: 'Sound Effects',
    isolate: 'Audio Isolation',
    img_music: 'Image Music',
  };
  return map[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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

interface AddMoneyTabProps {
  balance: number;
  profileId: string;
  colors: ColorsType;
  session: { access_token: string } | null;
  user: { firstName: string; lastName: string; email: string; phone: string } | null;
  onSuccess: () => void;
}

function AddMoneyTab({ balance, profileId, colors, session, user, onSuccess }: AddMoneyTabProps) {
  const [amount, setAmount] = useState('');
  const [paying, setPaying] = useState(false);

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
        { method: 'POST', body: JSON.stringify({ amount: numAmount }) },
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
          { method: 'POST', body: JSON.stringify({ razorpay_payment_id: paymentId, razorpay_order_id: orderId, razorpay_signature: signature, amount: numAmount, user_id: profileId }) },
          session.access_token,
        );
        if (verRes.ok) {
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
                description: `Wallet recharge via Razorpay`,
              }),
            },
            session.access_token,
          );
          onSuccess();
          Alert.alert('Success', `₹${numAmount} added to your wallet!`);
        } else {
          Alert.alert('Verification Failed', 'Payment verification failed. Please contact support if money was deducted.');
        }
      };

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
            name: user ? `${user.firstName} ${user.lastName}` : '',
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
        const callbackBase = Linking.createURL('payment/callback');
        const html = `<!DOCTYPE html><html><body style="margin:0;background:#fff;">
<script src="https://checkout.razorpay.com/v1/checkout.js"><\/script>
<script>
var rzp = new Razorpay({
  key: "${order.key_id}",
  amount: "${order.amount}",
  currency: "${order.currency ?? 'INR'}",
  order_id: "${order.id}",
  name: "WishMe",
  description: "Wallet Recharge",
  prefill: { name: "${user ? `${user.firstName} ${user.lastName}` : ''}", email: "${user?.email ?? ''}", contact: "${user?.phone ?? ''}" },
  theme: { color: "#FF6B33" },
  handler: function(r) {
    window.location.href = "${callbackBase}?payment_id=" + r.razorpay_payment_id + "&order_id=" + r.razorpay_order_id + "&signature=" + r.razorpay_signature;
  },
  modal: { ondismiss: function() { window.location.href = "${callbackBase}?cancelled=1"; } }
});
rzp.open();
<\/script></body></html>`;

        const dataUri = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
        const result = await WebBrowser.openAuthSessionAsync(dataUri, callbackBase);

        if (result.type === 'success' && result.url) {
          const parsed = Linking.parse(result.url);
          const qp = parsed.queryParams ?? {};
          const paymentId = qp['payment_id'] as string | undefined;
          const orderId = qp['order_id'] as string | undefined;
          const signature = qp['signature'] as string | undefined;
          if (paymentId && orderId && signature) {
            await verifyAndCredit(paymentId, orderId, signature);
          }
        }
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setPaying(false);
    }
  }, [amount, session, user, profileId, onSuccess]);

  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Current Balance</Text>
        <Text style={styles.balanceAmt}>₹{balance.toLocaleString('en-IN')}</Text>
      </LinearGradient>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Enter Amount</Text>
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

        <Text style={[styles.quickLabel, { color: colors.mutedForeground }]}>Quick Add</Text>
        <View style={styles.quickRow}>
          {QUICK_AMOUNTS.map((a) => (
            <TouchableOpacity
              key={a}
              onPress={() => setAmount(a.replace(/[₹,]/g, ''))}
              style={[styles.quickChip, { borderColor: colors.primary, backgroundColor: colors.background }]}
            >
              <Text style={[styles.quickChipText, { color: colors.primary }]}>{a}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity activeOpacity={0.85} style={styles.razorpayBtn} onPress={handleRazorpay} disabled={paying}>
          <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.razorpayGrad}>
            <View style={styles.razorpayInner}>
              {paying ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="credit-card" size={18} color="#fff" />
                  <Text style={styles.razorpayText}>Add via Razorpay</Text>
                </>
              )}
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={[styles.safeNote, { color: colors.mutedForeground }]}>
          Secured by Razorpay · 256-bit SSL encrypted
        </Text>
      </View>
    </ScrollView>
  );
}

interface TxItem {
  id: string;
  transaction_type: string;
  amount: number;
  status: string;
  description?: string;
  created_at: string;
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

  useEffect(() => {
    if (!profileId || !session?.access_token) { setLoading(false); return; }
    supabaseFetch(
      `/rest/v1/wallet_transactions?user_id=eq.${profileId}&order=created_at.desc&limit=50`,
      {},
      session.access_token,
    )
      .then(async (res) => {
        if (res.ok) {
          const rows = await res.json() as TxItem[];
          setItems(rows ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profileId, session]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 }}>
        <ActivityIndicator color="#FF6B33" />
      </View>
    );
  }

  if (!items.length) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
        <Icon name="credit-card" size={36} color={colors.mutedForeground} />
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No transactions yet</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.tabContent, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
      {items.map((item) => {
        const isCredit = CREDIT_TYPES.has(item.transaction_type);
        const statusColor = STATUS_COLORS[item.status] ?? '#F59E0B';
        return (
          <View key={item.id} style={[styles.txRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.txIconCircle, { backgroundColor: isCredit ? '#22C55E20' : '#EF444420' }]}>
              <Icon
                name={isCredit ? 'arrow-down-left' : 'arrow-up-right'}
                size={18}
                color={isCredit ? '#22C55E' : '#EF4444'}
              />
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
            </View>
            <Text style={[styles.txAmt, { color: isCredit ? '#22C55E' : '#EF4444' }]}>
              {isCredit ? '+' : '-'}₹{item.amount.toLocaleString('en-IN')}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

interface RefItem {
  id: string;
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
      `/rest/v1/referral_transactions?referrer_id=eq.${profileId}&order=created_at.desc&limit=50`,
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

  const total = items.filter((r) => r.status === 'completed').reduce((s, r) => s + (r.commission_amount ?? 0), 0);

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
      </LinearGradient>

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

export default function WalletScreen() {
  const { colors } = useTheme();
  const { user, session } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = insets.bottom + 20;
  const [activeTab, setActiveTab] = useState<WalletTab>('Add Money');

  const { balance, profileId, refetch } = useWallet();

  useEffect(() => { refetch(); }, [refetch]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Wallet</Text>
        <View style={{ width: 22 }} />
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
        <AddMoneyTab
          balance={balance}
          profileId={profileId}
          colors={colors}
          session={session}
          user={user}
          onSuccess={refetch}
        />
      )}
      {activeTab === 'Transactions' && (
        <TransactionsTab colors={colors} bottomPad={bottomPad} profileId={profileId} session={session} />
      )}
      {activeTab === 'Referral Earnings' && (
        <ReferralEarningsTab colors={colors} bottomPad={bottomPad} profileId={profileId} session={session} />
      )}
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
  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14,
    padding: 14, borderWidth: 1,
  },
  txIconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  txTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  txBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  txDesc: { fontSize: 13, fontFamily: 'Inter_600SemiBold', flex: 1 },
  txDate: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  txAmt: { fontSize: 15, fontFamily: 'Inter_700Bold', minWidth: 60, textAlign: 'right' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  typeBadgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  statusText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  refRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14,
    padding: 14, borderWidth: 1,
  },
  refTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  levelBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  levelText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  emptyText: { marginTop: 12, fontSize: 14, fontFamily: 'Inter_400Regular' },
});
