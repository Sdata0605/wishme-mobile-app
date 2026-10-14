import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { Reveal } from '@/components/neon/Motion';
import { withAlpha } from '@/constants/neon';
import { useTheme } from '@/context/ThemeContext';

const STORAGE_ONBOARDING = '@wishme/onboarding_seen';

const { height: H } = Dimensions.get('window');

const INTRO_VIDEO = require('@/assets/videos/intro.mp4');

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

function VideoIntroScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const doneCalledRef = useRef(false);

  const done = useCallback(() => {
    if (doneCalledRef.current) return;
    doneCalledRef.current = true;
    onDone();
  }, [onDone]);

  const player = useVideoPlayer(INTRO_VIDEO);

  useEffect(() => {
    player.loop = false;
    player.play();
  }, [player]);

  useEffect(() => {
    const sub = player.addListener('playToEnd', () => {
      done();
    });
    return () => sub.remove();
  }, [player, done]);

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        nativeControls={false}
      />
      <Pressable
        onPress={done}
        style={[styles.videoSkip, { top: insets.top + 12 }]}
      >
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>
    </View>
  );
}

/** A page dot: 7px, stretching to 22px for the live one (MyAssistant's guide). */
function Dot({ active }: { active: boolean }) {
  const { neon } = useTheme();
  const w = useSharedValue(active ? 22 : 7);
  useEffect(() => {
    w.value = withTiming(active ? 22 : 7, { duration: 220 });
  }, [active, w]);
  const style = useAnimatedStyle(() => ({ width: w.value }));
  return <Reanimated.View style={[styles.dot, { backgroundColor: active ? neon.violet : withAlpha(neon.violet, 0.18) }, style]} />;
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
    <View style={[StyleSheet.absoluteFill, { backgroundColor: neon.bg }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={onSkip} hitSlop={10} accessibilityRole="button" accessibilityLabel="Skip the introduction">
          <Text style={[styles.skipLink, { color: neon.textLo }]}>Skip</Text>
        </Pressable>
      </View>

      <View style={styles.pageBody}>
        <Reveal key={slide.key}>
          <View style={[styles.photoCard, { borderColor: neon.line }]}>
            <Image source={slide.image} style={styles.photo} resizeMode="cover" />
          </View>
        </Reveal>
        <Reveal key={`t${slide.key}`} delayMs={60}>
          <Text style={[styles.slideTitle, { color: neon.textHi }]} maxFontSizeMultiplier={1.3}>{slide.title}</Text>
        </Reveal>
        <Reveal key={`d${slide.key}`} delayMs={120}>
          <Text style={[styles.slideDesc, { color: neon.textLo }]}>{slide.desc}</Text>
        </Reveal>
      </View>

      <View style={[styles.bottomRow, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.dots} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: total, now: index + 1 }}>
          {Array.from({ length: total }).map((_, i) => <Dot key={i} active={i === index} />)}
        </View>
        <Pressable
          onPress={onNext}
          accessibilityRole="button"
          accessibilityLabel={last ? 'Get started' : 'Next slide'}
          style={({ pressed }) => [styles.nextBtn, { backgroundColor: neon.violet, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.nextText}>{last ? 'Get started' : 'Next'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const { neon } = useTheme();
  const [phase, setPhase] = useState<'video' | 'slides'>('video');
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
    <View style={[styles.container, { backgroundColor: phase === 'video' ? '#000' : neon.bg }]}>
      {phase === 'video' ? (
        <VideoIntroScreen onDone={() => setPhase('slides')} />
      ) : (
        <SlideScreen
          slide={SLIDES[current]}
          index={current}
          total={SLIDES.length}
          onNext={next}
          onSkip={finish}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 24 },
  skipLink: { fontSize: 14, fontFamily: 'Inter_600SemiBold', paddingVertical: 6 },
  pageBody: { flex: 1, paddingHorizontal: 32, justifyContent: 'center' },
  photoCard: { height: H * 0.34, borderRadius: 24, borderWidth: 1, overflow: 'hidden', marginBottom: 26 },
  photo: { width: '100%', height: '100%' },
  slideTitle: { fontSize: 26, fontFamily: 'PlayfairDisplay_700Bold', letterSpacing: -0.5, lineHeight: 30 },
  slideDesc: { fontSize: 15.5, fontFamily: 'Inter_400Regular', lineHeight: 24, marginTop: 12 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 8 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { height: 7, borderRadius: 4 },
  nextBtn: { borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14 },
  nextText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  videoSkip: {
    position: 'absolute',
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  skipText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_500Medium' },
});
