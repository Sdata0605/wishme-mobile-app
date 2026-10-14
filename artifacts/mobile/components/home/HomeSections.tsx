import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { PressScale } from '@/components/neon/Motion';
import { mix, withAlpha } from '@/constants/neon';
import { useTheme } from '@/context/ThemeContext';
import { dayKey, type AgendaItem, type MonthItem } from '@/hooks/useHomeBrief';

// ─── small pieces ────────────────────────────────────────────────────────────

/** A 28px gradient tile holding a white icon, then the title. */
export function SectionTitle({ icon, title, tint }: { icon: IconName; title: string; tint: string }) {
  const { neon } = useTheme();
  return (
    <View style={s.titleRow}>
      <LinearGradient colors={neon.tile(tint) as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.titleTile}>
        <Icon name={icon} size={15} color="#fff" />
      </LinearGradient>
      <Text style={[s.titleText, { color: neon.textHi }]}>{title}</Text>
    </View>
  );
}

/** The card every row sits in: surfaceHigh, radius 16, a hairline, no shadow. */
export function Tile({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) {
  const { neon } = useTheme();
  const body = (
    <View style={[s.tile, { backgroundColor: neon.surfaceHigh, borderColor: neon.line }]}>{children}</View>
  );
  return onPress ? <PressScale onPress={onPress}>{body}</PressScale> : body;
}

export function EmptyLine({ icon, text, color }: { icon: IconName; text: string; color: string }) {
  const { neon } = useTheme();
  return (
    <View style={[s.empty, { backgroundColor: neon.surface, borderColor: neon.line }]}>
      <Icon name={icon} size={16} color={color} />
      <Text style={[s.emptyText, { color: neon.textLo }]}>{text}</Text>
    </View>
  );
}

function clock(d: Date): string {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

function timeLabel(item: AgendaItem): string {
  if (!item.at) return 'anytime';
  const d = new Date(item.at);
  const today = new Date();
  const sameDay = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  return sameDay ? clock(d) : `${d.toLocaleDateString('en-IN', { weekday: 'short' })} ${clock(d)}`;
}

export function AgendaTile({ item, onPress }: { item: AgendaItem; onPress: () => void }) {
  const { neon } = useTheme();
  const tint = item.kind === 'event' ? neon.cyan : neon.violet;
  return (
    <Tile onPress={onPress}>
      <View style={[s.timePill, { backgroundColor: withAlpha(tint, 0.14) }]}>
        <Text style={[s.timeText, { color: tint }]}>{timeLabel(item)}</Text>
      </View>
      <Text style={[s.tileText, { color: neon.textHi }]} numberOfLines={2}>{item.title}</Text>
    </Tile>
  );
}

// ─── try asking ──────────────────────────────────────────────────────────────

export function TryAskingRow({ ideas, onAsk }: { ideas: { label: string; prompt: string }[]; onAsk: (prompt: string) => void }) {
  const { neon } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 34, flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingRight: 20 }}>
      {ideas.map(i => (
        <PressScale key={i.label} onPress={() => onAsk(i.prompt)}>
          <View style={[s.chip, { backgroundColor: withAlpha(neon.violet, 0.1), borderColor: withAlpha(neon.violet, 0.28) }]}>
            <Icon name="mic" size={13} color={neon.violet} />
            <Text style={[s.chipText, { color: neon.textHi }]} maxFontSizeMultiplier={1.3}>{i.label}</Text>
          </View>
        </PressScale>
      ))}
    </ScrollView>
  );
}

// ─── call LED ────────────────────────────────────────────────────────────────

/** Shown only while the assistant is on a call: a pulsing green dot and what it is doing. */
export function CallLed({ text, onPress }: { text: string; onPress: () => void }) {
  const { neon } = useTheme();
  const green = '#35C48D';
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[s.led, { backgroundColor: withAlpha(green, 0.1), borderColor: withAlpha(green, 0.32) }]}>
        <View style={s.dotWrap}>
          <Animated.View
            style={[s.halo, {
              backgroundColor: green,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
            }]}
          />
          <View style={[s.dot, { backgroundColor: green }]} />
        </View>
        <Text style={[s.ledText, { color: neon.textHi }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{text}</Text>
        <Icon name="chevron-right" size={16} color={neon.textDim} />
      </TouchableOpacity>
    </View>
  );
}

// ─── month heat-map ──────────────────────────────────────────────────────────

const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function MonthHeatmap({
  month, onMonth, byDay, loading, onOpenItem,
}: {
  month: Date;
  onMonth: (d: Date) => void;
  byDay: Record<string, MonthItem[]>;
  loading: boolean;
  onOpenItem: (item: MonthItem) => void;
}) {
  const { neon } = useTheme();
  const today = new Date();
  const [selected, setSelected] = useState<string>(dayKey(today));

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7; // Monday first
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const out: (number | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= days; d++) out.push(d);
    while (out.length % 7) out.push(null);
    return out;
  }, [month]);

  const fill = (n: number) => (n === 0 ? neon.surfaceHigh : n === 1 ? mix(neon.violet, '#FFFFFF', 0.35) : n === 2 ? neon.violet : neon.pink);
  const label = month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const selItems = byDay[selected] ?? [];
  const selDate = (() => { const [y, m, d] = selected.split('-').map(Number); return new Date(y, m - 1, d); })();
  const selLabel = selDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });

  return (
    <View>
      <View style={s.mHead}>
        <Icon name="calendar" size={15} color={neon.violet} />
        <Text style={[s.mTitle, { color: neon.textHi }]}>{label}</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity hitSlop={10} onPress={() => onMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
          <Icon name="chevron-left" size={18} color={neon.textLo} />
        </TouchableOpacity>
        <TouchableOpacity hitSlop={10} onPress={() => onMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={{ marginLeft: 12 }}>
          <Icon name="chevron-right" size={18} color={neon.textLo} />
        </TouchableOpacity>
      </View>

      <View style={[s.mCard, { backgroundColor: neon.surface, borderColor: neon.line }]}>
        <View style={s.mRow}>
          {WEEK.map((w, i) => <Text key={i} style={[s.mWeek, { color: neon.textDim }]}>{w}</Text>)}
        </View>
        {loading && <ActivityIndicator size="small" color={neon.textLo} style={{ position: 'absolute', top: 8, right: 10 }} />}
        {Array.from({ length: cells.length / 7 }, (_, r) => (
          <View key={r} style={s.mRow}>
            {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
              if (d === null) return <View key={i} style={s.mCell} />;
              const key = dayKey(new Date(month.getFullYear(), month.getMonth(), d));
              const n = byDay[key]?.length ?? 0;
              const isToday = key === dayKey(today);
              const sel = key === selected;
              const bg = fill(n);
              const light = n === 1;
              return (
                <TouchableOpacity key={i} style={s.mCell} activeOpacity={0.8} onPress={() => setSelected(key)}>
                  <View style={[s.mDay, { backgroundColor: bg, borderColor: isToday || sel ? neon.violet : 'transparent', borderWidth: isToday || sel ? 1.6 : 0 }]}>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: n >= 2 ? '#fff' : light ? '#1B1D28' : neon.textLo }}>{d}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
        <View style={s.legend}>
          <Text style={[s.legendText, { color: neon.textDim }]}>Less</Text>
          {[0, 1, 2, 3].map(n => <View key={n} style={[s.legendBox, { backgroundColor: fill(n) }]} />)}
          <Text style={[s.legendText, { color: neon.textDim }]}>More</Text>
        </View>
      </View>

      <View style={{ marginTop: 10, gap: 6 }}>
        {selItems.length === 0 ? (
          <Text style={{ color: neon.textDim, fontSize: 12.5, marginLeft: 4 }}>Nothing on {selLabel}.</Text>
        ) : (
          selItems.map(it => (
            <Tile key={it.key} onPress={() => onOpenItem(it)}>
              <View style={[s.timePill, { backgroundColor: withAlpha(it.kind === 'event' ? neon.cyan : neon.violet, 0.14) }]}>
                <Text style={[s.timeText, { color: it.kind === 'event' ? neon.cyan : neon.violet }]}>
                  {it.at ? clock(new Date(it.at)) : 'anytime'}
                </Text>
              </View>
              <Text style={[s.tileText, { color: neon.textHi }]} numberOfLines={2}>{it.title}</Text>
            </Tile>
          ))
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  titleTile: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  titleText: { fontSize: 14.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.1 },
  tile: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, borderWidth: 1, marginBottom: 8 },
  tileText: { flex: 1, fontSize: 13.5, lineHeight: 17, fontFamily: 'Inter_500Medium' },
  timePill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12 },
  timeText: { fontSize: 11.5, fontFamily: 'Inter_700Bold' },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 9, marginLeft: 4, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  emptyText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold' },
  led: { flexDirection: 'row', alignItems: 'center', gap: 9, alignSelf: 'flex-start', maxWidth: '100%', paddingLeft: 11, paddingRight: 13, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  dotWrap: { width: 9, height: 9, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 9, height: 9, borderRadius: 5 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  ledText: { flexShrink: 1, fontSize: 12.5, fontFamily: 'Inter_600SemiBold' },
  mHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  mTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 0.2 },
  mCard: { padding: 10, borderRadius: 14, borderWidth: 1 },
  mRow: { flexDirection: 'row' },
  mWeek: { flex: 1, textAlign: 'center', fontSize: 10, fontFamily: 'Inter_500Medium', marginBottom: 4 },
  mCell: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', padding: 2 },
  mDay: { width: '100%', height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 6 },
  legendText: { fontSize: 9.5, fontFamily: 'Inter_400Regular' },
  legendBox: { width: 12, height: 12, borderRadius: 3 },
});
