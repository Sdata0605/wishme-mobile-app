import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

const BG = '#0A0D14';
const CARD = '#111827';
const BORDER = 'rgba(255,255,255,0.06)';

interface WalletTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  status: string;
  description?: string;
  created_at: string;
}

interface TxMeta {
  icon: IconName;
  isCredit: boolean;
}

function getTxMeta(type: string): TxMeta {
  if (['deposit', 'admin_credit', 'commission_earning', 'referral_commission'].includes(type)) {
    return { icon: 'credit-card', isCredit: true };
  }
  if (['booking', 'photo_wish', 'ugc_video'].includes(type)) {
    return { icon: 'video', isCredit: false };
  }
  if (['music_generation', 'music_download'].includes(type)) {
    return { icon: 'music-2', isCredit: false };
  }
  if (['celebrity_call', 'voice_call'].includes(type)) {
    return { icon: 'phone', isCredit: false };
  }
  return { icon: 'more-horizontal', isCredit: false };
}

function fmtLakh(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value}`;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function txTitle(type: string, description?: string): string {
  if (description) return description;
  const map: Record<string, string> = {
    deposit: 'Wallet Recharge',
    admin_credit: 'Admin Credit',
    commission_earning: 'Commission',
    referral_commission: 'Referral Bonus',
    booking: 'Booking',
    photo_wish: 'Photo Wish',
    ugc_video: 'UGC Video',
    music_generation: 'AI Music',
    music_download: 'Music Download',
    celebrity_call: 'Celebrity Call',
    voice_call: 'Voice Call',
    voice_call_wish: 'AI Voice Call',
    greeting_card_generation: 'Greeting Card',
    image_promotion: 'Image Promotion',
    service_payment: 'Service Payment',
    plan_upgrade: 'Plan Upgrade',
    debit: 'Service Charge',
  };
  return map[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_COLORS: Record<string, string> = {
  completed: '#22C55E',
  pending: '#F59E0B',
  failed: '#EF4444',
};

const BOOKING_TYPES = new Set(['booking', 'photo_wish', 'ugc_video']);
const MUSIC_TYPES = new Set(['music_generation', 'music_download']);
const CALL_TYPES = new Set(['celebrity_call', 'voice_call', 'voice_call_wish']);
const OTHER_TYPES = new Set(['greeting_card_generation', 'image_promotion', 'service_payment', 'plan_upgrade', 'debit']);

interface StatCard {
  label: string;
  icon: IconName;
  color: string;
  amount: number;
}

function buildStatCards(txns: WalletTransaction[]): StatCard[] {
  const completed = txns.filter((t) => t.status === 'completed');
  const sum = (types: Set<string>) =>
    completed.filter((t) => types.has(t.transaction_type)).reduce((s, t) => s + (t.amount ?? 0), 0);

  return [
    { label: 'Bookings Spent', icon: 'video', color: '#14B8A6', amount: sum(BOOKING_TYPES) },
    { label: 'Music Generated', icon: 'music-2', color: '#EAB308', amount: sum(MUSIC_TYPES) },
    { label: 'Voice Calls', icon: 'phone', color: '#A855F7', amount: sum(CALL_TYPES) },
    { label: 'Other Services', icon: 'more-horizontal', color: 'rgba(255,255,255,0.5)', amount: sum(OTHER_TYPES) },
  ];
}

function useRealtimeBalance(profileId: string | null, accessToken: string | null, onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!profileId || !accessToken) return;
    const wsBase = SUPABASE_URL.replace('https://', 'wss://');
    const wsUrl = `${wsBase}/realtime/v1/websocket?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`;
    let ws: WebSocket | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let ref = 0;

    const send = (msg: object) => {
      try { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); } catch {}
    };

    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        send({
          topic: `realtime:public:profiles`,
          event: 'phx_join',
          payload: {
            config: {
              broadcast: { ack: false, self: false },
              postgres_changes: [{ event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${profileId}` }],
            },
            access_token: accessToken,
          },
          ref: String(++ref),
        });
        heartbeat = setInterval(() => {
          send({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) });
        }, 30000);
      };
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data as string);
          const isUpdate =
            msg.event === 'postgres_changes' &&
            (msg.payload?.data?.type === 'UPDATE' || msg.payload?.eventType === 'UPDATE');
          if (isUpdate) onUpdateRef.current();
        } catch {}
      };
      ws.onerror = () => {};
    } catch {}

    return () => {
      if (heartbeat) clearInterval(heartbeat);
      ws?.close();
    };
  }, [profileId, accessToken]);
}

export default function DashboardScreen() {
  const { colors } = useTheme();
  const { user, session } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 20 : insets.top;

  const [balance, setBalance] = useState<number>(user?.walletBalance ?? 0);
  const [profileId, setProfileId] = useState<string>(user?.profileId ?? '');
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCelebrity, setIsCelebrity] = useState(false);

  const fetchData = async () => {
    if (!session?.access_token || !user?.profileId) {
      setLoading(false);
      return;
    }
    const pid = user.profileId;
    setProfileId(pid);

    try {
      const [profileRes, txRes, celebRes] = await Promise.all([
        supabaseFetch(
          `/rest/v1/profiles?select=wallet_balance&id=eq.${pid}&limit=1`,
          {},
          session.access_token,
        ),
        supabaseFetch(
          `/rest/v1/wallet_transactions?user_id=eq.${pid}&order=created_at.desc&limit=50`,
          {},
          session.access_token,
        ),
        fetch(
          `${SUPABASE_URL}/rest/v1/celebrities?select=id&profile_id=eq.${pid}&limit=1`,
          {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
              Accept: 'application/vnd.pgrst.object+json',
            },
          },
        ),
      ]);

      if (profileRes.ok) {
        const rows = await profileRes.json() as Array<{ wallet_balance: number }>;
        if (rows?.length) setBalance(rows[0].wallet_balance ?? 0);
      }

      if (txRes.ok) {
        const rows = await txRes.json() as WalletTransaction[];
        setTransactions(rows ?? []);
      }

      setIsCelebrity(celebRes.status === 200);
    } catch {}

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [session?.access_token, user?.profileId]);

  useRealtimeBalance(profileId || null, session?.access_token ?? null, async () => {
    if (!session?.access_token || !profileId) return;
    try {
      const res = await supabaseFetch(
        `/rest/v1/profiles?select=wallet_balance&id=eq.${profileId}&limit=1`,
        {},
        session.access_token,
      );
      if (res.ok) {
        const rows = await res.json() as Array<{ wallet_balance: number }>;
        if (rows?.length) setBalance(rows[0].wallet_balance ?? 0);
      }
    } catch {}
  });

  const statCards = buildStatCards(transactions);
  const recentTxns = transactions.slice(0, 5);

  return (
    <View style={[styles.root, { backgroundColor: BG }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Icon name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color="#FF6B33" size="large" />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Wallet Balance Card */}
          <LinearGradient
            colors={['#EC4899', '#A855F7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.balanceCard}
          >
            <Text style={styles.balanceLabel}>WALLET BALANCE</Text>
            <Text style={styles.balanceAmount}>₹{balance.toLocaleString('en-IN')}</Text>
            <View style={styles.balanceBtns}>
              <TouchableOpacity
                style={styles.balanceBtn}
                onPress={() => router.push('/wallet')}
                activeOpacity={0.8}
              >
                <Icon name="plus" size={14} color="#fff" />
                <Text style={styles.balanceBtnText}>Add Funds</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.balanceBtn}
                onPress={() => router.push('/bookings')}
                activeOpacity={0.8}
              >
                <Icon name="bar-chart-2" size={14} color="#fff" />
                <Text style={styles.balanceBtnText}>View Reports</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* 2×2 Stat Cards */}
          <View style={styles.statGrid}>
            {statCards.map((card) => (
              <View key={card.label} style={styles.statCard}>
                <View style={[styles.statIconWrap, { backgroundColor: card.color + '20' }]}>
                  <Icon name={card.icon} size={20} color={card.color} />
                </View>
                <Text style={styles.statValue}>{fmtLakh(card.amount)}</Text>
                <Text style={styles.statLabel}>{card.label}</Text>
              </View>
            ))}
          </View>

          {/* Recent Transactions */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Transactions</Text>
              <TouchableOpacity onPress={() => router.push('/wallet')} activeOpacity={0.7}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>

            {recentTxns.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="credit-card" size={32} color="rgba(255,255,255,0.3)" />
                <Text style={styles.emptyText}>No transactions yet</Text>
              </View>
            ) : (
              recentTxns.map((tx) => {
                const { icon, isCredit } = getTxMeta(tx.transaction_type);
                const statusColor = STATUS_COLORS[tx.status] ?? '#F59E0B';
                return (
                  <View key={tx.id} style={styles.txRow}>
                    <View style={[styles.txIconWrap, { backgroundColor: isCredit ? '#22C55E20' : '#A855F720' }]}>
                      <Icon name={icon} size={18} color={isCredit ? '#22C55E' : '#A855F7'} />
                    </View>
                    <View style={styles.txInfo}>
                      <Text style={styles.txTitle} numberOfLines={1}>
                        {txTitle(tx.transaction_type, tx.description)}
                      </Text>
                      <Text style={styles.txDate}>{fmtDate(tx.created_at)}</Text>
                    </View>
                    <View style={styles.txRight}>
                      <Text style={[styles.txAmount, isCredit && styles.txAmountCredit]}>
                        {isCredit ? '+' : '-'}₹{(tx.amount ?? 0).toLocaleString('en-IN')}
                      </Text>
                      <View style={[styles.statusPill, { backgroundColor: statusColor + '20' }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>{tx.status}</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* Celebrity FAB */}
      {isCelebrity && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 70 }]}
          onPress={() => router.push('/celebrity-dashboard')}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#7C3AED', '#A855F7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.fabGradient}
          >
            <Icon name="sparkles" size={16} color="#fff" />
            <Text style={styles.fabText}>Celebrity Dashboard</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  balanceCard: {
    borderRadius: 20,
    padding: 24,
    gap: 8,
  },
  balanceLabel: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  balanceAmount: {
    fontSize: 30,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  balanceBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  balanceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    paddingVertical: 10,
  },
  balanceBtnText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '47.5%',
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    gap: 8,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.5)',
  },
  section: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  seeAll: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#A855F7',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.3)',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  txIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: {
    flex: 1,
    gap: 3,
  },
  txTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  txDate: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.4)',
  },
  txRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  txAmount: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: 'rgba(255,255,255,0.8)',
  },
  txAmountCredit: {
    color: '#22C55E',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'capitalize',
  },
  fab: {
    position: 'absolute',
    right: 16,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  fabText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
