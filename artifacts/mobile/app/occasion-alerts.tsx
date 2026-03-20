import { router } from 'expo-router';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';

const OCCASION_TYPES = ['Birthday', 'Anniversary', 'Wedding', 'Graduation', 'Festival'];
const REMINDERS = ['1 Day Before', '3 Days Before', '1 Week Before', '2 Weeks Before'];

export default function OccasionAlertsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [toggles, setToggles] = useState<Record<string, boolean>>({ Birthday: true, Anniversary: true });
  const [reminders, setReminders] = useState<Record<string, boolean>>({ '1 Day Before': true, '3 Days Before': true });
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Occasion Alerts</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20 }}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Occasion Types</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {OCCASION_TYPES.map((type, i) => (
            <View key={type} style={[styles.row, { borderBottomWidth: i < OCCASION_TYPES.length - 1 ? 1 : 0, borderBottomColor: colors.border }]}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>{type}</Text>
              <Switch
                value={!!toggles[type]}
                onValueChange={(v) => setToggles((p) => ({ ...p, [type]: v }))}
                trackColor={{ false: '#ccc', true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Advance Reminders</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {REMINDERS.map((r, i) => (
            <View key={r} style={[styles.row, { borderBottomWidth: i < REMINDERS.length - 1 ? 1 : 0, borderBottomColor: colors.border }]}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>{r}</Text>
              <Switch
                value={!!reminders[r]}
                onValueChange={(v) => setReminders((p) => ({ ...p, [r]: v }))}
                trackColor={{ false: '#ccc', true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', marginBottom: 12, marginTop: 8 },
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  rowLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
});
