import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/Icon';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { Reveal } from '@/components/neon/Motion';
import { NeonHeader } from '@/components/neon/NeonHeader';
import { useTheme } from '@/context/ThemeContext';

const LIVE: [string, string][] = [
  ['Voice assistant', 'Talk to the assistant live, in your language'],
  ['Daily brief', 'Today’s agenda, the month at a glance and a line for the day'],
  ['Calendar & reminders', 'Events, nudges and notes with no date, all in the Hub'],
  ['Assistant phone calls', 'The assistant calls people for you and reports back'],
  ['Documents you can send', 'Ask for a PDF, Word file or Excel sheet and it writes the real file'],
  ['Phone control', 'Open apps, call contacts and read out numbers, by voice'],
  ['Finance', 'EMIs, incomes and expenses, with a payoff plan from the assistant'],
  ['Celebrity wishes & calls', 'Book personalised video wishes and calls from your favourite stars'],
  ['Wish a Friend', 'Cards, UGC videos and video wishes for the people you love'],
  ['Occasion alerts', 'Never miss a birthday or anniversary, with a wish ready to send'],
  ['Travel, bills & recharge', 'Flights, hotels, buses, bill payments and recharges in one place'],
];

const BUILDING: [string, string][] = [
  ['Call notes', 'Recorded calls analysed, ask about any call and any fact'],
  ['Promises', 'The assistant remembers what you promised and nudges you'],
];

const PLANNED: [string, string][] = [
  ['Email', 'Link your mailbox, then ask the assistant to read or send mail'],
  ['Clients & patients', 'Case files, notes and their documents'],
  ['Markets', 'Live stocks and analysis'],
  ['Style Studio', 'Try on outfits and hairstyles on your own photo'],
  ['Video avatar messages', 'Your assistant delivers messages as a talking avatar'],
];

function Section({ title, tint, icon, items, delay }: { title: string; tint: string; icon: IconName; items: [string, string][]; delay: number }) {
  const { neon } = useTheme();
  return (
    <Reveal delayMs={delay} style={{ marginBottom: 22 }}>
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
    </Reveal>
  );
}

/** FEATURES: what is live, what is being built, what is next. Mirrors MyAssistant's Features screen. */
export default function FeaturesScreen() {
  const { neon } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <AmbientBackground>
      <NeonHeader title="Features" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
        <Section title="LIVE NOW" tint={neon.lime} icon="check-circle" items={LIVE} delay={0} />
        <Section title="IN PROGRESS" tint={neon.warning} icon="clock" items={BUILDING} delay={120} />
        <Section title="COMING SOON" tint={neon.violet} icon="sparkles" items={PLANNED} delay={220} />
      </ScrollView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  headText: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1.1 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 7 },
  name: { fontSize: 14.5, fontFamily: 'Inter_700Bold' },
  desc: { fontSize: 12.5, lineHeight: 17, fontFamily: 'Inter_400Regular', marginTop: 2 },
});
