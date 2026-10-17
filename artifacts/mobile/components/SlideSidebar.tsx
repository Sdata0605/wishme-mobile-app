import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
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
import { Icon, type IconName } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';

export interface SidebarItem {
  key: string;
  label: string;
  description?: string;
  icon: IconName;
  count?: number | null;
}

export interface SidebarGroup {
  title: string;
  items: SidebarItem[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  groups: SidebarGroup[];
  activeKey: string;
  onSelect: (key: string) => void;
  footer?: { label: string; icon: IconName; onPress: () => void }[];
}

const { width: SCREEN_W } = Dimensions.get('window');
const WIDTH = Math.min(330, Math.round(SCREEN_W * 0.84));

/** A left slide-in drawer: dimmed backdrop, tap outside / swipe left / back button to close. */
export function SlideSidebar({ open, onClose, title, subtitle, groups, activeKey, onSelect, footer }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: open ? 260 : 210,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, progress]);

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

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
        <Pressable style={[StyleSheet.absoluteFill, s.backdrop]} onPress={onClose} accessibilityLabel="Close menu" />
      </Animated.View>

      <Animated.View
        {...pan.panHandlers}
        style={[s.panel, { width: WIDTH, backgroundColor: colors.background, transform: [{ translateX }] }]}
      >
        <LinearGradient
          colors={['#FF6B33', '#E8527A', '#B44CFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.head, { paddingTop: insets.top + 16 }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.headTitle}>{title}</Text>
            {subtitle ? <Text style={s.headSub}>{subtitle}</Text> : null}
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={s.closeBtn} accessibilityLabel="Close menu">
            <Icon name="x" size={20} color="#fff" />
          </TouchableOpacity>
        </LinearGradient>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 12, paddingBottom: 12 }}
        >
          {groups.map(group => (
            <View key={group.title} style={{ marginBottom: 14 }}>
              <Text style={[s.groupTitle, { color: colors.mutedForeground }]}>{group.title.toUpperCase()}</Text>
              {group.items.map(item => {
                const active = item.key === activeKey;
                return (
                  <TouchableOpacity
                    key={item.key}
                    activeOpacity={0.8}
                    onPress={() => onSelect(item.key)}
                    style={[s.row, active && { backgroundColor: '#FF6B33' + '1A', borderColor: '#FF6B33' + '55' }]}
                  >
                    <View style={[s.rowIcon, { backgroundColor: active ? '#FF6B33' : colors.card, borderColor: colors.border }]}>
                      <Icon name={item.icon} size={19} color={active ? '#fff' : colors.foreground} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.rowLabel, { color: active ? '#FF6B33' : colors.foreground }]} numberOfLines={1}>{item.label}</Text>
                      {item.description ? (
                        <Text style={[s.rowDesc, { color: colors.mutedForeground }]} numberOfLines={1}>{item.description}</Text>
                      ) : null}
                    </View>
                    {item.count != null && item.count > 0 && (
                      <View style={[s.count, { backgroundColor: active ? '#FF6B33' : colors.border }]}>
                        <Text style={[s.countText, { color: active ? '#fff' : colors.foreground }]}>{item.count}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>

        {footer && footer.length > 0 && (
          <View style={[s.footer, { borderTopColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
            {footer.map(f => (
              <TouchableOpacity key={f.label} onPress={f.onPress} activeOpacity={0.8} style={[s.footerBtn, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Icon name={f.icon} size={16} color={colors.primary} />
                <Text style={[s.footerText, { color: colors.foreground }]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.55)' },
  panel: {
    position: 'absolute', top: 0, bottom: 0, left: 0,
    borderTopRightRadius: 26, borderBottomRightRadius: 26, overflow: 'hidden',
    elevation: 24, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 6, height: 0 },
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 20 },
  headTitle: { color: '#fff', fontSize: 22, fontFamily: 'Inter_700Bold' },
  headSub: { color: 'rgba(255,255,255,0.88)', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  groupTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.8, marginLeft: 8, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, borderWidth: 1, borderColor: 'transparent', marginBottom: 2 },
  rowIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  rowLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  rowDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  count: { minWidth: 24, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  countText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  footer: { borderTopWidth: 1, paddingHorizontal: 12, paddingTop: 12, gap: 8 },
  footerBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1 },
  footerText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
