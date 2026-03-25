import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Clipboard,
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

interface ReferralTransaction {
  id: string;
  referrer_id: string;
  referred_id: string | null;
  booking_id: string | null;
  commission_level: 1 | 2;
  commission_amount: number;
  status: 'completed' | 'pending';
  created_at: string;
  order_type: string | null;
}

interface ReferredUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export default function ReferralsScreen() {
  const { colors } = useTheme();
  const { user, session } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const code = user?.referralCode ?? 'WISHME2025';

  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [commissionRates, setCommissionRates] = useState<CommissionRates>({ l1: 10, l2: 5, planName: 'Basic' });
  const [transactions, setTransactions] = useState<ReferralTransaction[]>([]);
  const [referredUsersMap, setReferredUsersMap] = useState<Map<string, ReferredUser>>(new Map());
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [referralUrl, setReferralUrl] = useState<string>('');

  const copy = () => {
    Clipboard.setString(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    const url = referralUrl || `https://wishme.app/invite?ref=${code}`;
    try {
      await Share.share({ message: `Join WishMe and book celebrity wishes! Use my referral code: ${code}\n${url}` });
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

      const profileRes = await supabaseFetch(
        `/rest/v1/profiles?select=plan,referral_url&id=eq.${user.profileId}&limit=1`,
        {},
        token,
      );
      const profileData = profileRes.ok ? await profileRes.json() : [];
      const profile = profileData[0] ?? {};
      const planName: string = profile.plan ?? 'Basic';
      const fetchedUrl: string = profile.referral_url ?? '';
      setReferralUrl(fetchedUrl || `https://wishme.app/invite?ref=${code}`);

      const [ratesRes, txRes, directRes] = await Promise.all([
        supabaseFetch(
          `/rest/v1/plans?select=name,referral_commission_l1,referral_commission_l2&name=eq.${encodeURIComponent(planName)}`,
          {},
          token,
        ),
        supabaseFetch(
          `/rest/v1/referral_transactions?select=*&referrer_id=eq.${user.profileId}&order=created_at.desc`,
          {},
          token,
        ),
        supabaseFetch(
          `/rest/v1/profiles?select=id,first_name,last_name,email,created_at&referred_by=eq.${user.profileId}`,
          {},
          token,
        ),
      ]);

      if (ratesRes.ok) {
        const ratesData = await ratesRes.json();
        if (ratesData.length > 0) {
          setCommissionRates({
            l1: ratesData[0].referral_commission_l1 ?? 10,
            l2: ratesData[0].referral_commission_l2 ?? 5,
            planName: ratesData[0].name ?? planName,
          });
        } else {
          setCommissionRates((prev) => ({ ...prev, planName }));
        }
      }

      const txData: ReferralTransaction[] = txRes.ok ? await txRes.json() : [];
      setTransactions(txData);

      const directData: ReferredUser[] = directRes.ok ? await directRes.json() : [];
      setTotalReferrals(directData.length);

      const allIds = new Set<string>();
      for (const tx of txData) {
        if (tx.referred_id) allIds.add(tx.referred_id);
      }
      for (const u of directData) {
        allIds.add(u.id);
      }

      if (allIds.size > 0) {
        const idsStr = Array.from(allIds).join(',');
        const usersRes = await supabaseFetch(
          `/rest/v1/profiles?select=id,first_name,last_name,email&id=in.(${idsStr})`,
          {},
          token,
        );
        const usersData: ReferredUser[] = usersRes.ok ? await usersRes.json() : [];
        const map = new Map<string, ReferredUser>();
        for (const u of directData) map.set(u.id, u);
        for (const u of usersData) map.set(u.id, u);
        setReferredUsersMap(map);
      } else {
        setReferredUsersMap(new Map());
      }
    } catch {
      showToast('Failed to load referral data');
    }
  }, [user?.profileId, session?.access_token, code]);

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
    { label: 'Total Referrals', value: String(totalReferrals), icon: 'users', color: '#FF6B33' },
    { label: 'Total Earnings', value: `₹${totalEarnings.toLocaleString('en-IN')}`, icon: 'trending-up', color: '#22C55E' },
    { label: 'Pending', value: `₹${pendingEarnings.toLocaleString('en-IN')}`, icon: 'clock', color: '#F59E0B' },
    { label: 'L1 / L2 refs', value: `${level1Count} / ${level2Count}`, icon: 'bar-chart-2', color: '#B44CFF' },
  ];

  if (!user || !session) {
    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
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
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
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
          <LinearGradient colors={['#7B2FFF', '#B44CFF']} style={s.topCard}>
            <Text style={s.topTitle}>Invite & Earn</Text>
            <Text style={s.topSub}>Earn {commissionRates.l1}% on direct bookings</Text>
            <View style={s.codeBox}>
              <Text style={s.codeText}>{code}</Text>
              <View style={s.codeActions}>
                <TouchableOpacity onPress={copy} style={s.codeBtn}>
                  <Icon name="copy" size={16} color="#7B2FFF" />
                  <Text style={s.codeBtnText}>{copied ? 'Copied!' : 'Copy'}</Text>
                </TouchableOpacity>
                <View style={s.codeDivider} />
                <TouchableOpacity onPress={share} style={s.codeBtn}>
                  <Icon name="share-2" size={16} color="#7B2FFF" />
                  <Text style={s.codeBtnText}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={s.urlBox}>
              <Text style={s.urlText} numberOfLines={1} ellipsizeMode="middle">{referralUrl || `https://wishme.app/invite?ref=${code}`}</Text>
              <View style={s.codeActions}>
                <TouchableOpacity
                  onPress={() => {
                    Clipboard.setString(referralUrl || `https://wishme.app/invite?ref=${code}`);
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
                <Text style={[s.commLevel, { color: '#FF6B33' }]}>L1</Text>
                <Text style={[s.commPct, { color: colors.foreground }]}>{commissionRates.l1}%</Text>
                <Text style={[s.commDesc, { color: colors.mutedForeground }]}>Direct referral commission</Text>
              </View>
              <View style={[s.commSep, { backgroundColor: colors.border }]} />
              <View style={s.commRate}>
                <Text style={[s.commLevel, { color: '#B44CFF' }]}>L2</Text>
                <Text style={[s.commPct, { color: colors.foreground }]}>{commissionRates.l2}%</Text>
                <Text style={[s.commDesc, { color: colors.mutedForeground }]}>2nd-level commission</Text>
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
              <Text style={[s.thCell, s.colStatus, { color: colors.mutedForeground }]}>Status</Text>
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
                const referredUser = row.referred_id ? referredUsersMap.get(row.referred_id) : null;
                let userName = 'Unknown';
                if (referredUser) {
                  const fn = referredUser.first_name ?? '';
                  const ln = referredUser.last_name ?? '';
                  if (fn || ln) {
                    userName = `${fn} ${ln}`.trim();
                  } else if (referredUser.email) {
                    userName = referredUser.email;
                  }
                }
                const dateStr = new Date(row.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                const displayStatus = statusKey.charAt(0).toUpperCase() + statusKey.slice(1);

                return (
                  <View
                    key={row.id}
                    style={[s.tableRow, { borderBottomWidth: isLast ? 0 : 1, borderBottomColor: colors.border }]}
                  >
                    <Text style={[s.tdCell, s.colUser, { color: colors.foreground }]} numberOfLines={1}>{userName}</Text>
                    <View style={s.colLevel}>
                      <View style={[s.levelBadge, { backgroundColor: level === 'L1' ? '#FF6B3320' : '#B44CFF20' }]}>
                        <Text style={[s.levelText, { color: level === 'L1' ? '#FF6B33' : '#B44CFF' }]}>{level}</Text>
                      </View>
                    </View>
                    <Text style={[s.tdCell, s.colAmt, { color: '#22C55E' }]}>₹{row.commission_amount}</Text>
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

          <TouchableOpacity style={[s.upgradeBtn, { borderColor: colors.primary }]} onPress={() => router.push('/plan' as never)}>
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
    </View>
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
  codeText: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#7B2FFF', letterSpacing: 2 },
  codeActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  codeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6 },
  codeBtnText: { color: '#7B2FFF', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  codeDivider: { width: 1, height: 18, backgroundColor: '#7B2FFF40' },
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
  colUser: { flex: 2 },
  colLevel: { flex: 1, alignItems: 'center' },
  colAmt: { flex: 1.5, textAlign: 'right' },
  colStatus: { flex: 1.5, alignItems: 'center' },
  colDate: { flex: 1.5, textAlign: 'right', fontSize: 11 },
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
  toast: { position: 'absolute', bottom: 80, left: 24, right: 24, backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  toastText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center' },
});
