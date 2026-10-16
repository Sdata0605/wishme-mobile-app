import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthButton, AuthMark } from '@/components/auth/AuthUI';
import { Icon } from '@/components/Icon';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { Reveal } from '@/components/neon/Motion';
import { withAlpha } from '@/constants/neon';
import { useTheme } from '@/context/ThemeContext';

const STORAGE_ONBOARDING = '@wishme/onboarding_seen';

const { height: H } = Dimensions.get('window');

const SLIDES = [
  {
    key: '1',
    title: 'Wish a Friend',
    desc: 'Send personalized video wishes to your loved ones from their favorite stars',
    image: require('@/assets/images/splash1.jpeg'),
  },
  {
    key: '2',
    title: 'Wish a Celebrity',
    desc: 'Get personalized video messages from your favorite celebrities',
    image: require('@/assets/images/splash2.jpeg'),
  },
  {
    key: '3',
    title: 'Make Promotion Ads',
    desc: 'Create professional promotion videos with celebrity endorsements',
    image: require('@/assets/images/splash3.jpeg'),
  },
  {
    key: '4',
    title: 'UGC Videos',
    desc: 'User-generated content videos with celebrity collaborations',
    image: require('@/assets/images/splash4.jpeg'),
  },
];

/** A page dot: 8px, stretching to 22px for the live one, which carries the brand gradient. */
function Dot({ active }: { active: boolean }) {
  const { neon, isDark } = useTheme();
  const w = useSharedValue(active ? 22 : 8);
  useEffect(() => {
    w.value = withTiming(active ? 22 : 8, { duration: 250 });
  }, [active, w]);
  const style = useAnimatedStyle(() => ({ width: w.value }));
  return (
    <Reanimated.View style={[styles.dot, { backgroundColor: active ? neon.violet : withAlpha(neon.textHi, 0.25) }, style]}>
      {active && isDark ? (
        <LinearGradient
          colors={neon.gBrand as unknown as [string, string]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </Reanimated.View>
  );
}

function SlideScreen({
  slide,
  index,
  total,
  onNext,
  onSkip,
}: {
  slide: (typeof SLIDES)[0];
  index: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  const { neon } = useTheme();
  const insets = useSafeAreaInsets();
  const last = index === total - 1;

  return (
    <View style={StyleSheet.absoluteFill}>
      <AmbientBackground />

      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <View style={styles.brandRow}>
          <AuthMark size={32} />
          <Text style={[styles.brandName, { color: neon.textHi }]}>WishMe</Text>
        </View>
        <Pressable onPress={onSkip} hitSlop={10} accessibilityRole="button" accessibilityLabel="Skip the introduction">
          <Text style={[styles.skipLink, { color: neon.textLo }]}>Skip</Text>
        </Pressable>
      </View>

      <View style={styles.pageBody}>
        <Reveal key={slide.key}>
          <View style={[styles.photoCard, { borderColor: neon.cardBorder }]}>
            <Image source={slide.image} style={styles.photo} resizeMode="cover" />
            <LinearGradient
              pointerEvents="none"
              colors={[withAlpha(neon.bg, 0), withAlpha(neon.bg, 0.7)]}
              style={styles.photoFade}
            />
            <View style={[styles.counter, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}>
              <Text style={[styles.counterText, { color: neon.textHi }]}>{`0${index + 1} / 0${total}`}</Text>
            </View>
          </View>
        </Reveal>
        <Reveal key={`t${slide.key}`} delayMs={60}>
          <Text style={[styles.slideTitle, { color: neon.textHi }]} maxFontSizeMultiplier={1.3}>{slide.title}</Text>
        </Reveal>
        <Reveal key={`d${slide.key}`} delayMs={120}>
          <Text style={[styles.slideDesc, { color: neon.textLo }]}>{slide.desc}</Text>
        </Reveal>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.dots} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: total, now: index + 1 }}>
          {Array.from({ length: total }).map((_, i) => <Dot key={i} active={i === index} />)}
        </View>
        <AuthButton
          label={last ? 'Get started' : 'Next'}
          icon="arrow-right"
          iconAfter
          onPress={onNext}
          style={{ marginTop: 22 }}
        />
      </View>
    </View>
  );
}

/**
 * First-run onboarding: four slides, then the permissions screen. The brand intro that used to play here as a video
 * is now the logo reveal at the end of the animated splash (components/splash/AnimatedSplash.tsx), which runs just
 * before this screen.
 */
export default function OnboardingScreen() {
  const [current, setCurrent] = useState(0);

  // The permissions screen explains itself and hands over to sign-in, so it sits between the
  // slides and (auth) rather than interrupting the user once they are already signing in.
  const finish = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_ONBOARDING, '1');
    } catch {}
    router.replace({ pathname: '/permissions' as never, params: { next: 'auth' } });
  };

  const next = () => {
    if (current < SLIDES.length - 1) {
      setCurrent((c) => c + 1);
    } else {
      finish();
    }
  };

  return (
    <View style={styles.container}>
      <SlideScreen
        slide={SLIDES[current]}
        index={current}
        total={SLIDES.length}
        onNext={next}
        onSkip={finish}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandName: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  skipLink: { fontSize: 14, fontFamily: 'Inter_600SemiBold', paddingVertical: 6 },
  pageBody: { flex: 1, paddingHorizontal: 20, justifyContent: 'center' },
  photoCard: { height: H * 0.34, borderRadius: 28, borderWidth: 1.5, overflow: 'hidden', marginBottom: 28 },
  photo: { width: '100%', height: '100%' },
  photoFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' },
  counter: { position: 'absolute', top: 14, left: 14, borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  counterText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.4 },
  slideTitle: { fontSize: 30, lineHeight: 36, fontFamily: 'PlayfairDisplay_700Bold', letterSpacing: -0.5, textAlign: 'center' },
  slideDesc: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 12, maxWidth: 320, alignSelf: 'center' },
  bottom: { paddingHorizontal: 20, paddingTop: 8 },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  dot: { height: 8, borderRadius: 4, overflow: 'hidden' },
});
