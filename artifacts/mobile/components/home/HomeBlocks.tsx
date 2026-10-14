import { LinearGradient as ExpoGradient } from 'expo-linear-gradient';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, RadialGradient, Stop } from 'react-native-svg';
import { Icon, type IconName } from '@/components/Icon';
import { PressScale } from '@/components/neon/Motion';
import { NeonCard } from '@/components/neon/NeonCard';
import { withAlpha } from '@/constants/neon';
import { useTheme } from '@/context/ThemeContext';
import { ago, type Story } from '@/services/home/news';
import type { Weather } from '@/services/home/weather';

// ─── Play my day ─────────────────────────────────────────────────────────────

/** A pill with a gradient play disc, and a one-line hint beside it. */
export function PlayMyDay({ onPress }: { onPress: () => void }) {
  const { neon } = useTheme();
  return (
    <View style={styles.playRow}>
      <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel="Play my day">
        <View style={[styles.playPill, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}>
          <ExpoGradient colors={[neon.blue, neon.violet]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.playDisc}>
            <Icon name="play" size={18} color="#fff" />
          </ExpoGradient>
          <Text style={[styles.playText, { color: neon.textHi }]} maxFontSizeMultiplier={1.2}>Play my day</Text>
        </View>
      </PressScale>
      <Text style={[styles.playHint, { color: neon.textDim }]}>Hear your day in about a minute</Text>
    </View>
  );
}

// ─── How to address the user ─────────────────────────────────────────────────

/** Asked once, of people who signed up before the assistant knew: it decides "sir" or "ma'am". */
export function GenderCard({ onPick }: { onPick: (g: 'male' | 'female' | 'other') => void }) {
  const { neon } = useTheme();
  const opt = (g: 'male' | 'female' | 'other', label: string) => (
    <PressScale key={g} onPress={() => onPick(g)} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[styles.genderBtn, { backgroundColor: withAlpha(neon.cyan, 0.1), borderColor: withAlpha(neon.cyan, 0.45) }]}>
        <Text style={[styles.genderText, { color: neon.textHi }]}>{label}</Text>
      </View>
    </PressScale>
  );
  return (
    <NeonCard style={{ padding: 18 }} radius={28}>
      <Text style={[styles.gsLabel, { color: neon.textLo }]}>One quick thing</Text>
      <Text style={[styles.gsTitle, { color: neon.textHi, marginTop: 8, fontSize: 22 }]}>How should I address you?</Text>
      <View style={[styles.gsButtons, { gap: 10 }]}>
        {opt('male', 'Sir')}
        {opt('female', "Ma'am")}
        {opt('other', 'No title')}
      </View>
    </NeonCard>
  );
}

// ─── Get started ─────────────────────────────────────────────────────────────

export function GetStartedCard({ idea, onTalk, onDismiss }: { idea: string; onTalk: () => void; onDismiss: () => void }) {
  const { neon } = useTheme();
  return (
    <NeonCard style={{ padding: 18, borderColor: withAlpha(neon.blue, 0.55) }} radius={28}>
      <View style={styles.gsHead}>
        <View style={[styles.gsTile, { backgroundColor: withAlpha(neon.blue, 0.18), borderColor: withAlpha(neon.blue, 0.5) }]}>
          <Icon name="audio-lines" size={20} color={neon.cyan} />
        </View>
        <Text style={[styles.gsLabel, { color: neon.textLo }]}>Get started</Text>
        <View style={{ flex: 1 }} />
        <PressScale onPress={onTalk}>
          <View style={[styles.gsPill, { backgroundColor: withAlpha(neon.textHi, 0.07), borderColor: neon.cardBorder }]}>
            <Text style={[styles.gsPillText, { color: neon.textHi }]}>Start here</Text>
          </View>
        </PressScale>
      </View>
      <Text style={[styles.gsTitle, { color: neon.textHi }]} maxFontSizeMultiplier={1.2}>Ask me anything</Text>
      <Text style={[styles.gsTry, { color: neon.textLo }]}>Try: “{idea}”</Text>
      <View style={styles.gsButtons}>
        <PressScale onPress={onTalk} accessibilityRole="button" accessibilityLabel="Talk to the assistant">
          <ExpoGradient colors={neon.gBrand as unknown as [string, string]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.talk}>
            <Icon name="mic" size={18} color="#fff" />
            <Text style={styles.talkText}>Talk to me</Text>
          </ExpoGradient>
        </PressScale>
        <PressScale onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Not now">
          <Text style={[styles.notNow, { color: neon.textHi }]}>Not now</Text>
        </PressScale>
      </View>
    </NeonCard>
  );
}

// ─── Weather ─────────────────────────────────────────────────────────────────

function WeatherArt({ kind, isDay }: { kind: Weather['kind']; isDay: boolean }) {
  const { neon } = useTheme();
  if (kind === 'clear' && isDay) {
    return (
      <Svg width={92} height={92} viewBox="0 0 92 92">
        <Defs>
          <RadialGradient id="sun" cx="45%" cy="35%" r="70%">
            <Stop offset="0" stopColor="#FFD24A" />
            <Stop offset="0.6" stopColor="#FF9A1F" />
            <Stop offset="1" stopColor="#FF6B00" />
          </RadialGradient>
        </Defs>
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          const r1 = 33, r2 = i % 2 ? 38 : 42;
          return (
            <Line key={i} x1={46 + Math.cos(a) * r1} y1={46 + Math.sin(a) * r1} x2={46 + Math.cos(a) * r2} y2={46 + Math.sin(a) * r2} stroke="#FFC93C" strokeWidth={3.2} strokeLinecap="round" />
          );
        })}
        <Circle cx={46} cy={46} r={26} fill="url(#sun)" />
      </Svg>
    );
  }
  const icon: IconName = !isDay && kind === 'clear' ? 'moon'
    : kind === 'rain' ? 'cloud-rain' : kind === 'snow' ? 'cloud-snow' : kind === 'storm' ? 'cloud-lightning' : 'cloud';
  return (
    <View style={{ width: 92, height: 92, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={64} color={kind === 'clear' ? '#FFE9A8' : neon.cyan} />
    </View>
  );
}

function Stat({ icon, value, label, tint }: { icon: IconName; value: string; label: string; tint: string }) {
  const { neon } = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: '#fff' }]}>{value}</Text>
      <View style={styles.statLabelRow}>
        <Icon name={icon} size={13} color={tint} />
        <Text style={[styles.statLabel, { color: neon.textLo }]}>{label}</Text>
      </View>
    </View>
  );
}

export function WeatherCard({ w }: { w: Weather }) {
  const { neon } = useTheme();
  const colors = neon.isDark ? (['#5E6A8E', '#2A4D95', '#112A6C'] as const) : (['#8EC5FF', '#5B9BFF', '#3B6FE0'] as const);
  return (
    <ExpoGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.weather, { borderColor: withAlpha('#fff', 0.14) }]}>
      <View style={styles.wTop}>
        <WeatherArt kind={w.kind} isDay={w.isDay} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.wLabel} maxFontSizeMultiplier={1.2}>{w.label}</Text>
          {w.city ? <Text style={styles.wCity}>{w.city}</Text> : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.wTemp} maxFontSizeMultiplier={1.1}>{w.tempC}°</Text>
          <Text style={styles.wHiLo}>H {w.highC}°  L {w.lowC}°</Text>
        </View>
      </View>
      <View style={styles.wStrip}>
        <Stat icon="thermometer" tint="#FF7A59" value={`${w.feelsC}°`} label="Feels" />
        <View style={styles.statSep} />
        <Stat icon="droplet" tint="#2FD3FF" value={`${w.humidity}%`} label="Humidity" />
        <View style={styles.statSep} />
        <Stat icon="wind" tint="#B8C7FF" value={`${w.windKmh} km/h`} label="Wind" />
        <View style={styles.statSep} />
        <Stat icon="sun" tint="#FFC93C" value={`${w.uv}`} label="UV" />
      </View>
    </ExpoGradient>
  );
}

// ─── News ────────────────────────────────────────────────────────────────────

export function NewsCard({ stories, onMore, onDismiss, onOpen }: { stories: Story[]; onMore: () => void; onDismiss: () => void; onOpen: (s: Story) => void }) {
  const { neon } = useTheme();
  return (
    <NeonCard style={{ padding: 18, borderColor: withAlpha(neon.cardBorder, 0.8) }} radius={28}>
      <View style={styles.newsHead}>
        <Icon name="newspaper" size={18} color={neon.textLo} />
        <Text style={[styles.newsLabel, { color: neon.textLo }]}>In the news</Text>
        <View style={{ flex: 1 }} />
        <PressScale onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Hide news">
          <Icon name="x" size={20} color={neon.textLo} />
        </PressScale>
      </View>
      {stories.slice(0, 2).map((s) => (
        <PressScale key={s.url || s.title} onPress={() => onOpen(s)} accessibilityRole="link" accessibilityLabel={s.title}>
          <View style={{ marginTop: 14 }}>
            <Text style={[styles.headline, { color: neon.textHi }]} numberOfLines={2}>{s.title}</Text>
            <Text style={[styles.source, { color: neon.textDim }]}>{s.source} · {ago(s.at)}</Text>
          </View>
        </PressScale>
      ))}
      <PressScale onPress={onMore} accessibilityRole="button" style={{ alignSelf: 'flex-end', marginTop: 22 }}>
        <Text style={[styles.more, { color: neon.isDark ? '#2F8BFF' : neon.violet }]}>More news</Text>
      </PressScale>
    </NeonCard>
  );
}

// ─── Chips ───────────────────────────────────────────────────────────────────

/** Outlined pills with a waveform: ideas to say out loud. Scrolls sideways. */
export function PromptChips({ ideas, onAsk }: { ideas: { label: string; prompt: string }[]; onAsk: (prompt: string) => void }) {
  const { neon } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }} style={{ flexGrow: 0 }}>
      {ideas.map((i) => (
        <PressScale key={i.label} onPress={() => onAsk(i.prompt)} accessibilityRole="button">
          <View style={[styles.promptChip, { backgroundColor: withAlpha(neon.cyan, 0.08), borderColor: withAlpha(neon.cyan, 0.4) }]}>
            <Icon name="audio-lines" size={17} color={neon.textHi} />
            <Text style={[styles.promptText, { color: neon.textHi }]} maxFontSizeMultiplier={1.2}>{i.label}</Text>
          </View>
        </PressScale>
      ))}
    </ScrollView>
  );
}

export interface ToolChip { label: string; icon: IconName; route: string }

/** "Open a tool": icon chips that wrap onto as many rows as they need. */
export function ToolChips({ tools, onOpen }: { tools: ToolChip[]; onOpen: (route: string) => void }) {
  const { neon } = useTheme();
  const tints = [neon.blue, neon.pink, neon.pink, neon.blue, neon.cyan, neon.violet];
  return (
    <View style={styles.tools}>
      {tools.map((t, i) => (
        <PressScale key={t.label} onPress={() => onOpen(t.route)} accessibilityRole="button">
          <View style={[styles.toolChip, { backgroundColor: neon.glass, borderColor: withAlpha(tints[i % tints.length], 0.6) }]}>
            <Icon name={t.icon} size={18} color={neon.textHi} />
            <Text style={[styles.toolText, { color: neon.textHi }]} maxFontSizeMultiplier={1.2}>{t.label}</Text>
          </View>
        </PressScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  playRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  playPill: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 6, paddingRight: 20, height: 52, borderRadius: 26, borderWidth: 1.2 },
  playDisc: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  playText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  playHint: { flex: 1, fontSize: 14, lineHeight: 19, fontFamily: 'Inter_400Regular' },

  genderBtn: { height: 46, paddingHorizontal: 22, borderRadius: 23, borderWidth: 1.3, alignItems: 'center', justifyContent: 'center' },
  genderText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  gsHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gsTile: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  gsLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  gsPill: { paddingHorizontal: 16, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  gsPillText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  gsTitle: { fontSize: 26, fontFamily: 'PlayfairDisplay_700Bold', letterSpacing: -0.3, marginTop: 20 },
  gsTry: { fontSize: 15, fontFamily: 'Inter_400Regular', marginTop: 6 },
  gsButtons: { flexDirection: 'row', alignItems: 'center', gap: 22, marginTop: 18 },
  talk: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 22, height: 48, borderRadius: 14 },
  talkText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  notNow: { fontSize: 16, fontFamily: 'Inter_500Medium' },

  weather: { borderRadius: 28, borderWidth: 1, padding: 18 },
  wTop: { flexDirection: 'row', alignItems: 'center' },
  wLabel: { color: '#fff', fontSize: 26, fontFamily: 'PlayfairDisplay_700Bold' },
  wCity: { color: 'rgba(255,255,255,0.62)', fontSize: 15, fontFamily: 'Inter_400Regular', marginTop: 2 },
  wTemp: { color: '#fff', fontSize: 56, lineHeight: 62, fontFamily: 'PlayfairDisplay_700Bold' },
  wHiLo: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontFamily: 'Inter_500Medium', marginTop: 2 },
  wStrip: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 18, backgroundColor: 'rgba(8,18,64,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statLabel: { fontSize: 12.5, fontFamily: 'Inter_400Regular' },
  statSep: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.12)' },

  newsHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  newsLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  headline: { fontSize: 17, lineHeight: 23, fontFamily: 'Inter_600SemiBold' },
  source: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 4 },
  more: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },

  promptChip: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, paddingHorizontal: 18, borderRadius: 23, borderWidth: 1.2 },
  promptText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20 },
  toolChip: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, paddingHorizontal: 18, borderRadius: 23, borderWidth: 1.4 },
  toolText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
