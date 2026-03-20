import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: W, height: H } = Dimensions.get('window');

const INTRO_VIDEO = require('@/assets/videos/intro.mp4');

const SLIDES = [
  {
    key: '1',
    title: 'Wish a Friend',
    desc: 'Send personalized video wishes to your loved ones from their favorite stars',
    image: require('@/assets/images/splash1.jpeg'),
    gradient: ['transparent', 'rgba(255,107,51,0.9)'] as const,
  },
  {
    key: '2',
    title: 'Wish a Celebrity',
    desc: 'Get personalized video messages from your favorite celebrities',
    image: require('@/assets/images/splash2.jpeg'),
    gradient: ['transparent', 'rgba(180,76,255,0.9)'] as const,
  },
  {
    key: '3',
    title: 'Make Promotion Ads',
    desc: 'Create professional promotion videos with celebrity endorsements',
    image: require('@/assets/images/splash3.jpeg'),
    gradient: ['transparent', 'rgba(232,82,122,0.9)'] as const,
  },
  {
    key: '4',
    title: 'UGC Videos',
    desc: 'User-generated content videos with celebrity collaborations',
    image: require('@/assets/images/splash4.jpeg'),
    gradient: ['transparent', 'rgba(75,0,130,0.95)'] as const,
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

  const player = useVideoPlayer(INTRO_VIDEO, (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });

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

function SlideScreen({
  slide,
  index,
  total,
  active,
  onNext,
  onSkip,
}: {
  slide: (typeof SLIDES)[0];
  index: number;
  total: number;
  active: boolean;
  onNext: () => void;
  onSkip: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const imageScale = useRef(new Animated.Value(0.95)).current;
  const contentY = useRef(new Animated.Value(32)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const btnOpacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (active) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(imageScale, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(300),
          Animated.parallel([
            Animated.timing(contentOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
            Animated.timing(contentY, { toValue: 0, duration: 700, useNativeDriver: true }),
          ]),
        ]),
        Animated.sequence([
          Animated.delay(700),
          Animated.timing(btnOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
      ]).start();
    } else {
      opacity.setValue(0);
      imageScale.setValue(0.95);
      contentY.setValue(32);
      contentOpacity.setValue(0);
      btnOpacity.setValue(0);
    }
  }, [active]);

  return (
    <Animated.View
      pointerEvents={active ? 'auto' : 'none'}
      style={[styles.slide, { opacity }]}
    >
      <Animated.View
        style={[
          { position: 'absolute', top: 0, left: 0, right: 0, height: H, backgroundColor: '#000' },
          { transform: [{ scale: imageScale }] },
        ]}
      >
        <Image
          source={slide.image}
          style={{ position: 'absolute', top: 0, left: 0, width: W, height: H }}
          resizeMode="cover"
        />
      </Animated.View>
      <LinearGradient
        colors={slide.gradient as unknown as [string, string]}
        locations={[0.3, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <View style={styles.logoPill}>
          <Text style={styles.logoText}>WishMe</Text>
        </View>
        <View style={styles.topRight}>
          <View style={styles.progressPill}>
            <Text style={styles.progressText}>{index + 1}/{total}</Text>
          </View>
          <Pressable onPress={onSkip} style={({ pressed }) => [styles.skipPill, { opacity: pressed ? 0.7 : 1 }]}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>
      </View>

      {/* Content */}
      <Animated.View
        style={[
          styles.slideContent,
          { paddingBottom: insets.bottom + 32, opacity: contentOpacity, transform: [{ translateY: contentY }] },
        ]}
      >
        <Text style={styles.slideTitle}>{slide.title}</Text>
        <Text style={styles.slideDesc}>{slide.desc}</Text>
        <Animated.View style={{ opacity: btnOpacity, marginTop: 32 }}>
          <Pressable onPress={onNext} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
            <LinearGradient
              colors={['#FF6B33', '#B44CFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.continueBtn}
            >
              <Text style={styles.continueBtnText}>
                {index === total - 1 ? 'Get Started' : 'Continue'}
              </Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {/* Dots */}
        <View style={styles.dots}>
          {Array.from({ length: total }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

export default function OnboardingScreen() {
  const [phase, setPhase] = useState<'video' | 'slides'>('video');
  const [current, setCurrent] = useState(0);

  const finish = async () => {
    await AsyncStorage.setItem('onboarded', 'true');
    router.replace('/(auth)');
  };

  const next = () => {
    if (current < SLIDES.length - 1) {
      setCurrent((c) => c + 1);
    } else {
      finish();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      {phase === 'video' ? (
        <VideoIntroScreen onDone={() => setPhase('slides')} />
      ) : (
        SLIDES.map((slide, index) => (
          <SlideScreen
            key={slide.key}
            slide={slide}
            index={index}
            total={SLIDES.length}
            active={index === current}
            onNext={next}
            onSkip={finish}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  slide: {
    ...StyleSheet.absoluteFillObject,
    flex: 1,
    justifyContent: 'flex-end',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  logoPill: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  logoText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressPill: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  progressText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_500Medium' },
  skipPill: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  videoSkip: {
    position: 'absolute',
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  skipText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_500Medium' },
  slideContent: {
    paddingHorizontal: 28,
  },
  slideTitle: {
    color: '#fff',
    fontSize: 36,
    fontFamily: 'PlayfairDisplay_700Bold',
    marginBottom: 12,
    lineHeight: 44,
  },
  slideDesc: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 17,
    fontFamily: 'Inter_500Medium',
    lineHeight: 26,
  },
  continueBtn: {
    height: 52,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnText: {
    color: '#fff',
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 20,
    alignSelf: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    backgroundColor: '#FF6B33',
    width: 18,
  },
});
