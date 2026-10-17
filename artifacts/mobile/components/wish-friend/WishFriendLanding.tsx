import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';

export type LandingChoice = 'greeting_card' | 'ugc_video' | 'video_wish';

interface Props {
  onPick: (choice: LandingChoice) => void;
  onOpenOrders: () => void;
}

type Chip = { icon: IconName; label: string };

const STEPS: { icon: IconName; label: string }[] = [
  { icon: 'heart', label: 'Pick a style' },
  { icon: 'mail', label: 'Add details' },
  { icon: 'check-circle', label: 'We deliver' },
];

/** Card that fades/rises in, and springs down a little while pressed. */
function PressCard({
  onPress, delay, style, children, accessibilityLabel,
}: {
  onPress: () => void; delay: number; style?: object; children: React.ReactNode; accessibilityLabel: string;
}) {
  const enter = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter, delay]);

  return (
    <Animated.View
      style={[
        style,
        { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }, { scale: press }] },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        onPressIn={() => Animated.spring(press, { toValue: 0.97, speed: 40, bounciness: 0, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(press, { toValue: 1, speed: 30, bounciness: 6, useNativeDriver: true }).start()}
        style={s.fill}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function Chips({ chips }: { chips: Chip[] }) {
  return (
    <View style={s.chips}>
      {chips.map(c => (
        <View key={c.label} style={s.chip}>
          <Icon name={c.icon} size={11} color="#fff" />
          <Text style={s.chipText} numberOfLines={1}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
}

function Hero({ dim }: { dim: boolean }) {
  const enter = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const loop = (v: Animated.Value, ms: number) =>
      Animated.loop(Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]));
    const a = loop(bob, 1800);
    const b = loop(drift, 2600);
    a.start();
    b.start();
    return () => { a.stop(); b.stop(); };
  }, [enter, bob, drift]);

  const deco = dim ? 0.08 : 0.1;
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const driftA = drift.interpolate({ inputRange: [0, 1], outputRange: [-4, 4] });
  const driftB = drift.interpolate({ inputRange: [0, 1], outputRange: [4, -4] });

  return (
    <LinearGradient colors={['#FF6B33', '#E8527A', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
      <View style={[s.circle, { width: 160, height: 160, top: -40, right: -50, opacity: deco }]} />
      <View style={[s.circle, { width: 90, height: 90, bottom: -30, left: -20, opacity: deco }]} />
      <View style={[s.circle, { width: 14, height: 14, top: 34, right: 90, opacity: 0.3 }]} />

      <Animated.View
        style={{
          opacity: enter,
          transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        }}
      >
        <View style={s.emojiRow}>
          <Animated.View style={[s.glass, { transform: [{ translateY: bobY }] }]}>
            <Text style={s.heroEmoji}>🎁</Text>
          </Animated.View>
          <Animated.Text style={[s.floatEmoji, { transform: [{ rotate: '-12deg' }, { translateY: driftA }] }]}>🎉</Animated.Text>
          <Animated.Text style={[s.floatEmoji, { transform: [{ rotate: '12deg' }, { translateY: driftB }] }]}>💌</Animated.Text>
        </View>
        <Text style={s.eyebrow}>WISH A FRIEND</Text>
        <Text style={s.heroTitle}>Make your friend's day unforgettable</Text>
        <Text style={s.heroSub} numberOfLines={2}>A card or a video wish, made with love. Pick a style and we do the rest.</Text>
      </Animated.View>
    </LinearGradient>
  );
}

export function WishFriendLanding({ onPick, onOpenOrders }: Props) {
  const { colors, isDark } = useTheme();
  const glow = isDark ? 0.2 : 0.35;

  const cardChips: Chip[] = [{ icon: 'zap', label: 'Instant' }, { icon: 'sparkles', label: 'AI-designed' }];
  const ugcChips: Chip[] = [
    { icon: 'users', label: 'Team-made' },
    { icon: 'layers', label: '9:16 · 1:1 · 16:9' },
  ];
  const videoChips: Chip[] = [{ icon: 'star', label: 'Celebrity' }, { icon: 'clock', label: 'Delivered to Bookings' }];

  const shadow = (color: string) => ({
    shadowColor: color, shadowOpacity: glow, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  });

  return (
    <View>
      <Hero dim={isDark} />

      <View style={s.body}>
        <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>PICK A STYLE</Text>

        {/* Featured: Video Wish */}
        <PressCard
          delay={0}
          onPress={() => onPick('video_wish')}
          accessibilityLabel="Video Wish. Pick a celebrity"
          style={[s.featured, { backgroundColor: '#3B5BDB' }, shadow('#3B5BDB')]}
        >
          <LinearGradient colors={['#3B5BDB', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.featuredInner}>
            <View style={s.watermark} pointerEvents="none">
              <Icon name="play-circle" size={120} color="rgba(255,255,255,0.15)" />
            </View>
            <View style={s.featuredPill}><Text style={s.featuredPillText}>Celebrity special</Text></View>
            <Text style={s.featuredTitle}>Video Wish</Text>
            <Text style={s.featuredDesc}>A personalised video message from a celebrity your friend loves.</Text>
            <Chips chips={videoChips} />
            <View style={s.featuredCta}>
              <Text style={s.featuredCtaText}>Pick a celebrity</Text>
              <Icon name="arrow-right" size={14} color="#7C3AED" />
            </View>
          </LinearGradient>
        </PressCard>

        {/* Greeting Card + UGC Video */}
        <View style={s.tileRow}>
          <PressCard
            delay={80}
            onPress={() => onPick('greeting_card')}
            accessibilityLabel="Greeting Card. Create a card"
            style={[s.tile, { backgroundColor: '#EC4899' }, shadow('#EC4899')]}
          >
            <LinearGradient colors={['#EC4899', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tileInner}>
              <View style={s.tileIcon}><Icon name="gift" size={20} color="#fff" /></View>
              <Text style={s.tileTitle}>Greeting Card</Text>
              <Text style={s.tileDesc} numberOfLines={2}>An AI-designed card, ready in seconds.</Text>
              <Chips chips={cardChips} />
              <View style={s.tileArrow}><Icon name="chevron-right" size={14} color="#fff" /></View>
            </LinearGradient>
          </PressCard>

          <PressCard
            delay={160}
            onPress={() => onPick('ugc_video')}
            accessibilityLabel="UGC Video. Request a video"
            style={[s.tile, { backgroundColor: '#FF6B33' }, shadow('#FF6B33')]}
          >
            <LinearGradient colors={['#FF6B33', '#E8527A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tileInner}>
              <View style={s.tileIcon}><Icon name="video" size={20} color="#fff" /></View>
              <Text style={s.tileTitle}>UGC Video</Text>
              <Text style={s.tileDesc} numberOfLines={2}>A creator-style video for your friend.</Text>
              <Chips chips={ugcChips} />
              <View style={s.tileArrow}><Icon name="chevron-right" size={14} color="#fff" /></View>
            </LinearGradient>
          </PressCard>
        </View>

        {/* How it works */}
        <View style={[s.how, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[s.howLine, { borderColor: colors.border }]} />
          {STEPS.map(step => (
            <View key={step.label} style={s.howCol}>
              <View style={[s.howCircle, { backgroundColor: colors.card }]}>
                <View style={[s.howCircleInner, { backgroundColor: colors.primary + '22' }]}>
                  <Icon name={step.icon} size={15} color={colors.primary} />
                </View>
              </View>
              <Text style={[s.howLabel, { color: colors.foreground }]} numberOfLines={2}>{step.label}</Text>
            </View>
          ))}
        </View>

        {/* Orders */}
        <Pressable
          onPress={onOpenOrders}
          accessibilityRole="button"
          style={({ pressed }) => [s.orders, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
        >
          <View style={[s.ordersBadge, { backgroundColor: colors.primary + '22' }]}>
            <Icon name="shopping-bag" size={17} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.ordersTitle, { color: colors.foreground }]}>My Wish a Friend orders</Text>
            <Text style={[s.ordersSub, { color: colors.mutedForeground }]}>Track delivery status</Text>
          </View>
          <Icon name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  hero: { minHeight: 210, paddingHorizontal: 22, paddingTop: 22, paddingBottom: 28, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden', justifyContent: 'flex-end' },
  circle: { position: 'absolute', borderRadius: 999, backgroundColor: '#fff' },
  emojiRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  glass: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  heroEmoji: { fontSize: 28 },
  floatEmoji: { fontSize: 20 },
  eyebrow: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.2 },
  heroTitle: { color: '#fff', fontSize: 28, lineHeight: 34, fontFamily: 'Inter_700Bold', marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular', marginTop: 8 },

  body: { paddingHorizontal: 16, paddingTop: 20, gap: 20 },
  sectionLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  chipText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_500Medium' },

  featured: { borderRadius: 24, marginTop: -8 },
  featuredInner: { minHeight: 190, borderRadius: 24, padding: 18, gap: 8, overflow: 'hidden' },
  watermark: { position: 'absolute', right: -24, top: 28 },
  featuredPill: { alignSelf: 'flex-start', backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  featuredPillText: { color: '#7C3AED', fontSize: 11, fontFamily: 'Inter_700Bold' },
  featuredTitle: { color: '#fff', fontSize: 22, fontFamily: 'Inter_700Bold', marginTop: 2 },
  featuredDesc: { color: 'rgba(255,255,255,0.92)', fontSize: 13, lineHeight: 18, fontFamily: 'Inter_400Regular', maxWidth: '82%' },
  featuredCta: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', height: 36, paddingHorizontal: 16, borderRadius: 18, backgroundColor: '#fff', marginTop: 4 },
  featuredCtaText: { color: '#7C3AED', fontSize: 13, fontFamily: 'Inter_700Bold' },

  tileRow: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, borderRadius: 20 },
  tileInner: { minHeight: 190, borderRadius: 20, padding: 14, gap: 6, overflow: 'hidden' },
  tileIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  tileTitle: { color: '#fff', fontSize: 17, fontFamily: 'Inter_700Bold' },
  tileDesc: { color: 'rgba(255,255,255,0.92)', fontSize: 12, lineHeight: 16, fontFamily: 'Inter_400Regular' },
  tileArrow: { position: 'absolute', right: 12, bottom: 12, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },

  how: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 8 },
  howLine: { position: 'absolute', left: '18%', right: '18%', top: 30, borderTopWidth: 1, borderStyle: 'dashed' },
  howCol: { flex: 1, alignItems: 'center', gap: 8 },
  howCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  howCircleInner: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  howLabel: { fontSize: 11, lineHeight: 14, fontFamily: 'Inter_500Medium', textAlign: 'center' },

  orders: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  ordersBadge: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ordersTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  ordersSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
});
