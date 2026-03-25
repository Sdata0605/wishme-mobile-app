import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

interface OccasionAlert {
  id: string;
  user_id: string;
  occasion_name: string;
  occasion_type: string;
  occasion_date: string;
  alert_enabled: boolean;
  auto_send_enabled: boolean;
  alert_days_before: number;
  loved_one_id: string | null;
  celebrity_id: string | null;
  loved_ones: { first_name: string; last_name: string } | null;
  celebrities: { name: string } | null;
}

function daysUntil(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date + 'T00:00:00');
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function fmtDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function personName(alert: OccasionAlert): string {
  if (alert.loved_ones) return alert.loved_ones.first_name + ' ' + alert.loved_ones.last_name;
  if (alert.celebrities) return alert.celebrities.name;
  return 'Unknown';
}

function personIcon(alert: OccasionAlert): IconName {
  return alert.celebrity_id ? 'star' : 'heart';
}

function personIconColor(alert: OccasionAlert): string {
  return alert.celebrity_id ? '#FF6B33' : '#E8527A';
}

function alertStatus(
  occasionDate: string,
  alertDaysBefore: number,
  colors: { primary: string; border: string; mutedForeground: string },
): { label: string; bgColor: string; textColor: string } {
  const days = daysUntil(occasionDate);
  if (days < 0) return { label: 'Past', bgColor: '#9CA3AF20', textColor: '#9CA3AF' };
  if (days === 0) return { label: 'Today!', bgColor: '#EF444420', textColor: '#EF4444' };
  if (days <= alertDaysBefore) return { label: days + ' days', bgColor: '#EF444420', textColor: '#EF4444' };
  if (days <= 30) return { label: days + ' days', bgColor: colors.primary + '20', textColor: colors.primary };
  return { label: fmtDate(occasionDate), bgColor: colors.border, textColor: colors.mutedForeground };
}

function showToast(msg: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(msg, ToastAndroid.SHORT);
  }
}

export default function OccasionAlertsScreen() {
  const { colors } = useTheme();
  const { user, session } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [alerts, setAlerts] = useState<OccasionAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAlerts = useCallback(
    async (isRefresh = false) => {
      if (!user || !session) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await supabaseFetch(
          `/rest/v1/occasion_alerts?select=*,loved_ones(first_name,last_name),celebrities!occasion_alerts_celebrity_id_fkey(name)&user_id=eq.${user.profileId}&order=occasion_date.asc`,
          { method: 'GET' },
          session.access_token,
        );
        if (!res.ok) throw new Error('Failed to load');
        const data: OccasionAlert[] = await res.json();
        setAlerts(data);
      } catch {
      } finally {
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
    },
    [user, session],
  );

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const toggleAlertEnabled = useCallback(
    async (id: string, currentValue: boolean) => {
      if (!session) return;
      const newValue = !currentValue;
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, alert_enabled: newValue } : a)));
      try {
        const res = await supabaseFetch(
          `/rest/v1/occasion_alerts?id=eq.${id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({ alert_enabled: newValue }),
          },
          session.access_token,
        );
        if (!res.ok) {
          setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, alert_enabled: currentValue } : a)));
          showToast('Failed to update alert');
        } else {
          showToast(newValue ? 'Alert enabled' : 'Alert disabled');
        }
      } catch {
        setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, alert_enabled: currentValue } : a)));
        showToast('Failed to update alert');
      }
    },
    [session],
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingAlerts = alerts.filter((a) => new Date(a.occasion_date + 'T00:00:00') >= today);
  const pastAlerts = alerts.filter((a) => new Date(a.occasion_date + 'T00:00:00') < today);

  const upcomingCount = upcomingAlerts.length;
  const thisWeekCount = upcomingAlerts.filter((a) => daysUntil(a.occasion_date) <= 7).length;
  const autoSendCount = alerts.filter((a) => a.auto_send_enabled).length;

  const renderHeader = () => (
    <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
      <TouchableOpacity onPress={() => router.back()}>
        <Icon name="arrow-left" size={22} color={colors.foreground} />
      </TouchableOpacity>
      <Text style={[s.headerTitle, { color: colors.foreground }]}>Occasion Alerts</Text>
      <View style={{ width: 22 }} />
    </View>
  );

  if (!user || !session) {
    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        {renderHeader()}
        <View style={s.centered}>
          <Icon name="bell" size={48} color={colors.mutedForeground} />
          <Text style={[s.emptyTitle, { color: colors.foreground }]}>Sign in to view your alerts</Text>
          <TouchableOpacity style={[s.ctaBtn, { backgroundColor: colors.primary }]} onPress={() => router.push('/(auth)' as never)}>
            <Text style={s.ctaBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        {renderHeader()}
        <View style={s.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {renderHeader()}

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAlerts(true)} tintColor={colors.primary} />}
      >
        {/* Stats Bar */}
        <View style={s.statsRow}>
          <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Icon name="calendar" size={20} color="#FF6B33" />
            <Text style={[s.statNum, { color: colors.foreground }]}>{upcomingCount}</Text>
            <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Upcoming</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Icon name="zap" size={20} color="#B44CFF" />
            <Text style={[s.statNum, { color: colors.foreground }]}>{thisWeekCount}</Text>
            <Text style={[s.statLabel, { color: colors.mutedForeground }]}>This Week</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Icon name="zap" size={20} color="#22C55E" />
            <Text style={[s.statNum, { color: colors.foreground }]}>{autoSendCount}</Text>
            <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Auto-Send</Text>
          </View>
        </View>

        {/* Empty state */}
        {alerts.length === 0 && (
          <View style={s.centered}>
            <Icon name="bell" size={48} color={colors.mutedForeground} />
            <Text style={[s.emptyTitle, { color: colors.foreground }]}>No occasion alerts set up yet</Text>
            <TouchableOpacity
              style={[s.ctaBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/loved-ones' as never)}
            >
              <Text style={s.ctaBtnText}>Add Loved Ones</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Upcoming Occasions */}
        {upcomingAlerts.length > 0 && (
          <>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Upcoming Occasions</Text>
            {upcomingAlerts.map((alert) => {
              const icon = personIcon(alert);
              const iconColor = personIconColor(alert);
              const status = alertStatus(alert.occasion_date, alert.alert_days_before, colors);
              return (
                <View key={alert.id} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {/* Top row */}
                  <View style={s.cardTop}>
                    <View style={[s.personIconCircle, { backgroundColor: iconColor + '20' }]}>
                      <Icon name={icon} size={16} color={iconColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.personName, { color: colors.foreground }]}>{personName(alert)}</Text>
                      <Text style={[s.occasionName, { color: colors.mutedForeground }]}>{alert.occasion_name}</Text>
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: status.bgColor }]}>
                      <Text style={[s.statusBadgeText, { color: status.textColor }]}>{status.label}</Text>
                    </View>
                  </View>

                  {/* Middle row */}
                  <View style={s.metaRow}>
                    <View style={s.metaItem}>
                      <Icon name="calendar" size={13} color={colors.mutedForeground} />
                      <Text style={[s.metaText, { color: colors.mutedForeground }]}>{fmtDate(alert.occasion_date)}</Text>
                    </View>
                    <View style={s.metaItem}>
                      <Icon name="bell" size={13} color={colors.mutedForeground} />
                      <Text style={[s.metaText, { color: colors.mutedForeground }]}>
                        Alert {alert.alert_days_before} {alert.alert_days_before === 1 ? 'day' : 'days'} before
                      </Text>
                    </View>
                  </View>

                  {/* Auto-send pill */}
                  {alert.auto_send_enabled && (
                    <View style={[s.autoSendPill, { backgroundColor: '#B44CFF20' }]}>
                      <Icon name="zap" size={11} color="#B44CFF" />
                      <Text style={[s.autoSendText, { color: '#B44CFF' }]}>Auto-send On</Text>
                    </View>
                  )}

                  {/* Alert toggle */}
                  <View style={[s.divider, { borderColor: colors.border }]} />
                  <View style={s.switchRow}>
                    <Text style={[s.switchLabel, { color: colors.foreground }]}>Alert Enabled</Text>
                    <Switch
                      value={alert.alert_enabled}
                      onValueChange={() => toggleAlertEnabled(alert.id, alert.alert_enabled)}
                      trackColor={{ false: '#ccc', true: '#22C55E' }}
                      thumbColor="#fff"
                    />
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* Past Occasions */}
        {pastAlerts.length > 0 && (
          <>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Past Occasions</Text>
            <View style={s.pastGrid}>
              {pastAlerts.map((alert) => (
                <View key={alert.id} style={[s.pastCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: 0.65 }]}>
                  <Text style={[s.pastPersonName, { color: colors.foreground }]} numberOfLines={1}>
                    {personName(alert)}
                  </Text>
                  <Text style={[s.pastOccasionName, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {alert.occasion_name}
                  </Text>
                  <Text style={[s.pastDate, { color: colors.mutedForeground }]}>{fmtDate(alert.occasion_date)}</Text>
                  <View style={[s.pastBadge, { backgroundColor: '#9CA3AF20' }]}>
                    <Text style={[s.pastBadgeText, { color: '#9CA3AF' }]}>Past</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  ctaBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  ctaBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  statNum: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  personIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  occasionName: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  statusBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  autoSendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  autoSendText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  divider: { borderTopWidth: 1, marginVertical: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  switchLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  pastGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pastCard: {
    width: '47%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  pastPersonName: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  pastOccasionName: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  pastDate: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  pastBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999, marginTop: 2 },
  pastBadgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
});
