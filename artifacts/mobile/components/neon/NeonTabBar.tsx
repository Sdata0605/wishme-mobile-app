import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/Icon';
import { withAlpha } from '@/constants/neon';
import { useTheme } from '@/context/ThemeContext';
import { useVoiceAssistant } from '@/context/VoiceAssistantContext';

/** The slice of the tab-bar props this bar uses (the navigation types are not a direct dependency). */
interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { emit: (e: { type: 'tabPress'; target: string; canPreventDefault: boolean }) => { defaultPrevented: boolean }; navigate: (name: never) => void };
}

const ORB = 64;
const BAR_H = 66;
const NOTCH_R = 42;

/** Left and right of the mic, in order. `route` is the tab's route name. */
const LEFT: { route: string; label: string; icon: IconName }[] = [
  { route: 'index', label: 'Home', icon: 'home' },
  { route: 'all-services', label: 'Services', icon: 'layers' },
];
const RIGHT: { route: string; label: string; icon: IconName }[] = [
  { route: 'hub', label: 'Hub', icon: 'calendar' },
  { route: 'profile', label: 'You', icon: 'user' },
];

function NavItem({ item, selected, onPress }: { item: (typeof LEFT)[number]; selected: boolean; onPress: () => void }) {
  const { neon } = useTheme();
  const scale = useRef(new Animated.Value(selected ? 1.06 : 1)).current;
  useEffect(() => {
    Animated.timing(scale, { toValue: selected ? 1.06 : 1, duration: 220, easing: Easing.out(Easing.back(2)), useNativeDriver: true }).start();
  }, [selected, scale]);
  const on = neon.isDark ? neon.cyan : neon.violet;
  return (
    <Pressable style={styles.item} onPress={onPress} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected }}>
      <Animated.View
        style={[
          styles.pill,
          selected && { backgroundColor: withAlpha(on, 0.16), borderColor: withAlpha(on, 0.7) },
          { transform: [{ scale }] },
        ]}
      >
        <Icon name={item.icon} size={22} color={selected ? on : neon.navIdle} />
      </Animated.View>
      <Text style={[styles.label, { color: selected ? on : neon.navIdle, fontFamily: selected ? 'Inter_600SemiBold' : 'Inter_500Medium' }]} maxFontSizeMultiplier={1.2}>
        {item.label}
      </Text>
    </Pressable>
  );
}

/**
 * The docked mic: a dark disc inside a violet-to-cyan ring, a perfect circle, breathing gently and sending rings out
 * while the assistant is listening. It is drawn as an SVG circle so no square gradient can ever show behind it.
 */
function Orb({ active, onPress, onLongPress }: { active: boolean; onPress: () => void; onLongPress: () => void }) {
  const { neon } = useTheme();
  const breath = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const swap = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    const b = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breath, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    b.start();
    return () => b.stop();
  }, [breath]);

  useEffect(() => {
    Animated.timing(swap, { toValue: active ? 1 : 0, duration: 250, useNativeDriver: true }).start();
    if (!active) { ring.setValue(0); return; }
    const r = Animated.loop(Animated.timing(ring, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true }));
    r.start();
    return () => r.stop();
  }, [active, ring, swap]);

  const halo = (offset: number) => {
    const p = Animated.modulo(Animated.add(ring, offset), 1);
    return (
      <Animated.View
        pointerEvents="none"
        style={[styles.halo, {
          borderColor: neon.cyan,
          opacity: Animated.multiply(swap, p.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] })),
          transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [1.15, 2.1] }) }],
        }]}
      />
    );
  };

  const ink = neon.isDark ? '#fff' : neon.violet;

  return (
    <View style={styles.orbWrap} pointerEvents="box-none">
      {halo(0)}
      {halo(0.5)}
      <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={450} accessibilityRole="button" accessibilityLabel={active ? 'Stop the assistant' : 'Talk to the assistant'}>
        <Animated.View style={{ transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.03] }) }] }}>
          {/* soft glow under the orb: a circle, so the shadow is round too */}
          <View style={[styles.glow, { backgroundColor: withAlpha(neon.violet, 0.3), shadowColor: neon.violet }]} />
          <Svg width={ORB} height={ORB}>
            <Defs>
              <LinearGradient id="orbRing" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={neon.violet} />
                <Stop offset="0.5" stopColor={neon.pink} />
                <Stop offset="1" stopColor={neon.cyan} />
              </LinearGradient>
            </Defs>
            <Circle cx={ORB / 2} cy={ORB / 2} r={ORB / 2 - 2.5} fill={neon.orbDisc} stroke="url(#orbRing)" strokeWidth={4} />
          </Svg>
          <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
            <Animated.View style={[styles.center, { position: 'absolute', opacity: swap.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
              <Icon name="mic" size={28} color={ink} />
            </Animated.View>
            <Animated.View style={[styles.center, { position: 'absolute', opacity: swap }]}>
              <Icon name="x" size={28} color={neon.cyan} />
            </Animated.View>
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

/** The dock outline: a flat top edge with a round notch around the mic, a soft fill and a glowing gradient edge. */
function DockShape({ width, height }: { width: number; height: number }) {
  const { neon } = useTheme();
  const cx = width / 2;
  const r = NOTCH_R;
  const a = cx - r - 14; // where the left shoulder starts to curve down
  const b = cx + r + 14;
  // flat edge, a rounded shoulder, a circular dip around the orb, the mirrored shoulder, flat edge again
  const edge =
    `M0 0.8 H${a} C${a + 9} 0.8 ${cx - r + 2} 6 ${cx - r + 8} 15 ` +
    `A${r - 6} ${r - 6} 0 0 0 ${cx + r - 8} 15 ` +
    `C${cx + r - 2} 6 ${b - 9} 0.8 ${b} 0.8 H${width}`;
  const fill = `${edge} V${height} H0 Z`;
  const edgeA = neon.isDark ? neon.cyan : neon.violet;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="dockEdge" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={edgeA} />
          <Stop offset="0.38" stopColor={neon.blue} />
          <Stop offset="0.5" stopColor={neon.violet} />
          <Stop offset="0.62" stopColor={neon.blue} />
          <Stop offset="1" stopColor={edgeA} />
        </LinearGradient>
      </Defs>
      <Path d={fill} fill={neon.dock} />
      <Path d={edge} fill="none" stroke="url(#dockEdge)" strokeOpacity={0.25} strokeWidth={5} />
      <Path d={edge} fill="none" stroke="url(#dockEdge)" strokeWidth={1.6} />
    </Svg>
  );
}

/**
 * MyAssistant's bottom bar: Home, Services, the mic, Hub, You. The selected tab sits in a cyan-outlined pill; the mic
 * is docked in a round notch. Tapping the mic from another tab takes you to the AI home (where the app opens); on the
 * AI home it starts and stops the assistant. A long press starts or stops it from anywhere.
 */
export function NeonTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { open, toggle, close } = useVoiceAssistant();
  const [w, setW] = useState(0);
  const current = state.routes[state.index]?.name;
  // The live connection is warmed up in the background (state 'connecting'), so only an open assistant counts.
  const active = open;
  const height = BAR_H + insets.bottom;

  const go = (route: string) => {
    Haptics.selectionAsync().catch(() => {});
    const r = state.routes.find((x) => x.name === route);
    if (!r) return;
    const focused = state.routes[state.index]?.key === r.key;
    const ev = navigation.emit({ type: 'tabPress', target: r.key, canPreventDefault: true });
    if (!focused && !ev.defaultPrevented) navigation.navigate(r.name as never);
  };

  const onOrb = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (active) { close(); return; }
    if (current !== 'assistant') { go('assistant'); return; }
    toggle();
  };
  const onOrbHold = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    if (active) close();
    else toggle();
  };

  return (
    <View style={[styles.bar, { height, paddingBottom: insets.bottom }]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 ? <DockShape width={w} height={height} /> : null}
      <View style={styles.row}>
        {LEFT.map((i) => <NavItem key={i.route} item={i} selected={current === i.route} onPress={() => go(i.route)} />)}
        <View style={{ width: 84 }} />
        {RIGHT.map((i) => <NavItem key={i.route} item={i} selected={current === i.route} onPress={() => go(i.route)} />)}
      </View>
      <Orb active={active} onPress={onOrb} onLongPress={onOrbHold} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  row: { flex: 1, flexDirection: 'row', paddingTop: 6 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  pill: { width: 58, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1.2, borderColor: 'transparent' },
  label: { fontSize: 11 },
  orbWrap: { position: 'absolute', left: 0, right: 0, top: -ORB / 2, alignItems: 'center', height: ORB },
  center: { alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', left: 4, right: 4, top: 6, bottom: -4, borderRadius: ORB / 2, shadowOpacity: 0.7, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } },
  halo: { position: 'absolute', top: 0, width: ORB, height: ORB, borderRadius: ORB / 2, borderWidth: 1.6 },
});
