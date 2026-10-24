import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';
import { DIRECTOR_ID, type CastMember, type SpeakerId } from '@/services/council/types';

/** One colour per seat, used on the setup page and in the room. */
export const SEAT_COLOURS = ['#2B7BFF', '#E555FF', '#25DFFF', '#F5A00F', '#0AF0A0', '#FF6B6B'];

export function seatColour(index: number): string {
  return SEAT_COLOURS[index % SEAT_COLOURS.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export function seatLabel(pan: number): string {
  if (pan < -0.5) return 'far left';
  if (pan < -0.15) return 'left';
  if (pan <= 0.15) return 'centre';
  if (pan <= 0.5) return 'right';
  return 'far right';
}

const TABLE_HEIGHT = 230;
const AVATAR = 50;

/** A soft ring that breathes around whoever is talking. */
function Pulse({ colour }: { colour: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pulse,
        {
          borderColor: colour,
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.75, 0] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
        },
      ]}
    />
  );
}

/** Three dots that blink while a speaker's line is being written. */
function Thinking({ colour }: { colour: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View style={[styles.thinking, { backgroundColor: colour, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }]}>
      <Text style={styles.thinkingText}>…</Text>
    </Animated.View>
  );
}

interface SeatProps {
  x: number;
  y: number;
  colour: string;
  label: string;
  caption: string;
  speaking: boolean;
  thinking: boolean;
  icon?: 'sparkles';
}

function SeatAvatar({ x, y, colour, label, caption, speaking, thinking, icon }: SeatProps) {
  const { neon } = useTheme();
  return (
    <View style={[styles.seat, { left: x - AVATAR / 2, top: y - AVATAR / 2 }]}>
      <View style={styles.avatarWrap}>
        {speaking ? <Pulse colour={colour} /> : null}
        <View style={[styles.avatar, { borderColor: colour, backgroundColor: speaking ? colour : neon.surfaceHigh, borderWidth: speaking ? 2.5 : 2 }]}>
          {icon ? <Icon name={icon} size={20} color={speaking ? '#FFFFFF' : colour} /> : <Text style={[styles.initials, { color: speaking ? '#FFFFFF' : colour }]}>{label}</Text>}
        </View>
        {thinking ? <Thinking colour={colour} /> : null}
      </View>
      <Text style={[styles.caption, { color: speaking ? neon.textHi : neon.textLo }]} numberOfLines={1}>{caption}</Text>
    </View>
  );
}

/**
 * The table: the director at the head, the cast along the near side from left to right exactly as they are heard, and
 * the listener at the bottom. The one talking lights up; the one writing their line shows dots.
 */
export function SeatTable({ cast, directorName, speaking, thinking }: { cast: CastMember[]; directorName: string; speaking: SpeakerId | null; thinking: SpeakerId | null }) {
  const { neon } = useTheme();
  const { width } = useWindowDimensions();
  const w = width - 40;
  const cx = w / 2;
  const seatX = (pan: number) => cx + pan * (cx - AVATAR / 2 - 6);
  // Centre seats sit nearer the listener (lower), the far ends of the table a little higher up.
  const seatY = (pan: number) => 142 - (1 - Math.abs(pan)) * 26;

  return (
    <View style={[styles.table, { width: w }]}>
      <Svg width={w} height={TABLE_HEIGHT} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="tableGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={neon.violet} stopOpacity={0.35} />
            <Stop offset="1" stopColor={neon.violet} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={cx} cy={100} rx={cx - 30} ry={62} fill="url(#tableGlow)" />
        <Ellipse cx={cx} cy={100} rx={cx - 44} ry={48} fill={neon.glass} stroke={neon.cardBorder} strokeWidth={1.5} />
      </Svg>
      <SeatAvatar x={cx} y={38} colour={neon.violet} label="" caption={directorName} icon="sparkles" speaking={speaking === DIRECTOR_ID} thinking={thinking === DIRECTOR_ID} />
      {cast.map((m, i) => (
        <SeatAvatar key={m.id} x={seatX(m.seat.pan)} y={seatY(m.seat.pan)} colour={seatColour(i)} label={initials(m.name)} caption={m.name.split(' ')[0]} speaking={speaking === m.id} thinking={thinking === m.id} />
      ))}
      <View style={[styles.you, { left: cx - 22 }]}>
        <View style={[styles.youDot, { backgroundColor: neon.cyan }]} />
        <Text style={[styles.youText, { color: neon.textDim }]}>you</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  table: { height: TABLE_HEIGHT, alignSelf: 'center' },
  seat: { position: 'absolute', width: AVATAR, alignItems: 'center' },
  avatarWrap: { width: AVATAR, height: AVATAR, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, alignItems: 'center', justifyContent: 'center' },
  pulse: { position: 'absolute', width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, borderWidth: 2 },
  initials: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  thinking: { position: 'absolute', right: -8, top: -4, paddingHorizontal: 5, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  thinkingText: { color: '#FFFFFF', fontSize: 11, fontFamily: 'Inter_700Bold', lineHeight: 13 },
  caption: { fontSize: 11.5, fontFamily: 'Inter_600SemiBold', marginTop: 5, width: 84, textAlign: 'center' },
  you: { position: 'absolute', bottom: 6, width: 44, alignItems: 'center', gap: 2 },
  youDot: { width: 8, height: 8, borderRadius: 4 },
  youText: { fontSize: 10.5, fontFamily: 'Inter_500Medium' },
});
