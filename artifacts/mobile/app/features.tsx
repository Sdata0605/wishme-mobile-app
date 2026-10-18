import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/Icon';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { Reveal } from '@/components/neon/Motion';
import { NeonCard } from '@/components/neon/NeonCard';
import { NeonHeader } from '@/components/neon/NeonHeader';
import { useTheme } from '@/context/ThemeContext';
import { useVoiceAssistant } from '@/context/VoiceAssistantContext';
import { CAPABILITIES, categoriesFor } from '@/services/assistant/capabilities';

const BUILDING: [string, string][] = [
  ['Call notes', 'Recorded calls analysed, ask about any call and any fact'],
  ['Promises', 'The assistant remembers what you promised and nudges you'],
];

const PLANNED: [string, string][] = [
  ['Email inbox', 'Link your mailbox so the assistant can read your mail'],
  ['Real Instagram and Facebook profiles', 'Open a person\'s own profile, not just a search'],
  ['Clients & patients', 'Case files, notes and their documents'],
  ['Markets', 'Live stocks and analysis'],
  ['Style Studio', 'Try on outfits and hairstyles on your own photo'],
];

function Plain({ title, tint, icon, items }: { title: string; tint: string; icon: IconName; items: [string, string][] }) {
  const { neon } = useTheme();
  return (
    <View style={{ marginTop: 8, marginBottom: 14 }}>
      <View style={styles.head}>
        <Icon name={icon} size={16} color={tint} />
        <Text style={[styles.headText, { color: tint }]}>{title}</Text>
      </View>
      <View style={[styles.card, { backgroundColor: neon.surface, borderColor: neon.line }]}>
        {items.map(([name, desc], i) => (
          <View key={name} style={[styles.item, i > 0 && { borderTopWidth: 1, borderTopColor: neon.line }]}>
            <View style={[styles.dot, { backgroundColor: tint }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: neon.textHi }]}>{name}</Text>
              <Text style={[styles.desc, { color: neon.textLo }]}>{desc}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * WHAT I CAN DO: everything the assistant does and everything the WishMe app has, from the one list in
 * services/assistant/capabilities.ts. The assistant opens it when asked "what can you do?" (and says only a short summary,
 * so the answer is never cut off). Tap a line to open its screen, or "Try" to have the assistant do it.
 */
export default function FeaturesScreen() {
  const { neon } = useTheme();
  const insets = useSafeAreaInsets();
  const { ask } = useVoiceAssistant();
  const { category } = useLocalSearchParams<{ category?: string }>();
  const focus = category ? categoriesFor(String(category)) : [];
  const focusIds = new Set(focus.length && focus.length < CAPABILITIES.length ? focus.map((c) => c.id) : []);

  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries([...focusIds].map((id) => [id, true])));
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();

  const shown = useMemo(
    () =>
      CAPABILITIES.map((c) => ({
        ...c,
        items: query ? c.items.filter((i) => `${i.label} ${i.say} ${c.title}`.toLowerCase().includes(query)) : c.items,
      })).filter((c) => c.items.length > 0),
    [query],
  );

  const total = CAPABILITIES.reduce((n, c) => n + c.items.length, 0);

  return (
    <AmbientBackground>
      <NeonHeader title="What I can do" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={[styles.lead, { color: neon.textLo }]}>
          {total} things across {CAPABILITIES.length} areas. Tap one to open it, or tap Try and I will do it.
        </Text>
        <View style={[styles.search, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}>
          <Icon name="search" size={18} color={neon.textDim} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search what I can do"
            placeholderTextColor={neon.textDim}
            style={[styles.input, { color: neon.textHi }]}
            accessibilityLabel="Search what I can do"
          />
        </View>

        {shown.map((c, idx) => {
          const isOpen = !!query || !!open[c.id];
          return (
            <Reveal key={c.id} delayMs={Math.min(idx, 6) * 30} style={{ marginTop: 12 }}>
              <NeonCard style={{ padding: 0 }} radius={22}>
                <Pressable
                  onPress={() => setOpen((o) => ({ ...o, [c.id]: !o[c.id] }))}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  style={styles.cat}
                >
                  <View style={[styles.catIcon, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}>
                    <Icon name={c.icon} size={18} color={neon.cyan} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.catTitle, { color: neon.textHi }]}>{c.title}</Text>
                    <Text style={[styles.catCount, { color: neon.textDim }]}>{c.items.length} {c.items.length === 1 ? 'thing' : 'things'}</Text>
                  </View>
                  <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={neon.textDim} />
                </Pressable>
                {isOpen
                  ? c.items.map((it) => (
                      <View key={it.label} style={[styles.row, { borderTopColor: neon.line }]}>
                        <Pressable
                          style={{ flex: 1 }}
                          disabled={!it.route}
                          onPress={() => it.route && router.push(it.route as never)}
                          accessibilityRole={it.route ? 'link' : 'text'}
                        >
                          <Text style={[styles.name, { color: neon.textHi }]}>{it.label}</Text>
                          <Text style={[styles.desc, { color: neon.textLo }]}>“{it.say}”</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => ask(it.say)}
                          accessibilityRole="button"
                          accessibilityLabel={`Try: ${it.say}`}
                          style={[styles.try, { borderColor: neon.pink }]}
                        >
                          <Icon name="audio-lines" size={14} color={neon.pink} />
                          <Text style={[styles.tryText, { color: neon.pink }]}>Try</Text>
                        </Pressable>
                      </View>
                    ))
                  : null}
              </NeonCard>
            </Reveal>
          );
        })}
        {shown.length === 0 ? <Text style={[styles.empty, { color: neon.textLo }]}>Nothing matches “{q}”. Just ask me out loud: I can often do things that are not listed.</Text> : null}

        {query ? null : (
          <View style={{ marginTop: 18 }}>
            <Plain title="IN PROGRESS" tint={neon.warning} icon="clock" items={BUILDING} />
            <Plain title="COMING SOON" tint={neon.violet} icon="sparkles" items={PLANNED} />
          </View>
        )}
      </ScrollView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular', marginBottom: 14 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.3, borderRadius: 24, paddingHorizontal: 16, height: 48 },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', paddingVertical: 0 },
  cat: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  catIcon: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.2, alignItems: 'center', justifyContent: 'center' },
  catTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  catCount: { fontSize: 12.5, fontFamily: 'Inter_500Medium', marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
  try: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.2, borderRadius: 16, paddingHorizontal: 12, height: 32 },
  tryText: { fontSize: 12.5, fontFamily: 'Inter_700Bold' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  headText: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1.1 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 7 },
  name: { fontSize: 14.5, fontFamily: 'Inter_700Bold' },
  desc: { fontSize: 12.5, lineHeight: 17, fontFamily: 'Inter_400Regular', marginTop: 2 },
  empty: { fontSize: 14, textAlign: 'center', marginTop: 40, fontFamily: 'Inter_400Regular', lineHeight: 20 },
});
