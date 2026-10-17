/**
 * "Ask WishMe": the visible way into the voice assistant on Home. Talk opens it listening; each suggestion opens it
 * and asks that question straight away, so people see what it can do for them.
 */
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { BRAND, withAlpha } from '@/constants/neon';
import { useTheme } from '@/context/ThemeContext';
import { useVoiceAssistant } from '@/context/VoiceAssistantContext';

const SUGGESTIONS = [
  { label: 'A singer for a birthday wish', prompt: 'Find me a singer who can send a birthday video wish.' },
  { label: 'Cricketer shout-out', prompt: 'Which cricketers can send a personal shout-out?' },
  { label: 'My bookings', prompt: 'Show me my bookings.' },
  { label: 'Upcoming occasions', prompt: 'What occasions are coming up that I could send a wish for?' },
];

export function AskWishMeCard() {
  const { colors, isDark } = useTheme();
  const { open, toggle, ask } = useVoiceAssistant();

  return (
    <View style={[styles.card, { borderColor: colors.border }]}>
      <LinearGradient
        colors={[withAlpha(BRAND.orange, isDark ? 0.22 : 0.1), withAlpha(BRAND.purple, isDark ? 0.22 : 0.1)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Icon name="heart" size={16} color={BRAND.pink} />
            <Text style={[styles.title, { color: colors.foreground }]}>Ask WishMe</Text>
          </View>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            Just say what you need. I’ll find the star and help you book it.
          </Text>
        </View>
        <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel={open ? 'Stop talking to WishMe' : 'Talk to WishMe'}>
          <LinearGradient colors={[BRAND.pink, BRAND.purple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.talk}>
            <Icon name={open ? 'x' : 'mic'} size={16} color="#fff" />
            <Text style={styles.talkText}>{open ? 'Stop' : 'Talk'}</Text>
          </LinearGradient>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {SUGGESTIONS.map((s) => (
          <Pressable
            key={s.label}
            onPress={() => ask(s.prompt)}
            accessibilityRole="button"
            accessibilityLabel={`Ask WishMe: ${s.label}`}
            style={[styles.chip, { backgroundColor: withAlpha(BRAND.gold, isDark ? 0.12 : 0.18), borderColor: colors.border }]}
          >
            <Text style={[styles.chipText, { color: isDark ? '#FFD27A' : '#9A5B00' }]}>“{s.label}”</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginTop: 20, borderRadius: 18, borderWidth: 1, padding: 16, overflow: 'hidden' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 18, fontFamily: 'PlayfairDisplay_700Bold' },
  sub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 4, lineHeight: 18 },
  talk: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
  talkText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  chips: { gap: 8, paddingTop: 12 },
  chip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 12.5, fontFamily: 'Inter_500Medium' },
});
