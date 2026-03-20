import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Clipboard, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { COMMISSION_RATES, MOCK_REFERRAL_TABLE } from '@/constants/mockData';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

const STATUS_COLORS: Record<string, string> = {
  Completed: '#22C55E',
  Pending: '#F59E0B',
  Failed: '#EF4444',
};

export default function ReferralsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState('');
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const code = user?.referralCode ?? 'WISHME2025';

  const copy = () => {
    Clipboard.setString(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    try {
      await Share.share({ message: `Join WishMe and book celebrity wishes! Use my referral code: ${code}` });
    } catch {
      showToast('Share not available');
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const stats: { label: string; value: string; icon: IconName; color: string }[] = [
    { label: 'Total Referrals', value: '12', icon: 'users', color: '#FF6B33' },
    { label: 'Total Earnings', value: '₹2,400', icon: 'trending-up', color: '#22C55E' },
    { label: 'Pending', value: '₹349', icon: 'clock', color: '#F59E0B' },
    { label: 'L1: 8 / L2: 4', value: '8/4', icon: 'bar-chart-2', color: '#B44CFF' },
  ];

  const totalEarned = MOCK_REFERRAL_TABLE.filter(r => r.status === 'Completed').reduce((s, r) => s + r.amount, 0);
  const pendingEarned = MOCK_REFERRAL_TABLE.filter(r => r.status === 'Pending').reduce((s, r) => s + r.amount, 0);

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Referrals</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        {/* Hero card */}
        <LinearGradient colors={['#7B2FFF', '#B44CFF']} style={s.topCard}>
          <Text style={s.topTitle}>Invite & Earn</Text>
          <Text style={s.topSub}>Earn 10% commission on every booking made by your referrals</Text>
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
        </LinearGradient>

        {/* 4-stat grid */}
        <View style={s.statsGrid}>
          {stats.map((st) => (
            <View key={st.label} style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Icon name={st.icon} size={20} color={st.color} />
              <Text style={[s.statVal, { color: colors.foreground }]}>{st.label === 'L1: 8 / L2: 4' ? '' : st.value}</Text>
              <Text style={[s.statLabel, { color: colors.mutedForeground }]}>{st.label}</Text>
            </View>
          ))}
        </View>

        {/* Commission Rates */}
        <View style={[s.commCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.commCardTitle, { color: colors.foreground }]}>Commission Rates</Text>
          <View style={s.commRates}>
            <View style={s.commRate}>
              <Text style={[s.commLevel, { color: '#FF6B33' }]}>L1</Text>
              <Text style={[s.commPct, { color: colors.foreground }]}>{COMMISSION_RATES.L1.pct}%</Text>
              <Text style={[s.commDesc, { color: colors.mutedForeground }]}>{COMMISSION_RATES.L1.label}</Text>
            </View>
            <View style={[s.commSep, { backgroundColor: colors.border }]} />
            <View style={s.commRate}>
              <Text style={[s.commLevel, { color: '#B44CFF' }]}>L2</Text>
              <Text style={[s.commPct, { color: colors.foreground }]}>{COMMISSION_RATES.L2.pct}%</Text>
              <Text style={[s.commDesc, { color: colors.mutedForeground }]}>{COMMISSION_RATES.L2.label}</Text>
            </View>
          </View>
        </View>

        {/* Referral History Table */}
        <Text style={[s.sectionTitle, { color: colors.foreground }]}>Referral History</Text>
        <View style={[s.table, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Table header */}
          <View style={[s.tableRow, s.tableHead, { borderBottomColor: colors.border, backgroundColor: colors.muted }]}>
            <Text style={[s.thCell, s.colUser, { color: colors.mutedForeground }]}>User</Text>
            <Text style={[s.thCell, s.colLevel, { color: colors.mutedForeground }]}>Lvl</Text>
            <Text style={[s.thCell, s.colAmt, { color: colors.mutedForeground }]}>Amount</Text>
            <Text style={[s.thCell, s.colStatus, { color: colors.mutedForeground }]}>Status</Text>
            <Text style={[s.thCell, s.colDate, { color: colors.mutedForeground }]}>Date</Text>
          </View>
          {MOCK_REFERRAL_TABLE.map((row, i) => {
            const sc = STATUS_COLORS[row.status] ?? '#6B7280';
            const isLast = i === MOCK_REFERRAL_TABLE.length - 1;
            return (
              <View key={row.id} style={[s.tableRow, { borderBottomWidth: isLast ? 0 : 1, borderBottomColor: colors.border }]}>
                <Text style={[s.tdCell, s.colUser, { color: colors.foreground }]} numberOfLines={1}>{row.referredUser}</Text>
                <View style={s.colLevel}>
                  <View style={[s.levelBadge, { backgroundColor: row.level === 'L1' ? '#FF6B3320' : '#B44CFF20' }]}>
                    <Text style={[s.levelText, { color: row.level === 'L1' ? '#FF6B33' : '#B44CFF' }]}>{row.level}</Text>
                  </View>
                </View>
                <Text style={[s.tdCell, s.colAmt, { color: '#22C55E' }]}>₹{row.amount}</Text>
                <View style={s.colStatus}>
                  <View style={[s.statusBadge, { backgroundColor: sc + '20' }]}>
                    <Text style={[s.statusText, { color: sc }]} numberOfLines={1}>{row.status}</Text>
                  </View>
                </View>
                <Text style={[s.tdCell, s.colDate, { color: colors.mutedForeground }]} numberOfLines={1}>{row.date.slice(5)}</Text>
              </View>
            );
          })}
        </View>

        {/* Summary below table */}
        <View style={[s.summaryRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.summaryItem}>
            <Text style={[s.summaryLabel, { color: colors.mutedForeground }]}>Total Earned</Text>
            <Text style={[s.summaryVal, { color: '#22C55E' }]}>₹{totalEarned.toLocaleString('en-IN')}</Text>
          </View>
          <View style={[s.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={s.summaryItem}>
            <Text style={[s.summaryLabel, { color: colors.mutedForeground }]}>Pending</Text>
            <Text style={[s.summaryVal, { color: '#F59E0B' }]}>₹{pendingEarned.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        {/* Upgrade Plan CTA */}
        <TouchableOpacity style={[s.upgradeBtn, { borderColor: colors.primary }]} onPress={() => showToast('Plan upgrade coming soon!')}>
          <Icon name="trending-up" size={18} color={colors.primary} />
          <Text style={[s.upgradeBtnText, { color: colors.primary }]}>Upgrade Plan for Higher Commissions</Text>
        </TouchableOpacity>
      </ScrollView>

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
  topCard: { padding: 24, alignItems: 'center', margin: 16, borderRadius: 20 },
  topTitle: { color: '#fff', fontSize: 26, fontFamily: 'PlayfairDisplay_700Bold', marginBottom: 8 },
  topSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  codeBox: { backgroundColor: '#fff', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, width: '100%' },
  codeText: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#7B2FFF', letterSpacing: 2 },
  codeActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  codeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6 },
  codeBtnText: { color: '#7B2FFF', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  codeDivider: { width: 1, height: 18, backgroundColor: '#7B2FFF40' },
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
  commDesc: { fontSize: 11, fontFamily: 'Inter_400Regular' },
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
