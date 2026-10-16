import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { BRAND_GRADIENT } from './sections';
import { fmtRupee } from './shared';
import type { ColorsType, Celebrity } from './shared';
import type { DashboardData } from './useDashboardData';

const timeAgo = (iso: string): string => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
};

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

/** The landing screen: the money, what is waiting, one-tap shortcuts, and what happened lately. */
export function OverviewScreen({
  celebrity,
  colors,
  data,
  onOpen,
  userFirstName,
}: {
  celebrity: Celebrity;
  colors: ColorsType;
  data: DashboardData;
  onOpen: (section: string) => void;
  userFirstName: string;
}) {
  const attention: Array<{ key: string; text: string; section: string; icon: IconName; tint: string }> = [];
  if (data.ordersToDo > 0) attention.push({ key: 'orders', text: `${data.ordersToDo} ${data.ordersToDo === 1 ? 'order is' : 'orders are'} waiting to be made`, section: 'orders', icon: 'shopping-bag', tint: '#D23FE0' });
  if (data.unreadMessages > 0) attention.push({ key: 'msg', text: `${data.unreadMessages} unread ${data.unreadMessages === 1 ? 'message' : 'messages'}`, section: 'messages', icon: 'message-circle', tint: '#1F7BFF' });
  if (data.loaded && !data.hasBank) attention.push({ key: 'bank', text: 'Add a bank account to withdraw your earnings', section: 'wallet', icon: 'wallet', tint: '#22C55E' });

  const stats: Array<{ key: string; label: string; value: string; section: string }> = [
    { key: 'month', label: "This month's earnings", value: fmtRupee(data.monthEarnings), section: 'wallet' },
    { key: 'todo', label: 'Orders to do', value: String(data.ordersToDo), section: 'orders' },
    { key: 'rating', label: `Rating · ${celebrity.review_count ?? 0} reviews`, value: `★ ${(celebrity.rating ?? 0).toFixed(1)}`, section: 'reviews' },
  ];

  const actions: Array<{ key: string; label: string; icon: IconName; tint: string; section: string }> = [
    { key: 'a1', label: 'Orders', icon: 'shopping-bag', tint: '#D23FE0', section: 'orders' },
    { key: 'a2', label: 'Withdraw', icon: 'wallet', tint: '#22C55E', section: 'wallet' },
    { key: 'a3', label: 'Messages', icon: 'message-circle', tint: '#1F7BFF', section: 'messages' },
    { key: 'a4', label: 'Upload', icon: 'upload', tint: '#2EC4B6', section: 'content' },
  ];

  return (
    <View style={s.wrap}>
      <LinearGradient colors={BRAND_GRADIENT as unknown as [string, string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <View style={{ flex: 1 }}>
          <Text style={s.heroHello} numberOfLines={1}>{greeting()}, {userFirstName || celebrity.name.split(' ')[0]}</Text>
          <Text style={s.heroSub} numberOfLines={1}>{celebrity.category}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.heroLabel}>Available balance</Text>
          <Text style={s.heroAmount} numberOfLines={1} adjustsFontSizeToFit>{fmtRupee(celebrity.available_balance ?? 0)}</Text>
          <TouchableOpacity onPress={() => onOpen('wallet')} style={s.heroBtn} accessibilityRole="button" accessibilityLabel="Withdraw">
            <Text style={s.heroBtnText}>Withdraw</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={s.statsRow}>
        {stats.map(st => (
          <TouchableOpacity key={st.key} activeOpacity={0.85} onPress={() => onOpen(st.section)} style={[s.stat, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="button">
            <Text style={[s.statValue, { color: colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit>{st.value}</Text>
            <Text style={[s.statLabel, { color: colors.mutedForeground }]} numberOfLines={2}>{st.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {attention.length > 0 && (
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: '#F5B83D', borderLeftWidth: 3 }]}>
          <Text style={[s.cardTitle, { color: colors.foreground }]}>Needs your attention</Text>
          {attention.map(a => (
            <TouchableOpacity key={a.key} onPress={() => onOpen(a.section)} style={s.attnRow} accessibilityRole="button">
              <View style={[s.attnIcon, { backgroundColor: a.tint + '29' }]}><Icon name={a.icon} size={16} color={a.tint} /></View>
              <Text style={[s.attnText, { color: colors.foreground }]}>{a.text}</Text>
              <Icon name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={s.actions}>
        {actions.map(a => (
          <TouchableOpacity key={a.key} onPress={() => onOpen(a.section)} style={s.action} accessibilityRole="button" accessibilityLabel={a.label}>
            <View style={[s.actionIcon, { backgroundColor: a.tint + '26' }]}><Icon name={a.icon} size={24} color={a.tint} /></View>
            <Text style={[s.actionLabel, { color: colors.foreground }]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[s.cardTitle, { color: colors.foreground }]}>Recent activity</Text>
        {!data.loaded ? (
          [0, 1, 2].map(i => <View key={i} style={[s.skeleton, { backgroundColor: colors.muted }]} />)
        ) : data.recent.length === 0 ? (
          <Text style={[s.empty, { color: colors.mutedForeground }]}>Nothing yet. New orders, withdrawals and reviews will show up here.</Text>
        ) : (
          data.recent.map(r => (
            <TouchableOpacity key={r.key} onPress={() => onOpen(r.section)} style={s.actRow} accessibilityRole="button">
              <View style={[s.attnIcon, { backgroundColor: colors.muted }]}><Icon name={r.icon} size={16} color={colors.foreground} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[s.attnText, { color: colors.foreground }]} numberOfLines={1}>{r.title}</Text>
                <Text style={[s.actSub, { color: colors.mutedForeground }]} numberOfLines={1}>{r.sub}</Text>
              </View>
              <Text style={[s.actTime, { color: colors.mutedForeground }]}>{timeAgo(r.at)}</Text>
            </TouchableOpacity>
          ))
        )}
        {data.recent.length > 0 && (
          <TouchableOpacity onPress={() => onOpen('orders')} style={s.seeAll} accessibilityRole="button">
            <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>See all orders</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 16, gap: 16 },
  hero: { borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroHello: { color: '#fff', fontSize: 20, fontFamily: 'Inter_700Bold' },
  heroSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontFamily: 'Inter_400Regular' },
  heroAmount: { color: '#fff', fontSize: 28, fontFamily: 'Inter_700Bold', maxWidth: 150 },
  heroBtn: { backgroundColor: '#fff', borderRadius: 99, paddingHorizontal: 16, minHeight: 36, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  heroBtnText: { color: '#7B5CFA', fontSize: 13, fontFamily: 'Inter_700Bold' },
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 14, minHeight: 84, justifyContent: 'space-between' },
  statValue: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16 },
  cardTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 8 },
  attnRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  attnIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  attnText: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  action: { alignItems: 'center', width: '23%', gap: 6 },
  actionIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  actRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56 },
  actSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1, textTransform: 'capitalize' },
  actTime: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  seeAll: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  skeleton: { height: 40, borderRadius: 10, marginBottom: 8, opacity: 0.6 },
  empty: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
});
