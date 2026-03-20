import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

export default function ReferralsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const copy = () => { setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const stats: { label: string; value: string; icon: IconName; color: string }[] = [
    { label: 'Total Referred', value: '12', icon: 'users', color: '#FF6B33' },
    { label: 'Active Users', value: '8', icon: 'check-circle', color: '#22C55E' },
    { label: 'Total Earned', value: '₹2,400', icon: 'trending-up', color: '#B44CFF' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Referrals</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        <LinearGradient colors={['#7B2FFF', '#B44CFF']} style={styles.topCard}>
          <Text style={styles.topTitle}>Invite & Earn</Text>
          <Text style={styles.topSub}>Earn 10% commission on every booking made by your referrals</Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{user?.referralCode ?? 'WISHME2025'}</Text>
            <TouchableOpacity onPress={copy} style={styles.copyBtn}>
              <Icon name="copy" size={16} color="#7B2FFF" />
              <Text style={styles.copyBtnText}>{copied ? 'Copied!' : 'Copy'}</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.statsRow}>
          {stats.map((s) => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Icon name={s.icon} size={20} color={s.color} />
              <Text style={[styles.statVal, { color: colors.foreground }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Referred Friends</Text>
        {['Priya S.', 'Rahul K.', 'Ankit M.', 'Neha R.'].map((name, i) => (
          <View key={i} style={[styles.friendRow, { borderBottomColor: colors.border }]}>
            <View style={[styles.friendAvatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.friendAvatarText}>{name[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.friendName, { color: colors.foreground }]}>{name}</Text>
              <Text style={[styles.friendJoined, { color: colors.mutedForeground }]}>Joined {30 - i * 7} days ago</Text>
            </View>
            <Text style={[styles.friendEarned, { color: '#22C55E' }]}>+₹{300 - i * 50}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  topCard: { padding: 24, alignItems: 'center', margin: 20, borderRadius: 20 },
  topTitle: { color: '#fff', fontSize: 26, fontFamily: 'PlayfairDisplay_700Bold', marginBottom: 8 },
  topSub: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', marginBottom: 20, lineHeight: 21 },
  codeBox: { backgroundColor: '#fff', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, width: '100%' },
  codeText: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#7B2FFF', letterSpacing: 2 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copyBtnText: { color: '#7B2FFF', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 24 },
  statCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, alignItems: 'center', gap: 6 },
  statVal: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', paddingHorizontal: 20, marginBottom: 12 },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  friendAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  friendAvatarText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  friendName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  friendJoined: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  friendEarned: { fontSize: 15, fontFamily: 'Inter_700Bold' },
});
