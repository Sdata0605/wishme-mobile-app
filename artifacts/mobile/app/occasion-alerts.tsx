import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Icon, type IconName } from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { AddOccasionSheet } from '@/components/occasions/AddOccasionSheet';
import { useTheme } from '@/context/ThemeContext';
import {
  DAYS_BEFORE,
  REMINDER_TIMES,
  daysUntilAlert,
  effectiveDate,
  fetchAlerts as loadAlerts,
  patchAlert,
  personOf,
  scheduleOccasionNotifications,
  timeLabel,
  typeInfo,
  type AlertRow,
} from '@/services/occasionAlerts';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type OccasionAlert = AlertRow;

type GroupKey = 'today' | 'week' | 'month' | 'later';

const GROUPS: { key: GroupKey; title: string }[] = [
  { key: 'today', title: 'Today' },
  { key: 'week', title: 'This week' },
  { key: 'month', title: 'This month' },
  { key: 'later', title: 'Later' },
];

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const typeMeta = typeInfo;
const personName = personOf;

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function groupOf(days: number): GroupKey {
  if (days === 0) return 'today';
  if (days <= 7) return 'week';
  if (days <= 30) return 'month';
  return 'later';
}

function relative(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days > 1) return `in ${days} days`;
  return days === -1 ? 'Yesterday' : `${-days} days ago`;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Circle that fills as the date gets closer. */
function Ring({
  size, stroke, progress, color, track, animate,
}: { size: number; stroke: number; progress: number; color: string; track: string; animate: boolean }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const anim = useRef(new Animated.Value(animate ? 0 : progress)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: progress, duration: animate ? 650 : 0, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [anim, progress, animate]);
  const offset = anim.interpolate({ inputRange: [0, 1], outputRange: [c, 0] });
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <AnimatedCircle
        cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset as unknown as number}
      />
    </Svg>
  );
}

function FadeUp({ index, enabled, children }: { index: number; enabled: boolean; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(enabled && index < 8 ? 0 : 1)).current;
  useEffect(() => {
    if (!(enabled && index < 8)) return;
    Animated.timing(v, { toValue: 1, duration: 320, delay: index * 40, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, index, enabled]);
  return (
    <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

function Shimmer({ style }: { style: object }) {
  const { colors } = useTheme();
  const v = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 750, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.4, duration: 750, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={[{ backgroundColor: colors.border, opacity: v }, style]} />;
}

export default function OccasionAlertsScreen() {
  const { colors, isDark } = useTheme();
  const { user, session } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 24 : insets.top;
  const tint = isDark ? '38' : '24';

  const [alerts, setAlerts] = useState<OccasionAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pastOpen, setPastOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [reduceMotion, setReduceMotion] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const groupY = useRef<Record<string, number>>({});
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  };
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const fetchAlerts = useCallback(async (isRefresh = false) => {
    if (!user || !session) return;
    if (isRefresh) setRefreshing(true);
    try {
      const rows = await loadAlerts(user.profileId, session.access_token);
      setAlerts(rows);
      void scheduleOccasionNotifications(rows);
    } catch {
      showToast('Could not load your occasions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, session]);

  useEffect(() => { void fetchAlerts(); }, [fetchAlerts]);

  const patch = useCallback(async (id: string, body: Partial<OccasionAlert>, revert: Partial<OccasionAlert>) => {
    if (!session) return false;
    setAlerts(prev => prev.map(a => (a.id === id ? { ...a, ...body } : a)));
    try {
      await patchAlert(id, body, session.access_token);
      // Phone notifications follow whatever was just changed.
      setAlerts(prev => { void scheduleOccasionNotifications(prev); return prev; });
      return true;
    } catch {
      setAlerts(prev => prev.map(a => (a.id === id ? { ...a, ...revert } : a)));
      showToast('Could not save. Please try again.');
      return false;
    }
  }, [session]);

  const toggleEnabled = (a: OccasionAlert) => {
    const next = !a.alert_enabled;
    patch(a.id, { alert_enabled: next }, { alert_enabled: a.alert_enabled }).then(ok => ok && showToast(next ? 'We will notify you' : 'Notifications off for this occasion'));
  };

  const setTime = async (a: OccasionAlert, time: string) => {
    if ((a.reminder_time ?? '09:00').slice(0, 5) === time) return;
    const ok = await patch(a.id, { reminder_time: `${time}:00` }, { reminder_time: a.reminder_time });
    if (ok) {
      setSaved(a.id);
      setTimeout(() => setSaved(s => (s === a.id ? null : s)), 1200);
    }
  };

  const setDays = async (a: OccasionAlert, days: number) => {
    if (days === a.alert_days_before) return;
    const ok = await patch(a.id, { alert_days_before: days }, { alert_days_before: a.alert_days_before });
    if (ok) {
      setSaved(a.id);
      setTimeout(() => setSaved(s => (s === a.id ? null : s)), 1200);
    }
  };

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(prev => (prev === id ? null : id));
  };

  const withDays = useMemo(() => alerts.map(a => ({ a, days: daysUntilAlert(a) })), [alerts]);
  const upcoming = useMemo(() => withDays.filter(x => x.days >= 0).sort((x, y) => x.days - y.days), [withDays]);
  const past = useMemo(() => withDays.filter(x => x.days < 0).sort((x, y) => y.days - x.days), [withDays]);
  const grouped = useMemo(() => {
    const g: Record<GroupKey, typeof upcoming> = { today: [], week: [], month: [], later: [] };
    for (const x of upcoming) g[groupOf(x.days)].push(x);
    return g;
  }, [upcoming]);

  const next = upcoming[0] ?? null;
  const weekCount = upcoming.filter(x => x.days <= 7).length;
  const autoCount = alerts.filter(a => a.auto_send_enabled).length;
  const todayCount = grouped.today.length;

  useEffect(() => {
    if (reduceMotion || todayCount === 0) { pulse.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.03, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse, todayCount, reduceMotion]);

  const scrollToGroup = (key: GroupKey) => {
    const y = groupY.current[key];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  };

  const sendWish = () => router.push('/wish-friend' as never);
  const openLovedOnes = () => router.push('/loved-ones' as never);
  const openAdd = () => setAdding(true);

  const header = (
    <View style={[s.header, { paddingTop: topPad + 10 }]}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={[s.roundBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Icon name="arrow-left" size={20} color={colors.foreground} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={[s.title, { color: colors.foreground }]}>Occasion Alerts</Text>
        <Text style={[s.subtitle, { color: colors.mutedForeground }]}>Never miss a wish</Text>
      </View>
      <TouchableOpacity onPress={openLovedOnes} hitSlop={8} style={[s.roundBtn, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityLabel="Loved ones">
        <Icon name="users" size={18} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );

  if (!user || !session) {
    return (
      <AmbientBackground><View style={[s.root, { backgroundColor: 'transparent' }]}>
        {header}
        <View style={s.centered}>
          <Text style={[s.emptyTitle, { color: colors.foreground }]}>Sign in to see your occasions</Text>
          <TouchableOpacity style={[s.cta, { backgroundColor: colors.primary }]} onPress={() => router.push('/(auth)' as never)}>
            <Text style={s.ctaText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View></AmbientBackground>
    );
  }

  if (loading) {
    return (
      <AmbientBackground><View style={[s.root, { backgroundColor: 'transparent' }]}>
        {header}
        <View style={{ padding: 20, gap: 16 }}>
          <Shimmer style={{ height: 188, borderRadius: 24 }} />
          <Shimmer style={{ height: 64, borderRadius: 16 }} />
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Shimmer style={{ width: 56, height: 56, borderRadius: 16 }} />
              <View style={{ flex: 1, gap: 8 }}>
                <Shimmer style={{ height: 12, width: '60%', borderRadius: 6 }} />
                <Shimmer style={{ height: 10, width: '40%', borderRadius: 5 }} />
              </View>
            </View>
          ))}
        </View>
      </View></AmbientBackground>
    );
  }

  const heroMeta = next ? typeMeta(next.a.occasion_type) : null;
  const ringProgress = next ? Math.max(0, Math.min(1, 1 - next.days / 30)) : 0;

  return (
    <AmbientBackground><View style={[s.root, { backgroundColor: 'transparent' }]}>
      {header}
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100, gap: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAlerts(true)} tintColor={colors.primary} />}
      >
        {alerts.length === 0 ? (
          <View style={s.emptyWrap}>
            <LinearGradient colors={['#FF6B33', '#E8527A', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.emptyIcon}>
              <Icon name="calendar" size={42} color="#fff" />
            </LinearGradient>
            <Text style={[s.emptyTitle, { color: colors.foreground }]}>No occasions yet</Text>
            <Text style={[s.emptyText, { color: colors.mutedForeground }]}>Add a birthday, anniversary or any special day for anyone, turn on Notify me, and we'll remind you on the day.</Text>
            <TouchableOpacity onPress={openAdd} activeOpacity={0.9}>
              <LinearGradient colors={['#FF6B33', '#E8527A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.gradBtn}>
                <Icon name="plus" size={16} color="#fff" />
                <Text style={s.gradBtnText}>Add your first occasion</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Hero: next occasion */}
            {next && heroMeta ? (
              <LinearGradient colors={['#FF6B33', '#E8527A', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
                <View style={s.watermark} pointerEvents="none">
                  <Icon name={heroMeta.icon} size={120} color="rgba(255,255,255,0.12)" />
                </View>
                <View style={s.heroTop}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={s.heroChip}>
                      <Icon name={heroMeta.icon} size={11} color="#fff" />
                      <Text style={s.heroChipText}>{next.days === 0 ? 'Today' : 'Next occasion'} · {heroMeta.label}</Text>
                    </View>
                    <Text style={s.heroName} numberOfLines={2}>{personName(next.a)}</Text>
                    <Text style={s.heroOcc} numberOfLines={1}>{next.a.occasion_name}</Text>
                    <Text style={s.heroDate}>{fmtDate(effectiveDate(next.a))}</Text>
                  </View>
                  <View style={s.ringWrap}>
                    {next.days === 0 ? (
                      <View style={s.todayDisc}>
                        <Icon name="gift" size={28} color="#E8527A" />
                        <Text style={s.todayText}>Today!</Text>
                      </View>
                    ) : (
                      <>
                        <Ring size={76} stroke={6} progress={ringProgress} color="#fff" track="rgba(255,255,255,0.25)" animate={!reduceMotion} />
                        <View style={s.ringCenter}>
                          <Text style={s.ringNum}>{next.days}</Text>
                          <Text style={s.ringUnit}>{next.days === 1 ? 'day' : 'days'}</Text>
                        </View>
                      </>
                    )}
                  </View>
                </View>
                <Animated.View style={{ transform: [{ scale: next.days === 0 ? pulse : 1 }] }}>
                  <TouchableOpacity onPress={sendWish} activeOpacity={0.9} style={s.heroCta}>
                    <Icon name="sparkles" size={16} color="#E8527A" />
                    <Text style={s.heroCtaText}>Send a wish</Text>
                  </TouchableOpacity>
                </Animated.View>
              </LinearGradient>
            ) : (
              <View style={[s.heroEmpty, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Icon name="calendar" size={30} color={colors.mutedForeground} />
                <Text style={[s.emptyTitle, { color: colors.foreground }]}>No upcoming occasions</Text>
                <TouchableOpacity onPress={openAdd} style={[s.cta, { backgroundColor: colors.primary, flexDirection: 'row', gap: 6 }]}>
                  <Icon name="plus" size={16} color="#fff" />
                  <Text style={s.ctaText}>Add an occasion</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Stats strip */}
            <View style={[s.strip, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {[
                { label: 'Upcoming', value: upcoming.length, color: colors.foreground, go: () => { const first = GROUPS.find(g => grouped[g.key].length > 0); if (first) scrollToGroup(first.key); } },
                { label: 'This week', value: weekCount, color: colors.primary, go: () => scrollToGroup(grouped.today.length ? 'today' : 'week') },
                { label: 'Auto-send', value: autoCount, color: colors.foreground, go: undefined },
              ].map((seg, i) => (
                <React.Fragment key={seg.label}>
                  {i > 0 && <View style={[s.stripDivider, { backgroundColor: colors.border }]} />}
                  <TouchableOpacity style={s.stripSeg} activeOpacity={seg.go ? 0.7 : 1} onPress={seg.go}>
                    <Text style={[s.stripNum, { color: seg.color }]}>{seg.value}</Text>
                    <Text style={[s.stripLabel, { color: colors.mutedForeground }]}>{seg.label}</Text>
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>

            {/* Grouped list */}
            {GROUPS.map(group => {
              const items = grouped[group.key];
              if (items.length === 0) return null;
              return (
                <View key={group.key} onLayout={e => { groupY.current[group.key] = e.nativeEvent.layout.y; }} style={{ gap: 12 }}>
                  <View style={s.groupHead}>
                    <Text style={[s.groupTitle, { color: colors.mutedForeground }]}>{group.title.toUpperCase()}</Text>
                    <View style={[s.countBadge, { backgroundColor: colors.border }]}>
                      <Text style={[s.countText, { color: colors.foreground }]}>{items.length}</Text>
                    </View>
                  </View>
                  {items.map(({ a, days }, idx) => {
                    const meta = typeMeta(a.occasion_type);
                    const open = expandedId === a.id;
                    const isToday = days === 0;
                    const d = effectiveDate(a);
                    const card = (
                      <View style={[s.card, { backgroundColor: colors.card, borderColor: isToday ? 'transparent' : colors.border, opacity: a.alert_enabled ? 1 : 0.6 }]}>
                        <TouchableOpacity activeOpacity={0.85} onPress={() => toggleExpand(a.id)} style={s.cardMain}>
                          <View style={[s.tile, { backgroundColor: meta.color + tint }]}>
                            <Text style={[s.tileMonth, { color: meta.color }]}>{MONTHS[d.getMonth()]}</Text>
                            <Text style={[s.tileDay, { color: meta.color }]}>{d.getDate()}</Text>
                          </View>
                          <View style={{ flex: 1, gap: 2 }}>
                            <View style={s.nameRow}>
                              <Text style={[s.name, { color: colors.foreground }]} numberOfLines={1}>{personName(a)}</Text>
                              {a.celebrity_id && <Icon name="star" size={12} color="#F5A524" />}
                            </View>
                            <Text style={[s.occ, { color: colors.mutedForeground }]} numberOfLines={1}>{a.occasion_name}</Text>
                            <View style={s.metaRow}>
                              <Icon name="clock" size={12} color={isToday ? '#EF4444' : colors.mutedForeground} />
                              <Text style={[s.meta, { color: isToday ? '#EF4444' : colors.mutedForeground }]}>{relative(days)}</Text>
                              <Text style={[s.meta, { color: colors.mutedForeground }]}>·</Text>
                              <Icon name="bell" size={12} color={a.alert_enabled ? colors.mutedForeground : colors.border} />
                              <Text style={[s.meta, { color: colors.mutedForeground }]}>{a.alert_days_before === 0 ? 'on the day' : `${a.alert_days_before}d before`} · {timeLabel(a.reminder_time)}</Text>
                            </View>
                          </View>
                          <View style={{ alignItems: 'center' }}>
                            <Switch
                              value={a.alert_enabled}
                              onValueChange={() => toggleEnabled(a)}
                              trackColor={{ false: colors.border, true: meta.color }}
                              thumbColor="#fff"
                            />
                            <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: a.alert_enabled ? meta.color : colors.mutedForeground }}>Notify me</Text>
                          </View>
                        </TouchableOpacity>

                        {isToday && !open && (
                          <TouchableOpacity onPress={sendWish} activeOpacity={0.9} style={{ marginTop: 12 }}>
                            <LinearGradient colors={['#FF6B33', '#E8527A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.wishBtn}>
                              <Icon name="sparkles" size={15} color="#fff" />
                              <Text style={s.wishBtnText}>Send a wish</Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        )}

                        {open && (
                          <View style={[s.expand, { borderTopColor: colors.border }]}>
                            <View style={s.expandHead}>
                              <Text style={[s.expandLabel, { color: colors.foreground }]}>Also remind me before</Text>
                              {saved === a.id && (
                                <View style={s.savedRow}>
                                  <Icon name="check-circle" size={14} color="#22C55E" />
                                  <Text style={{ color: '#22C55E', fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>Saved</Text>
                                </View>
                              )}
                            </View>
                            <View style={s.chipWrap}>
                              {DAYS_BEFORE.map(o => {
                                const on = a.alert_days_before === o.value;
                                return (
                                  <TouchableOpacity
                                    key={o.value}
                                    onPress={() => setDays(a, o.value)}
                                    activeOpacity={0.8}
                                    style={[s.chip, on ? { backgroundColor: meta.color, borderColor: meta.color } : { borderColor: colors.border }]}
                                  >
                                    <Text style={{ color: on ? '#fff' : colors.foreground, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>{o.label}</Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                            <Text style={[s.expandLabel, { color: colors.foreground }]}>At what time</Text>
                            <View style={s.chipWrap}>
                              {REMINDER_TIMES.map(o => {
                                const on = (a.reminder_time ?? '09:00').slice(0, 5) === o.value;
                                return (
                                  <TouchableOpacity
                                    key={o.value}
                                    onPress={() => setTime(a, o.value)}
                                    activeOpacity={0.8}
                                    style={[s.chip, on ? { backgroundColor: meta.color, borderColor: meta.color } : { borderColor: colors.border }]}
                                  >
                                    <Text style={{ color: on ? '#fff' : colors.foreground, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>{o.label}</Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                            {a.auto_send_enabled && (
                              <View style={s.autoRow}>
                                <Icon name="zap" size={13} color="#B44CFF" />
                                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Auto-send is on for this occasion</Text>
                              </View>
                            )}
                            <View style={s.actions}>
                              <TouchableOpacity onPress={sendWish} activeOpacity={0.9} style={{ flex: 1 }}>
                                <LinearGradient colors={['#FF6B33', '#E8527A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.wishBtn}>
                                  <Icon name="sparkles" size={15} color="#fff" />
                                  <Text style={s.wishBtnText}>Send a wish</Text>
                                </LinearGradient>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={openLovedOnes} style={[s.ghostBtn, { borderColor: colors.border }]}>
                                <Icon name="edit-2" size={14} color={colors.foreground} />
                                <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Edit</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </View>
                    );
                    return (
                      <FadeUp key={a.id} index={idx} enabled={!reduceMotion}>
                        {isToday ? (
                          <LinearGradient colors={['#FF6B33', '#E8527A', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 21, padding: 1.5 }}>
                            {card}
                          </LinearGradient>
                        ) : card}
                      </FadeUp>
                    );
                  })}
                </View>
              );
            })}

            {/* Past */}
            {past.length > 0 && (
              <View style={{ gap: 10 }}>
                <TouchableOpacity
                  onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setPastOpen(o => !o); }}
                  style={s.groupHead}
                  activeOpacity={0.8}
                >
                  <Icon name={pastOpen ? 'chevron-down' : 'chevron-right'} size={16} color={colors.mutedForeground} />
                  <Text style={[s.groupTitle, { color: colors.mutedForeground }]}>PAST ({past.length})</Text>
                </TouchableOpacity>
                {pastOpen && past.map(({ a, days }) => (
                  <View key={a.id} style={[s.pastRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[s.pastTile, { backgroundColor: colors.border }]}>
                      <Icon name={typeMeta(a.occasion_type).icon} size={16} color={colors.mutedForeground} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.name, { color: colors.foreground, fontSize: 14 }]} numberOfLines={1}>{personName(a)}</Text>
                      <Text style={[s.meta, { color: colors.mutedForeground }]}>{a.occasion_name} · {relative(days)}</Text>
                    </View>
                    <TouchableOpacity onPress={sendWish} hitSlop={8}>
                      <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>Belated wish</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {!!user && !!session && !loading && (
        <TouchableOpacity onPress={openAdd} activeOpacity={0.9} style={[s.fab, { bottom: insets.bottom + 20 }]} accessibilityLabel="Add occasion">
          <LinearGradient colors={['#FF6B33', '#E8527A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.fabInner}>
            <Icon name="plus" size={20} color="#fff" />
            <Text style={s.fabText}>Add occasion</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      <AddOccasionSheet
        visible={adding}
        onClose={() => setAdding(false)}
        profileId={user?.profileId ?? ''}
        token={session?.access_token ?? null}
        onSaved={() => { showToast('Occasion saved'); void fetchAlerts(); }}
      />

      {!!toast && (
        <View style={[s.toastWrap, { bottom: insets.bottom + 28 }]} pointerEvents="none">
          <View style={s.toastBox}><Text style={s.toastText}>{toast}</Text></View>
        </View>
      )}
      {refreshing && <ActivityIndicator style={{ position: 'absolute', top: topPad + 70, alignSelf: 'center' }} color={colors.primary} />}
    </View></AmbientBackground>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingBottom: 14 },
  roundBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  cta: { paddingHorizontal: 22, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  emptyWrap: { alignItems: 'center', gap: 12, paddingTop: 56 },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  gradBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, height: 50, borderRadius: 25, marginTop: 8 },
  gradBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },

  hero: { borderRadius: 24, padding: 18, minHeight: 188, gap: 14, overflow: 'hidden' },
  watermark: { position: 'absolute', right: -14, top: -10 },
  heroTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  heroChipText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  heroName: { color: '#fff', fontSize: 22, fontFamily: 'Inter_700Bold' },
  heroOcc: { color: 'rgba(255,255,255,0.92)', fontSize: 14, fontFamily: 'Inter_500Medium' },
  heroDate: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontFamily: 'Inter_400Regular' },
  ringWrap: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringNum: { color: '#fff', fontSize: 28, fontFamily: 'Inter_700Bold' },
  ringUnit: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontFamily: 'Inter_500Medium', marginTop: -3 },
  todayDisc: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  todayText: { color: '#E8527A', fontSize: 11, fontFamily: 'Inter_700Bold' },
  heroCta: { height: 46, borderRadius: 23, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  heroCtaText: { color: '#E8527A', fontSize: 15, fontFamily: 'Inter_700Bold' },
  heroEmpty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 24, padding: 22, alignItems: 'center', gap: 12 },

  strip: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, height: 64, alignItems: 'center' },
  stripSeg: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stripDivider: { width: 1, height: 30 },
  stripNum: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  stripLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },

  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.6 },
  countBadge: { minWidth: 22, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  countText: { fontSize: 11, fontFamily: 'Inter_700Bold' },

  card: { borderRadius: 20, borderWidth: 1, padding: 16 },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tileMonth: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.4 },
  tileDay: { fontSize: 22, fontFamily: 'Inter_700Bold', marginTop: -2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { fontSize: 16, fontFamily: 'Inter_600SemiBold', flexShrink: 1 },
  occ: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  meta: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  wishBtn: { height: 44, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  wishBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  expand: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, gap: 12 },
  expandHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  expandLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minWidth: 64, height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1.2, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', right: 20, borderRadius: 28, elevation: 6, shadowColor: '#E8527A', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  fabInner: { height: 56, paddingHorizontal: 20, borderRadius: 28, flexDirection: 'row', alignItems: 'center', gap: 8 },
  fabText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  autoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  ghostBtn: { height: 44, borderRadius: 22, borderWidth: 1, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 6 },

  pastRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1 },
  pastTile: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  toastWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  toastBox: { backgroundColor: 'rgba(0,0,0,0.82)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24, maxWidth: '80%' },
  toastText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center' },
});
