import { router } from 'expo-router';
import React from 'react';
import { Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';

function SettingsRow({
  icon,
  label,
  right,
  onPress,
  destructive,
}: {
  icon: IconName;
  label: string;
  right?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.rowIcon, { backgroundColor: destructive ? '#EF444420' : colors.muted }]}>
        <Icon name={icon} size={18} color={destructive ? '#EF4444' : colors.primary} />
      </View>
      <Text style={[styles.rowLabel, { color: destructive ? '#EF4444' : colors.foreground }]}>{label}</Text>
      {right ?? <Icon name="chevron-right" size={18} color={colors.mutedForeground} />}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { colors, isDark, toggle } = useTheme();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Settings</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>APPEARANCE</Text>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingsRow
            icon="moon"
            label="Dark Mode"
            onPress={toggle}
            right={<Switch value={isDark} onValueChange={toggle} trackColor={{ false: '#ccc', true: colors.primary }} thumbColor="#fff" />}
          />
          <SettingsRow icon="globe" label="Language" right={<Text style={[styles.valueText, { color: colors.mutedForeground }]}>English</Text>} />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>NOTIFICATIONS</Text>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingsRow icon="bell" label="Push Notifications" right={<Switch value={true} trackColor={{ false: '#ccc', true: colors.primary }} thumbColor="#fff" />} />
          <SettingsRow icon="mail" label="Email Notifications" right={<Switch value={false} trackColor={{ false: '#ccc', true: colors.primary }} thumbColor="#fff" />} />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ACCOUNT</Text>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingsRow icon="lock" label="Change Password" onPress={() => {}} />
          <SettingsRow icon="shield" label="Privacy Policy" onPress={() => {}} />
          <SettingsRow icon="info" label="Terms of Service" onPress={() => {}} />
          <SettingsRow icon="help-circle" label="Help & Support" onPress={() => {}} />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DANGER ZONE</Text>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingsRow icon="trash-2" label="Delete Account" onPress={() => {}} destructive />
        </View>

        <Text style={[styles.version, { color: colors.mutedForeground }]}>WishMe v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  sectionLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  section: { marginHorizontal: 20, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },
  valueText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  version: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 24 },
});
