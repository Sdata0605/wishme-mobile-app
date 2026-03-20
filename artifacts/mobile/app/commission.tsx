import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';

const EARNINGS = [
  { month: 'Jan', amount: 800 },
  { month: 'Feb', amount: 1200 },
  { month: 'Mar', amount: 950 },
  { month: 'Apr', amount: 1600 },
  { month: 'May', amount: 2100 },
  { month: 'Jun', amount: 1800 },
];

export default function CommissionScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const max = Math.max(...EARNINGS.map((e) => e.amount));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Commission</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        <LinearGradient colors={['#FF6B33', '#B44CFF']} style={styles.topCard}>
          <Text style={styles.earningsLabel}>Total Earned</Text>
          <Text style={styles.earnings}>₹8,450</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statVal}>₹2,100</Text>
              <Text style={styles.statLabel}>This Month</Text>
            </View>
            <View style={[styles.divider]} />
            <View style={styles.statItem}>
              <Text style={styles.statVal}>₹1,200</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.withdrawBtn}>
            <Text style={styles.withdrawBtnText}>Withdraw Earnings</Text>
          </TouchableOpacity>
        </LinearGradient>

        <View style={{ padding: 20 }}>
          <Text style={[styles.chartTitle, { color: colors.foreground }]}>Earnings Chart</Text>
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.bars}>
              {EARNINGS.map((e) => (
                <View key={e.month} style={styles.barWrap}>
                  <LinearGradient
                    colors={['#FF6B33', '#B44CFF']}
                    style={[styles.bar, { height: (e.amount / max) * 120 }]}
                  />
                  <Text style={[styles.barMonth, { color: colors.mutedForeground }]}>{e.month}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  topCard: { margin: 20, borderRadius: 20, padding: 24, alignItems: 'center' },
  earningsLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontFamily: 'Inter_500Medium', marginBottom: 4 },
  earnings: { color: '#fff', fontSize: 42, fontFamily: 'Inter_700Bold', marginBottom: 20 },
  statsRow: { flexDirection: 'row', width: '100%', marginBottom: 20 },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { color: '#fff', fontSize: 20, fontFamily: 'Inter_700Bold' },
  statLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  divider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 8 },
  withdrawBtn: { backgroundColor: '#fff', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 9999 },
  withdrawBtnText: { color: '#FF6B33', fontSize: 14, fontFamily: 'Inter_700Bold' },
  chartTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', marginBottom: 14 },
  chartCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 140, paddingBottom: 24 },
  barWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  bar: { width: '100%', borderRadius: 6 },
  barMonth: { fontSize: 11, fontFamily: 'Inter_500Medium' },
});
