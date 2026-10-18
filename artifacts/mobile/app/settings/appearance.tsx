import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { SettingsHeader } from '@/components/settings/SettingsUI';
import { ACCENT_CHOICES, DEFAULT_ACCENT, THEMES, type ThemeId } from '@/constants/neon';
import { useTheme } from '@/context/ThemeContext';

export default function AppearanceScreen() {
  const { colors, theme, setTheme, accent, setAccent, neon } = useTheme();

  const option = (id: ThemeId, title: string, subtitle: string, swatches: readonly string[]) => {
    const selected = theme === id;
    const [page, ...inks] = swatches;
    return (
      <TouchableOpacity
        key={id}
        activeOpacity={0.8}
        onPress={() => {
          if (!selected) setTheme(id);
        }}
        style={[s.card, { backgroundColor: colors.card, borderColor: selected ? colors.primary : colors.border, borderWidth: selected ? 2 : 1 }]}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`${title}. ${subtitle}`}
      >
        {/* a little preview of the theme: its page colour with its accent colours as dots on it */}
        <View style={[s.preview, { backgroundColor: page, borderColor: colors.border }]}>
          {inks.map((c) => (
            <View key={c} style={[s.previewDot, { backgroundColor: c }]} />
          ))}
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
        {THEMES.map((t) => option(t.id, t.name, t.blurb, t.swatches))}

        <Text style={[s.section, { color: colors.foreground }]}>Accent colour</Text>
        <Text style={[s.intro, { color: colors.mutedForeground, marginBottom: 14 }]}>
          Every screen, the mic and the buttons follow this colour in every theme.
        </Text>
        <View style={s.swatches}>
          {ACCENT_CHOICES.map((c) => {
            const on = c.color.toLowerCase() === accent.toLowerCase();
            return (
              <TouchableOpacity
                key={c.color}
                activeOpacity={0.8}
                onPress={() => setAccent(c.color)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={c.name}
                style={s.swatchCell}
              >
                <View style={[s.swatch, { backgroundColor: c.color, borderColor: on ? colors.foreground : 'transparent' }]}>
                  {on ? <Icon name="check" size={18} color="#fff" /> : null}
                </View>
                <Text style={[s.swatchName, { color: on ? colors.foreground : colors.mutedForeground }]} numberOfLines={1}>{c.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {accent.toLowerCase() !== DEFAULT_ACCENT.toLowerCase() ? (
          <TouchableOpacity onPress={() => setAccent(DEFAULT_ACCENT)} style={{ alignSelf: 'flex-start', marginTop: 8, paddingVertical: 8 }}>
            <Text style={{ color: neon.cyan, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>Reset to Violet</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  intro: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular', marginBottom: 18 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, marginBottom: 12 },
  preview: {
    width: 54,
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 8,
  },
  previewDot: { width: 13, height: 13, borderRadius: 6.5 },
  title: { fontSize: 16.5, fontFamily: 'Inter_600SemiBold' },
  sub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  check: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  section: { fontSize: 16.5, fontFamily: 'PlayfairDisplay_700Bold', marginTop: 16, marginBottom: 4 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  swatchCell: { width: '25%', alignItems: 'center', gap: 6 },
  swatch: { width: 48, height: 48, borderRadius: 24, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  swatchName: { fontSize: 11.5, fontFamily: 'Inter_500Medium' },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
});
