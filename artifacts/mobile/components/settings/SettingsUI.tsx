import { router } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';

/** Top bar used by every Settings screen: back arrow and a centred title. */
export function SettingsHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 24 : insets.top;
  return (
    <View style={[s.header, { paddingTop: topPad + 10, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      <TouchableOpacity
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/(tabs)' as never)))}
        hitSlop={14}
        style={s.back}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Icon name="arrow-left" size={24} color={colors.foreground} />
      </TouchableOpacity>
      <Text style={[s.title, { color: colors.foreground }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={s.back} />
    </View>
  );
}

/** A titled group of rows, like "Your account" in Instagram's settings. */
export function SettingsGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: 22 }}>
      {title ? <Text style={[s.groupTitle, { color: colors.mutedForeground }]}>{title}</Text> : null}
      <View>{children}</View>
    </View>
  );
}

export interface RowProps {
  icon: IconName;
  label: string;
  subtitle?: string;
  onPress: () => void;
  danger?: boolean;
  /** Replaces the chevron (for example a value or a switch). */
  right?: React.ReactNode;
}

/** One tappable option: icon, title, optional second line, and a chevron. */
export function SettingsRow({ icon, label, subtitle, onPress, danger, right }: RowProps) {
  const { colors } = useTheme();
  const tint = danger ? '#EF4444' : colors.foreground;
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={onPress}
      style={s.row}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${label}, ${subtitle}` : label}
    >
      <View style={[s.iconWrap, { borderColor: danger ? '#EF444455' : colors.border }]}>
        <Icon name={icon} size={20} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowLabel, { color: tint }]}>{label}</Text>
        {subtitle ? (
          <Text style={[s.rowSub, { color: colors.mutedForeground }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (danger ? null : <Icon name="chevron-right" size={20} color={colors.mutedForeground} />)}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontFamily: 'Inter_700Bold' },
  groupTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 6, paddingHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 12, minHeight: 60 },
  iconWrap: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 16, fontFamily: 'Inter_500Medium' },
  rowSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
});
