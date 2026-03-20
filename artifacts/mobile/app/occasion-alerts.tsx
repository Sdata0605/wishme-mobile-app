import { router } from 'expo-router';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { MOCK_OCCASION_ALERTS } from '@/constants/mockData';
import { useTheme } from '@/context/ThemeContext';

const TYPE_COLORS: Record<string, string> = {
  Birthday: '#FF6B33',
  Anniversary: '#E8527A',
  Wedding: '#B44CFF',
  Graduation: '#4B83FF',
  Custom: '#22C55E',
};

interface AlertState {
  alertEnabled: boolean;
  autoSend: boolean;
}

export default function OccasionAlertsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [alertStates, setAlertStates] = useState<Record<string, AlertState>>(() =>
    Object.fromEntries(MOCK_OCCASION_ALERTS.map((a) => [a.id, { alertEnabled: a.alertEnabled, autoSend: a.autoSend }]))
  );

  const toggleAlert = (id: string, field: keyof AlertState) => {
    setAlertStates((prev) => ({ ...prev, [id]: { ...prev[id], [field]: !prev[id][field] } }));
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Occasion Alerts</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        {MOCK_OCCASION_ALERTS.map((alert) => {
          const tc = TYPE_COLORS[alert.type] ?? '#6B7280';
          const st = alertStates[alert.id];
          return (
            <View key={alert.id} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Header row */}
              <View style={s.cardTop}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[s.alertName, { color: colors.foreground }]}>{alert.name}</Text>
                  <View style={[s.typeBadge, { backgroundColor: tc + '20' }]}>
                    <Text style={[s.typeBadgeText, { color: tc }]}>{alert.type}</Text>
                  </View>
                </View>
                <View style={[s.statusDot, { backgroundColor: alert.upcoming ? '#22C55E' : '#9CA3AF' }]} />
              </View>

              {/* Date + Loved one */}
              <View style={s.metaRow}>
                <View style={s.metaItem}>
                  <Icon name="calendar" size={13} color={colors.mutedForeground} />
                  <Text style={[s.metaText, { color: colors.mutedForeground }]}>{alert.date}</Text>
                </View>
                <View style={s.metaItem}>
                  <Icon name="user" size={13} color={colors.mutedForeground} />
                  <Text style={[s.metaText, { color: colors.mutedForeground }]}>{alert.lovedOne}</Text>
                </View>
              </View>

              {/* Days before label */}
              <View style={[s.daysLabel, { backgroundColor: colors.muted }]}>
                <Icon name="bell" size={13} color={colors.mutedForeground} />
                <Text style={[s.daysLabelText, { color: colors.mutedForeground }]}>{alert.daysBefore} {alert.daysBefore === 1 ? 'day' : 'days'} before</Text>
              </View>

              {/* Switches */}
              <View style={[s.divider, { borderColor: colors.border }]} />
              <View style={s.switchRow}>
                <Text style={[s.switchLabel, { color: colors.foreground }]}>Alert Enabled</Text>
                <Switch
                  value={st.alertEnabled}
                  onValueChange={() => toggleAlert(alert.id, 'alertEnabled')}
                  trackColor={{ false: '#ccc', true: tc }}
                  thumbColor="#fff"
                />
              </View>
              <View style={s.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.switchLabel, { color: colors.foreground }]}>Auto-send Enabled</Text>
                  <Text style={[s.switchSub, { color: colors.mutedForeground }]}>Automatically book & send a celebrity wish</Text>
                </View>
                <Switch
                  value={st.autoSend}
                  onValueChange={() => toggleAlert(alert.id, 'autoSend')}
                  trackColor={{ false: '#ccc', true: '#B44CFF' }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  alertName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  typeBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  typeBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  metaRow: { flexDirection: 'row', gap: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  daysLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  daysLabelText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  divider: { borderTopWidth: 1, marginVertical: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  switchLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  switchSub: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
});
