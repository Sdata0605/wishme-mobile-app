import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { MOCK_CELEBRITY_COMMISSIONS, MOCK_REFERRAL_EARNINGS } from '@/constants/mockData';
import { useTheme } from '@/context/ThemeContext';

const EARNINGS = [
  { month: 'Jan', amount: 800 },
  { month: 'Feb', amount: 1200 },
  { month: 'Mar', amount: 950 },
  { month: 'Apr', amount: 1600 },
  { month: 'May', amount: 2100 },
  { month: 'Jun', amount: 1800 },
];

const STATUS_COLORS: Record<string, string> = {
  Completed: '#22C55E',
  Pending: '#F59E0B',
  Failed: '#EF4444',
};

const LEVEL_COLORS: Record<string, string> = { L1: '#FF6B33', L2: '#B44CFF' };

export default function CommissionScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const max = Math.max(...EARNINGS.map((e) => e.amount));

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const totalReferral = MOCK_REFERRAL_EARNINGS.filter(r => r.status === 'Completed').reduce((s, r) => s + r.amount, 0);
  const totalCelebrity = MOCK_CELEBRITY_COMMISSIONS.reduce((s, c) => s + c.netAmount, 0);
  const totalTds = MOCK_CELEBRITY_COMMISSIONS.reduce((s, c) => s + c.tdsAmount, 0);

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Commission</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        {/* Top hero */}
        <LinearGradient colors={['#FF6B33', '#B44CFF']} style={s.topCard}>
          <Text style={s.earningsLabel}>Total Earned</Text>
          <Text style={s.earnings}>₹{(totalReferral + totalCelebrity).toLocaleString('en-IN')}</Text>
          <View style={s.heroStats}>
            <View style={s.heroStatItem}>
              <Text style={s.heroStatVal}>₹2,100</Text>
              <Text style={s.heroStatLabel}>This Month</Text>
            </View>
            <View style={s.heroDivider} />
            <View style={s.heroStatItem}>
              <Text style={s.heroStatVal}>₹1,200</Text>
              <Text style={s.heroStatLabel}>Pending</Text>
            </View>
          </View>
          <TouchableOpacity style={s.withdrawBtn}>
            <Text style={s.withdrawBtnText}>Withdraw Earnings</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* 3-card summary */}
        <View style={s.summaryRow}>
          <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Icon name="users" size={18} color="#FF6B33" />
            <Text style={[s.summaryVal, { color: colors.foreground }]}>₹{totalReferral.toLocaleString('en-IN')}</Text>
            <Text style={[s.summaryLabel, { color: colors.mutedForeground }]}>Referral Earned</Text>
          </View>
          <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Icon name="star" size={18} color="#B44CFF" />
            <Text style={[s.summaryVal, { color: colors.foreground }]}>₹{totalCelebrity.toLocaleString('en-IN')}</Text>
            <Text style={[s.summaryLabel, { color: colors.mutedForeground }]}>Celebrity Earned</Text>
          </View>
          <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Icon name="alert-circle" size={18} color="#EF4444" />
            <Text style={[s.summaryVal, { color: colors.foreground }]}>₹{totalTds.toLocaleString('en-IN')}</Text>
            <Text style={[s.summaryLabel, { color: colors.mutedForeground }]}>TDS Deducted</Text>
          </View>
        </View>

        {/* Date filter */}
        <View style={[s.dateFilter, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.dateFilterTitle, { color: colors.foreground }]}>Filter by Date</Text>
          <View style={s.dateInputRow}>
            <View style={[s.dateInput, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <Icon name="calendar" size={14} color={colors.mutedForeground} />
              <TextInput
                style={[s.dateInputText, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
                placeholder="Start Date"
                placeholderTextColor={colors.mutedForeground}
                value={startDate}
                onChangeText={setStartDate}
              />
            </View>
            <View style={[s.dateInput, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <Icon name="calendar" size={14} color={colors.mutedForeground} />
              <TextInput
                style={[s.dateInputText, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
                placeholder="End Date"
                placeholderTextColor={colors.mutedForeground}
                value={endDate}
                onChangeText={setEndDate}
              />
            </View>
          </View>
        </View>

        {/* Referral Commissions */}
        <Text style={[s.sectionTitle, { color: colors.foreground }]}>Referral Commissions</Text>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {MOCK_REFERRAL_EARNINGS.map((item) => {
            const sc = STATUS_COLORS[item.status] ?? '#6B7280';
            const lc = LEVEL_COLORS[item.level] ?? '#6B7280';
            return (
              <View key={item.id} style={[s.commCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={s.commCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.commBookingId, { color: colors.foreground }]}>{item.bookingId}</Text>
                    <Text style={[s.commDate, { color: colors.mutedForeground }]}>{item.date}</Text>
                  </View>
                  <View style={[s.levelBadge, { backgroundColor: lc + '20' }]}>
                    <Text style={[s.levelText, { color: lc }]}>{item.level}</Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: sc + '20' }]}>
                    <Text style={[s.statusText, { color: sc }]}>{item.status}</Text>
                  </View>
                </View>
                <Text style={[s.commAmount, { color: '#22C55E' }]}>+₹{item.amount.toLocaleString('en-IN')}</Text>
              </View>
            );
          })}
        </View>

        {/* Celebrity Commissions */}
        <Text style={[s.sectionTitle, { color: colors.foreground }]}>Celebrity Commissions</Text>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {MOCK_CELEBRITY_COMMISSIONS.map((item) => (
            <View key={item.id} style={[s.commCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.commCardTop}>
                <Text style={[s.commBookingId, { color: colors.foreground }]} numberOfLines={1}>{item.description}</Text>
                <Text style={[s.commDate, { color: colors.mutedForeground }]}>{item.date}</Text>
              </View>
              <View style={s.celebCommRow}>
                <View style={s.celebCommItem}>
                  <Text style={[s.celebCommLabel, { color: colors.mutedForeground }]}>Gross</Text>
                  <Text style={[s.celebCommVal, { color: colors.foreground }]}>₹{item.grossAmount.toLocaleString('en-IN')}</Text>
                </View>
                <View style={s.celebCommItem}>
                  <Text style={[s.celebCommLabel, { color: colors.mutedForeground }]}>TDS {item.tdsPercent}%</Text>
                  <Text style={[s.celebCommVal, { color: '#EF4444' }]}>-₹{item.tdsAmount.toLocaleString('en-IN')}</Text>
                </View>
                <View style={s.celebCommItem}>
                  <Text style={[s.celebCommLabel, { color: colors.mutedForeground }]}>Net</Text>
                  <Text style={[s.celebCommVal, { color: '#22C55E' }]}>₹{item.netAmount.toLocaleString('en-IN')}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Earnings chart */}
        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <Text style={[s.sectionTitle, { color: colors.foreground, marginHorizontal: 0, marginBottom: 10 }]}>Earnings Chart</Text>
          <View style={[s.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.bars}>
              {EARNINGS.map((e) => (
                <View key={e.month} style={s.barWrap}>
                  <LinearGradient
                    colors={['#FF6B33', '#B44CFF']}
                    style={[s.bar, { height: (e.amount / max) * 120 }]}
                  />
                  <Text style={[s.barMonth, { color: colors.mutedForeground }]}>{e.month}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  topCard: { margin: 16, borderRadius: 20, padding: 24, alignItems: 'center' },
  earningsLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontFamily: 'Inter_500Medium', marginBottom: 4 },
  earnings: { color: '#fff', fontSize: 40, fontFamily: 'Inter_700Bold', marginBottom: 16 },
  heroStats: { flexDirection: 'row', width: '100%', marginBottom: 16 },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatVal: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold' },
  heroStatLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  heroDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 8 },
  withdrawBtn: { backgroundColor: '#fff', paddingHorizontal: 24, paddingVertical: 11, borderRadius: 9999 },
  withdrawBtnText: { color: '#FF6B33', fontSize: 14, fontFamily: 'Inter_700Bold' },
  summaryRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 16 },
  summaryCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: 'center', gap: 5 },
  summaryVal: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  summaryLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  dateFilter: { marginHorizontal: 16, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 16 },
  dateFilterTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 10 },
  dateInputRow: { flexDirection: 'row', gap: 10 },
  dateInput: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 10, height: 42 },
  dateInputText: { flex: 1, fontSize: 13, height: 42 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', marginHorizontal: 16, marginBottom: 10, marginTop: 8 },
  commCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  commCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commBookingId: { fontSize: 14, fontFamily: 'Inter_600SemiBold', flex: 1 },
  commDate: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  commAmount: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  levelBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9999 },
  levelText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9999 },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  celebCommRow: { flexDirection: 'row', gap: 8 },
  celebCommItem: { flex: 1, alignItems: 'center', gap: 2 },
  celebCommLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  celebCommVal: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  chartCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 140, paddingBottom: 24 },
  barWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  bar: { width: '100%', borderRadius: 6 },
  barMonth: { fontSize: 11, fontFamily: 'Inter_500Medium' },
});
