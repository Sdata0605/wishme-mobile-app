import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { SettingsHeader } from '@/components/settings/SettingsUI';
import { useTheme } from '@/context/ThemeContext';

export default function AppearanceScreen() {
  const { colors, isDark, toggle } = useTheme();

  const option = (dark: boolean, icon: IconName, title: string, subtitle: string) => {
    const selected = isDark === dark;
    return (
      <TouchableOpacity
        key={title}
        activeOpacity={0.8}
        onPress={() => {
          if (!selected) toggle();
        }}
        style={[s.card, { backgroundColor: colors.card, borderColor: selected ? colors.primary : colors.border, borderWidth: selected ? 2 : 1 }]}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`${title}. ${subtitle}`}
      >
        <View style={[s.iconCircle, { backgroundColor: colors.primary + '1F' }]}>
          <Icon name={icon} size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.foreground }]}>{title}</Text>
          <Text style={[s.sub, { color: colors.mutedForeground }]}>{subtitle}</Text>
        </View>
        {selected ? (
          <View style={[s.check, { backgroundColor: colors.primary }]}>
            <Icon name="check" size={14} color="#fff" />
          </View>
        ) : (
          <View style={[s.radio, { borderColor: colors.border }]} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SettingsHeader title="Appearance" />
      <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
        <Text style={[s.intro, { color: colors.mutedForeground }]}>Choose how WishMe looks on your phone.</Text>
        {option(false, 'sun', 'Light', 'Bright and clean')}
        {option(true, 'moon', 'Dark', 'Easier on the eyes at night')}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  intro: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular', marginBottom: 18 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, marginBottom: 12 },
  iconCircle: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16.5, fontFamily: 'Inter_600SemiBold' },
  sub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  check: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
});
