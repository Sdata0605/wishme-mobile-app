import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';

interface Props {
  label: string;
  /** "YYYY-MM-DD", or "" when nothing is chosen. */
  value: string;
  onChange: (next: string) => void;
  /** birthday: years go back about 110 years. occasion: this year and the next few. */
  kind?: 'birthday' | 'occasion';
  placeholder?: string;
  /** Shows a Clear button. */
  optional?: boolean;
  accent?: string;
}

const ITEM_H = 44;
const VISIBLE = 5;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (n: number) => String(n).padStart(2, '0');
const daysIn = (month: number, year: number) => new Date(year, month + 1, 0).getDate();

function parse(value: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  if (mo < 0 || mo > 11 || d < 1 || d > daysIn(mo, y)) return null;
  return { y, m: mo, d };
}

export function prettyDate(value: string | null | undefined): string {
  return pretty(value ?? '') || (value ?? '');
}

function pretty(value: string): string {
  const p = parse(value);
  return p ? `${p.d} ${MONTHS[p.m].slice(0, 3)} ${p.y}` : '';
}

function ageText(value: string): string {
  const p = parse(value);
  if (!p) return '';
  const now = new Date();
  let age = now.getFullYear() - p.y;
  if (now.getMonth() < p.m || (now.getMonth() === p.m && now.getDate() < p.d)) age -= 1;
  return age >= 0 ? `${age} yrs old` : '';
}

function Wheel({
  items, index, onIndex, flex, accent,
}: { items: string[]; index: number; onIndex: (i: number) => void; flex: number; accent: string }) {
  const { colors } = useTheme();
  const ref = useRef<ScrollView>(null);
  const settled = useRef(index);

  useEffect(() => {
    if (index !== settled.current) {
      settled.current = index;
      ref.current?.scrollTo({ y: index * ITEM_H, animated: true });
    }
  }, [index]);

  const onLayout = () => {
    ref.current?.scrollTo({ y: index * ITEM_H, animated: false });
    settled.current = index;
  };

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(0, Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.y / ITEM_H)));
    settled.current = i;
    if (i !== index) onIndex(i);
  };

  return (
    <View style={{ flex, height: ITEM_H * VISIBLE }}>
      <ScrollView
        ref={ref}
        onLayout={onLayout}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
        contentContainerStyle={{ paddingVertical: ITEM_H * Math.floor(VISIBLE / 2) }}
      >
        {items.map((label, i) => {
          const on = i === index;
          return (
            <TouchableOpacity
              key={`${label}-${i}`}
              activeOpacity={0.7}
              onPress={() => { settled.current = i; ref.current?.scrollTo({ y: i * ITEM_H, animated: true }); onIndex(i); }}
              style={s.item}
            >
              <Text style={{ fontSize: on ? 19 : 16, fontFamily: on ? 'Inter_700Bold' : 'Inter_400Regular', color: on ? accent : colors.mutedForeground }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function DatePickerField({ label, value, onChange, kind = 'occasion', placeholder = 'Select a date', optional, accent = '#1F7BFF' }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const now = new Date();
  const thisYear = now.getFullYear();
  const years = useMemo(() => {
    const first = kind === 'birthday' ? thisYear - 110 : thisYear - 1;
    const last = kind === 'birthday' ? thisYear : thisYear + 5;
    return Array.from({ length: last - first + 1 }, (_, i) => first + i);
  }, [kind, thisYear]);

  const start = useCallback(() => {
    const p = parse(value);
    if (p) return p;
    return kind === 'birthday'
      ? { y: thisYear - 25, m: 0, d: 1 }
      : { y: thisYear, m: now.getMonth(), d: now.getDate() };
  }, [value, kind, thisYear]); // eslint-disable-line react-hooks/exhaustive-deps

  const [y, setY] = useState(start().y);
  const [m, setM] = useState(start().m);
  const [d, setD] = useState(start().d);

  const openSheet = () => {
    const p = start();
    setY(Math.min(years[years.length - 1], Math.max(years[0], p.y)));
    setM(p.m);
    setD(p.d);
    setOpen(true);
  };

  const dim = daysIn(m, y);
  const day = Math.min(d, dim);
  const dayItems = useMemo(() => Array.from({ length: dim }, (_, i) => String(i + 1)), [dim]);

  const confirm = () => {
    onChange(`${y}-${pad(m + 1)}-${pad(day)}`);
    setOpen(false);
  };

  const quick = (offsetDays: number) => {
    const t = new Date();
    t.setDate(t.getDate() + offsetDays);
    setY(Math.min(years[years.length - 1], Math.max(years[0], t.getFullYear())));
    setM(t.getMonth());
    setD(t.getDate());
  };

  const shown = pretty(value);
  const sub = kind === 'birthday' ? ageText(value) : '';

  return (
    <>
      <TouchableOpacity
        onPress={openSheet}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${shown || placeholder}`}
        style={[s.field, { backgroundColor: colors.input ?? colors.card, borderColor: colors.border }]}
      >
        <Icon name="calendar" size={18} color={shown ? accent : colors.mutedForeground} />
        <Text style={{ flex: 1, color: shown ? colors.foreground : colors.mutedForeground, fontFamily: shown ? 'Inter_500Medium' : 'Inter_400Regular', fontSize: 15 }}>
          {shown || placeholder}
        </Text>
        {sub ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{sub}</Text> : null}
        <Icon name="chevron-down" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable onPress={() => {}} style={[s.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 14 }]}>
            <View style={s.head}>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={10}>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[s.title, { color: colors.foreground }]}>{label}</Text>
              {optional && value ? (
                <TouchableOpacity onPress={() => { onChange(''); setOpen(false); }} hitSlop={10}>
                  <Text style={{ color: '#EF4444', fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>Clear</Text>
                </TouchableOpacity>
              ) : <View style={{ width: 44 }} />}
            </View>

            {kind === 'occasion' && (
              <View style={s.quickRow}>
                {[['Today', 0], ['Tomorrow', 1], ['In a week', 7], ['In a month', 30]].map(([t, n]) => (
                  <TouchableOpacity key={t as string} onPress={() => quick(n as number)} style={[s.quick, { borderColor: colors.border, backgroundColor: colors.card }]}>
                    <Text style={{ color: colors.foreground, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={s.wheels}>
              <View pointerEvents="none" style={[s.band, { backgroundColor: accent + '1F', borderColor: accent + '55' }]} />
              <Wheel items={dayItems} index={day - 1} onIndex={i => setD(i + 1)} flex={1} accent={accent} />
              <Wheel items={MONTHS} index={m} onIndex={setM} flex={2.2} accent={accent} />
              <Wheel items={years.map(String)} index={Math.max(0, years.indexOf(y))} onIndex={i => setY(years[i])} flex={1.4} accent={accent} />
            </View>

            <Text style={[s.preview, { color: colors.foreground }]}>{day} {MONTHS[m]} {y}</Text>

            <TouchableOpacity onPress={confirm} activeOpacity={0.9} style={[s.done, { backgroundColor: accent }]}>
              <Text style={s.doneText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 48 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  quickRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  quick: { paddingHorizontal: 12, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  wheels: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  band: { position: 'absolute', left: 0, right: 0, height: ITEM_H, top: ITEM_H * Math.floor(VISIBLE / 2), borderRadius: 12, borderWidth: 1 },
  item: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  preview: { textAlign: 'center', fontSize: 14, fontFamily: 'Inter_500Medium' },
  done: { height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  doneText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
});
