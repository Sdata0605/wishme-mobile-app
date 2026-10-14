import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

const STATUS_COLORS: Record<string, string> = {
  completed: '#22C55E',
  pending: '#F59E0B',
  failed: '#EF4444',
};

interface CommissionRates {
  l1: number;
  l2: number;
  planName: string;
}

interface PlanRates {
  name: string;
  price: number;
  l1: number;
  l2: number;
}

interface ReferralTransaction {
  id: string;
  commission_level: 1 | 2;
  commission_amount: number;
  status: string;
  created_at: string;
  order_type: string | null;
  referred_name: string;
}

const ORDER_LABELS: Record<string, string> = {
  ugc_video: 'UGC video',
  ugc_ad: 'UGC ad',
  wish_friend: 'Wish a Friend',
};

export default function ReferralsScreen() {
  const { colors } = useTheme();
  const { user, session } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [code, setCode] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [commissionRates, setCommissionRates] = useState<CommissionRates>({ l1: 5, l2: 0, planName: 'Basic' });
  const [transactions, setTransactions] = useState<ReferralTransaction[]>([]);
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [allPlans, setAllPlans] = useState<PlanRates[]>([]);
  const [referralUrl, setReferralUrl] = useState<string>('');

  const linkFor = (c: string) => referralUrl || `https://wishme.today/auth?ref=${c}`;

  const copy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    if (!code) return;
    try {
      await Share.share({ message: `Join WishMe and book celebrity wishes! Use my referral code: ${code}\n${linkFor(code)}` });
    } catch {
      showToast('Share not available');
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const fetchData = useCallback(async () => {
    if (!user?.profileId || !session?.access_token) return;

    try {
      const token = session.access_token;

      // The real code comes from the profile. Never show a made-up one: friends who type it would not be linked to you.
      const profileRes = await supabaseFetch(
        `/rest/v1/profiles?select=plan,referral_code,referral_url&id=eq.${user.profileId}&limit=1`,
        {},
        token,
      );
      if (!profileRes.ok) throw new Error('profile');
      const profile = ((await profileRes.json()) as Array<{ plan?: string; referral_code?: string; referral_url?: string }>)[0] ?? {};
      const planName: string = profile.plan ?? 'basic';
      setCode(profile.referral_code ?? '');
      setReferralUrl(profile.referral_url ?? '');

      // Profiles are private, so the people you referred and their names come from functions, not from the profiles table.
      const [ratesRes, historyRes, directRes] = await Promise.all([
        supabaseFetch(
          '/rest/v1/plans?select=name,price,referral_commission_l1,referral_commission_l2&is_active=eq.true&order=price.asc',
          {},
          token,
        ),
        supabaseFetch('/rest/v1/rpc/get_my_referral_history', { method: 'POST', body: '{}' }, token),
        supabaseFetch('/rest/v1/rpc/get_my_referrals', { method: 'POST', body: '{}' }, token),
      ]);

      if (ratesRes.ok) {
        const rows = await ratesRes.json() as Array<{ name: string; price: number; referral_commission_l1: number | null; referral_commission_l2: number | null }>;
        const plans: PlanRates[] = rows.map(r => ({
          name: r.name.replace(/^./, c => c.toUpperCase()),
          price: r.price,
          l1: r.referral_commission_l1 ?? 0,
          l2: r.referral_commission_l2 ?? 0,
        }));
        setAllPlans(plans);
        const mine = plans.find(pl => pl.name.toLowerCase() === planName.toLowerCase());
        if (mine) setCommissionRates({ l1: mine.l1, l2: mine.l2, planName: mine.name });
      }

      setTransactions(historyRes.ok ? await historyRes.json() as ReferralTransaction[] : []);
      setTotalReferrals(directRes.ok ? ((await directRes.json()) as unknown[]).length : 0);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
      showToast('Failed to load referral data');
    }
  }, [user?.profileId, session?.access_token]);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const totalEarnings = transactions.filter((t) => t.status === 'completed').reduce((s, t) => s + t.commission_amount, 0);
  const pendingEarnings = transactions.filter((t) => t.status === 'pending').reduce((s, t) => s + t.commission_amount, 0);
  const level1Count = transactions.filter((t) => t.commission_level === 1).length;
  const level2Count = transactions.filter((t) => t.commission_level === 2).length;

  const stats: { label: string; value: string; icon: IconName; color: string }[] = [
    { label: 'Total Referrals', value: String(totalReferrals), icon: 'users', color: '#7B5CFA' },
    { label: 'Total Earnings', value: `₹${totalEarnings.toLocaleString('en-IN')}`, icon: 'trending-up', color: '#22C55E' },
    { label: 'Pending', value: `₹${pendingEarnings.toLocaleString('en-IN')}`, icon: 'clock', color: '#F59E0B' },
    { label: 'Level 1 / 2 earnings', value: `${level1Count} / ${level2Count}`, icon: 'bar-chart-2', color: '#1F7BFF' },
  ];

  if (!user || !session) {
    return (
      <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
        <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>Referrals</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={s.authGate}>
          <Icon name="users" size={48} color={colors.mutedForeground} />
          <Text style={[s.authGateTitle, { color: colors.foreground }]}>Sign in to view your referral dashboard</Text>
          <TouchableOpacity style={[s.signInBtn, { backgroundColor: colors.primary }]} onPress={() => router.push('/(auth)' as never)}>
            <Text style={s.signInBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View></AmbientBackground>
    );
  }

  return (
    <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Referrals</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {loadFailed && (
            <TouchableOpacity onPress={onRefresh} style={s.retry}>
              <Icon name="refresh-cw" size={14} color="#fff" />
              <Text style={s.retryText}>Could not load your referral data. Tap to retry.</Text>
            </TouchableOpacity>
          )}
          <LinearGradient colors={['#7C3AED', '#1F7BFF']} style={s.topCard}>
            <Text style={s.topTitle}>Invite & Earn</Text>
            <Text style={s.topSub}>Earn {commissionRates.l1}% when people you invite book{commissionRates.l2 > 0 ? `, and ${commissionRates.l2}% on their invites` : ''}</Text>
            <View style={s.codeBox}>
              <Text style={s.codeText}>{code || (loadFailed ? 'Unavailable' : '...')}</Text>
              <View style={s.codeActions}>
                <TouchableOpacity onPress={copy} style={s.codeBtn}>
                  <Icon name="copy" size={16} color="#7C3AED" />
                  <Text style={s.codeBtnText}>{copied ? 'Copied!' : 'Copy'}</Text>
                </TouchableOpacity>
                <View style={s.codeDivider} />
                <TouchableOpacity onPress={share} style={s.codeBtn}>
                  <Icon name="share-2" size={16} color="#7C3AED" />
                  <Text style={s.codeBtnText}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={s.urlBox}>
              <Text style={s.urlText} numberOfLines={1} ellipsizeMode="middle">{code ? linkFor(code) : 'Your link will appear here'}</Text>
              <View style={s.codeActions}>
                <TouchableOpacity
                  onPress={async () => {
                    if (!code) return;
                    await Clipboard.setStringAsync(linkFor(code));
                    showToast('Link copied!');
                  }}
                  style={s.codeBtn}
                >
                  <Icon name="copy" size={14} color="rgba(255,255,255,0.8)" />
                  <Text style={s.urlBtnText}>Copy</Text>
                </TouchableOpacity>
                <View style={s.urlDivider} />
                <TouchableOpacity onPress={share} style={s.codeBtn}>
                  <Icon name="share-2" size={14} color="rgba(255,255,255,0.8)" />
                  <Text style={s.urlBtnText}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>

          <View style={s.statsGrid}>
            {stats.map((st) => (
              <View key={st.label} style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Icon name={st.icon} size={20} color={st.color} />
                <Text style={[s.statVal, { color: colors.foreground }]}>{st.value}</Text>
                <Text style={[s.statLabel, { color: colors.mutedForeground }]}>{st.label}</Text>
              </View>
            ))}
          </View>

          <View style={[s.commCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.commCardTitle, { color: colors.foreground }]}>Commission Rates</Text>
            <View style={s.commRates}>
              <View style={s.commRate}>
                <Text style={[s.commLevel, { color: '#7B5CFA' }]}>L1</Text>
                <Text style={[s.commPct, { color: colors.foreground }]}>{commissionRates.l1}%</Text>
                <Text style={[s.commDesc, { color: colors.mutedForeground }]}>Direct referral commission</Text>
              </View>
              <View style={[s.commSep, { backgroundColor: colors.border }]} />
              <View style={s.commRate}>
                <Text style={[s.commLevel, { color: '#1F7BFF' }]}>L2</Text>
                <Text style={[s.commPct, { color: colors.foreground }]}>{commissionRates.l2}%</Text>
                <Text style={[s.commDesc, { color: colors.mutedForeground }]}>{commissionRates.l2 > 0 ? '2nd-level commission' : 'Upgrade your plan to earn here'}</Text>
              </View>
            </View>
            <View style={[s.planBadge, { backgroundColor: colors.muted }]}>
              <Text style={[s.planBadgeText, { color: colors.mutedForeground }]}>{commissionRates.planName} Plan</Text>
            </View>
          </View>

          <Text style={[s.sectionTitle, { color: colors.foreground }]}>Referral History</Text>
          <View style={[s.table, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[s.tableRow, s.tableHead, { borderBottomColor: colors.border, backgroundColor: colors.muted }]}>
              <Text style={[s.thCell, s.colUser, { color: colors.mutedForeground }]}>User</Text>
              <Text style={[s.thCell, s.colLevel, { color: colors.mutedForeground }]}>Lvl</Text>
              <Text style={[s.thCell, s.colAmt, { color: colors.mutedForeground }]}>Amount</Text>
              <Text style={[s.thCell, s.colStatusHead, { color: colors.mutedForeground }]}>Status</Text>
              <Text style={[s.thCell, s.colDate, { color: colors.mutedForeground }]}>Date</Text>
            </View>
            {transactions.length === 0 ? (
              <View style={s.emptyState}>
                <Icon name="users" size={36} color={colors.mutedForeground} />
                <Text style={[s.emptyTitle, { color: colors.foreground }]}>No referrals yet</Text>
                <Text style={[s.emptySubtitle, { color: colors.mutedForeground }]}>Share your code to start earning!</Text>
              </View>
            ) : (
              transactions.map((row, i) => {
                const statusKey = row.status;
                const sc = STATUS_COLORS[statusKey] ?? '#6B7280';
                const isLast = i === transactions.length - 1;
                const level = `L${row.commission_level}` as 'L1' | 'L2';
                const userName = row.referred_name || 'A WishMe member';
                const dateStr = new Date(row.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                const displayStatus = statusKey.charAt(0).toUpperCase() + statusKey.slice(1);

                return (
                  <View
                    key={row.id}
                    style={[s.tableRow, { borderBottomWidth: isLast ? 0 : 1, borderBottomColor: colors.border }]}
                  >
                    <View style={s.colUser}>
                      <Text style={[s.tdCell, { color: colors.foreground }]} numberOfLines={1}>{userName}</Text>
                      {row.order_type && ORDER_LABELS[row.order_type] ? <Text style={[s.orderLabel, { color: colors.mutedForeground }]} numberOfLines={1}>{ORDER_LABELS[row.order_type]}</Text> : null}
                    </View>
                    <View style={s.colLevel}>
                      <View style={[s.levelBadge, { backgroundColor: level === 'L1' ? '#7B5CFA20' : '#1F7BFF20' }]}>
                        <Text style={[s.levelText, { color: level === 'L1' ? '#7B5CFA' : '#1F7BFF' }]}>{level}</Text>
                      </View>
                    </View>
                    <Text style={[s.tdCell, s.colAmt, { color: '#22C55E' }]}>₹{row.commission_amount.toLocaleString('en-IN')}</Text>
                    <View style={s.colStatus}>
                      <View style={[s.statusBadge, { backgroundColor: sc + '20' }]}>
                        <Text style={[s.statusText, { color: sc }]} numberOfLines={1}>{displayStatus}</Text>
                      </View>
                    </View>
                    <Text style={[s.tdCell, s.colDate, { color: colors.mutedForeground }]} numberOfLines={1}>{dateStr}</Text>
                  </View>
                );
              })
            )}
          </View>

          <View style={[s.summaryRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.summaryItem}>
              <Text style={[s.summaryLabel, { color: colors.mutedForeground }]}>Total Earned</Text>
              <Text style={[s.summaryVal, { color: '#22C55E' }]}>₹{totalEarnings.toLocaleString('en-IN')}</Text>
            </View>
            <View style={[s.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={s.summaryItem}>
              <Text style={[s.summaryLabel, { color: colors.mutedForeground }]}>Pending</Text>
              <Text style={[s.summaryVal, { color: '#F59E0B' }]}>₹{pendingEarnings.toLocaleString('en-IN')}</Text>
            </View>
          </View>

          {allPlans.length > 1 && (
            <View style={[s.commCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.commCardTitle, { color: colors.foreground }]}>Earn more with a higher plan</Text>
              <View style={[s.planRow, s.planHead]}>
                <Text style={[s.planCell, { flex: 1.4, color: colors.mutedForeground, textAlign: 'left' }]}>Plan</Text>
                <Text style={[s.planCell, { color: colors.mutedForeground }]}>Level 1</Text>
                <Text style={[s.planCell, { color: colors.mutedForeground }]}>Level 2</Text>
              </View>
              {allPlans.map(pl => {
                const mine = pl.name.toLowerCase() === commissionRates.planName.toLowerCase();
                return (
                  <View key={pl.name} style={[s.planRow, mine && { backgroundColor: colors.primary + '18', borderRadius: 10 }]}>
                    <Text style={[s.planCell, { flex: 1.4, color: colors.foreground, textAlign: 'left', fontFamily: 'Inter_600SemiBold' }]}>
                      {pl.name}{mine ? '  (yours)' : ''}
                    </Text>
                    <Text style={[s.planCell, { color: '#7B5CFA', fontFamily: 'Inter_700Bold' }]}>{pl.l1}%</Text>
                    <Text style={[s.planCell, { color: pl.l2 > 0 ? '#1F7BFF' : colors.mutedForeground, fontFamily: 'Inter_700Bold' }]}>{pl.l2}%</Text>
                  </View>
                );
              })}
            </View>
          )}

          <TouchableOpacity style={[s.upgradeBtn, { borderColor: colors.primary }]} onPress={() => router.push('/select-plan' as never)}>
            <Icon name="trending-up" size={18} color={colors.primary} />
            <Text style={[s.upgradeBtnText, { color: colors.primary }]}>Upgrade Plan for Higher Commissions</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {toast.length > 0 && (
        <View style={s.toast} pointerEvents="none">
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}
    </View></AmbientBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  authGate: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 16 },
  authGateTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  signInBtn: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 },
  signInBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  topCard: { padding: 24, alignItems: 'center', margin: 16, borderRadius: 20 },
  topTitle: { color: '#fff', fontSize: 26, fontFamily: 'PlayfairDisplay_700Bold', marginBottom: 8 },
  topSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  codeBox: { backgroundColor: '#fff', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, width: '100%' },
  codeText: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#7C3AED', letterSpacing: 2 },
  codeActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  codeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6 },
  codeBtnText: { color: '#7C3AED', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  codeDivider: { width: 1, height: 18, backgroundColor: '#7C3AED40' },
  urlBox: { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, width: '100%' },
  urlText: { flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.9)', marginRight: 8 },
  urlBtnText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  urlDivider: { width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.3)' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginBottom: 16 },
  statCard: { width: '47%', borderRadius: 14, borderWidth: 1, padding: 14, alignItems: 'center', gap: 6 },
  statVal: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  commCard: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  commCardTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', marginBottom: 14 },
  commRates: { flexDirection: 'row', alignItems: 'center' },
  commRate: { flex: 1, alignItems: 'center', gap: 4 },
  commSep: { width: 1, height: 48, marginHorizontal: 16 },
  commLevel: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  commPct: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  commDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  planBadge: { marginTop: 12, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999 },
  planBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', marginHorizontal: 16, marginBottom: 10 },
  table: { marginHorizontal: 16, borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 12 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10 },
  tableHead: {},
  thCell: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  tdCell: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  colUser: { flex: 2.2 },
  colLevel: { flex: 1, alignItems: 'center' },
  colAmt: { flex: 1.5, textAlign: 'right', paddingRight: 12 },
  colStatus: { flex: 1.6, alignItems: 'center' },
  colStatusHead: { flex: 1.6, textAlign: 'center' },
  colDate: { flex: 1.4, textAlign: 'right', fontSize: 11 },
  orderLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 1 },
  levelBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 9999 },
  levelText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 9999 },
  statusText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  emptySubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  summaryRow: { flexDirection: 'row', marginHorizontal: 16, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 16 },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryDivider: { width: 1, marginHorizontal: 8 },
  summaryLabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  summaryVal: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  upgradeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginHorizontal: 16, borderRadius: 14, borderWidth: 2, paddingVertical: 14 },
  upgradeBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  planRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 8 },
  planHead: { paddingVertical: 4 },
  planCell: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#DC2626', marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 12 },
  retryText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_500Medium', flex: 1 },
  toast: { position: 'absolute', bottom: 80, left: 24, right: 24, backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  toastText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center' },
});
