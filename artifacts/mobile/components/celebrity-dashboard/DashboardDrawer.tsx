import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  PanResponder,
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
import { BRAND_GRADIENT, DASH_SECTIONS, GROUP_ORDER } from './sections';
import type { Celebrity } from './shared';

const { width: SCREEN_W } = Dimensions.get('window');
const WIDTH = Math.min(320, Math.round(SCREEN_W * 0.84));

/** Dashboard side bar: who you are, then the nine screens in four groups, with a badge where something waits. */
export function DashboardDrawer({
  open,
  onClose,
  celebrity,
  activeKey,
  onSelect,
  badges,
  descriptions,
  onSwitchToUser,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  celebrity: Celebrity;
  activeKey: string;
  onSelect: (key: string) => void;
  /** Number shown on a row's badge (hidden when 0). Keyed by section. */
  badges: Record<string, number>;
  /** Replaces a row's one-line description with live text, e.g. "1,240 subscribers". */
  descriptions: Record<string, string>;
  onSwitchToUser: () => void;
  onSignOut: () => void;
}) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(open);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (open) setMounted(true);
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: reduceMotion ? 0 : open ? 260 : 200,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, progress, reduceMotion]);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [open, onClose]);

  // Dragging the drawer to the left closes it.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dx < -12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => progress.setValue(Math.max(0, 1 + g.dx / WIDTH)),
      onPanResponderRelease: (_, g) => {
        if (g.dx < -WIDTH * 0.25 || g.vx < -0.6) onClose();
        else Animated.timing(progress, { toValue: 1, duration: 160, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => {
        Animated.timing(progress, { toValue: 1, duration: 160, useNativeDriver: true }).start();
      },
    }),
  ).current;

  if (!mounted) return null;

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-WIDTH, 0] });
  const row = isDark ? 'rgba(123,92,250,0.16)' : 'rgba(123,92,250,0.10)';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
        <Pressable style={[StyleSheet.absoluteFill, s.backdrop]} onPress={onClose} accessibilityLabel="Close menu" />
      </Animated.View>

      <Animated.View
        {...pan.panHandlers}
        style={[s.panel, { width: WIDTH, backgroundColor: colors.background, transform: [{ translateX }] }]}
      >
        <LinearGradient colors={BRAND_GRADIENT as unknown as [string, string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.head, { paddingTop: insets.top + 16 }]}>
          {celebrity.image_url ? (
            <Image source={{ uri: celebrity.image_url }} style={s.avatar} contentFit="cover" />
          ) : (
            <View style={[s.avatar, s.avatarEmpty]}>
              <Text style={s.avatarLetter}>{celebrity.name?.charAt(0) ?? '?'}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.headName} numberOfLines={1}>{celebrity.name}</Text>
            <Text style={s.headSub} numberOfLines={1}>{celebrity.category}</Text>
            <View style={s.pill}><Icon name="check-circle" size={11} color="#fff" /><Text style={s.pillText}>Celebrity</Text></View>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={s.closeBtn} accessibilityLabel="Close menu" accessibilityRole="button">
            <Icon name="x" size={20} color="#fff" />
          </TouchableOpacity>
        </LinearGradient>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 12 }}>
          {GROUP_ORDER.map(group => (
            <View key={group} style={{ marginBottom: 14 }}>
              <Text style={[s.groupTitle, { color: colors.mutedForeground }]}>{group.toUpperCase()}</Text>
              {DASH_SECTIONS.filter(sec => sec.group === group).map(sec => {
                const active = sec.key === activeKey;
                const count = badges[sec.key] ?? 0;
                return (
                  <TouchableOpacity
                    key={sec.key}
                    activeOpacity={0.8}
                    onPress={() => onSelect(sec.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={count > 0 ? `${sec.label}, ${count} need action` : sec.label}
                    style={[s.row, active && { backgroundColor: row }]}
                  >
                    {active ? (
                      <LinearGradient colors={BRAND_GRADIENT as unknown as [string, string, string]} style={s.activeBar} />
                    ) : null}
                    <View style={[s.rowIcon, { backgroundColor: sec.accent + '29' }]}>
                      <Icon name={sec.icon} size={19} color={sec.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.rowLabel, { color: active ? colors.primary : colors.foreground }]} numberOfLines={1}>{sec.label}</Text>
                      <Text style={[s.rowDesc, { color: colors.mutedForeground }]} numberOfLines={1}>{descriptions[sec.key] ?? sec.blurb}</Text>
                    </View>
                    {count > 0 ? (
                      <View style={s.badge}><Text style={s.badgeText}>{count > 99 ? '99+' : count}</Text></View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>

        <View style={[s.footer, { borderTopColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity onPress={onSwitchToUser} activeOpacity={0.8} style={[s.footerBtn, { borderColor: colors.border, backgroundColor: colors.card }]} accessibilityRole="button">
            <Icon name="home" size={16} color={colors.primary} />
            <Text style={[s.footerText, { color: colors.foreground }]}>Switch to user app</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onSignOut} activeOpacity={0.8} style={s.signOut} accessibilityRole="button">
            <Icon name="log-out" size={16} color="#F87171" />
            <Text style={s.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.5)' },
  panel: {
    position: 'absolute', top: 0, bottom: 0, left: 0,
    borderTopRightRadius: 26, borderBottomRightRadius: 26, overflow: 'hidden',
    elevation: 24, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 6, height: 0 },
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 20 },
  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)' },
  avatarEmpty: { backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#fff', fontSize: 22, fontFamily: 'Inter_700Bold' },
  headName: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold' },
  headSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  pillText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  closeBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  groupTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.8, marginLeft: 8, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 14, marginBottom: 2, overflow: 'hidden' },
  activeBar: { position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2 },
  rowIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  rowDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: '#E8527A', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_700Bold' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingTop: 12, gap: 6 },
  footerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 99, minHeight: 46 },
  footerText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  signOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44 },
  signOutText: { color: '#F87171', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
