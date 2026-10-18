/**
 * The video splash: what plays between the native splash and the first screen.
 *
 *  - first the brand card (assets/images/splash-intro.jpg, the client's design: the WishMe logo with
 *    "Celebrate. Connect. Do Business. & MyAssistant. Handles your tasks."), on white like the native splash, so the
 *    launch runs straight into it;
 *  - after `introMs` it crossfades into the brand film (assets/videos/splash.mp4, the client's clip upscaled to
 *    1080p, denoised and sharpened), full screen, muted, once.
 *
 * When the film ends and `ready` is true, it fades out onto the app's own background (so the first screen comes in on
 * the same page, not a blank one) and calls `onDone` (exactly once). If the film fails to load
 * or stalls, the splash leaves anyway after `maxVideoMs`, so the app never hangs here.
 */

import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

const INTRO = require('@/assets/images/splash-intro.jpg');
const FILM = require('@/assets/videos/splash.mp4');

export interface VideoSplashProps {
  /** True once the app knows where to go. The splash finishes the card and the film first, then leaves. */
  ready: boolean;
  /** Called once, after the exit animation, so the caller can navigate. */
  onDone: () => void;
  /** How long the brand card shows before the film. */
  introMs?: number;
  /** Longest wait for the film to finish (load failure, stall) before leaving regardless. */
  maxVideoMs?: number;
}

export function VideoSplash({ ready, onDone, introMs = 2200, maxVideoMs = 8000 }: VideoSplashProps) {
  const [filmStarted, setFilmStarted] = useState(false);
  const [filmDone, setFilmDone] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const leaving = useRef(false);

  const intro = useSharedValue(0);
  const exit = useSharedValue(0);

  // The film loads while the card is up, so it starts on time.
  const player = useVideoPlayer(FILM, (p) => {
    p.loop = false;
    p.muted = true;
  });

  // The card settles, holds, then the film starts underneath and the card fades off it.
  useEffect(() => {
    intro.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) });
    const timer = setTimeout(() => {
      player.play();
      setFilmStarted(true);
      intro.value = withTiming(2, { duration: 450, easing: Easing.inOut(Easing.cubic) });
    }, introMs);
    return () => {
      clearTimeout(timer);
      cancelAnimation(intro);
    };
  }, [player, introMs, intro]);

  useEffect(() => {
    if (!filmStarted) return;
    const end = player.addListener('playToEnd', () => setFilmDone(true));
    const status = player.addListener('statusChange', ({ status: s }) => {
      if (s === 'error') setFilmDone(true);
    });
    const timer = setTimeout(() => setFilmDone(true), maxVideoMs);
    return () => {
      end.remove();
      status.remove();
      clearTimeout(timer);
    };
  }, [player, filmStarted, maxVideoMs]);

  useEffect(() => {
    if (!ready || !filmDone || leaving.current) return;
    leaving.current = true;
    const done = () => onDoneRef.current();
    exit.value = withTiming(1, { duration: 380, easing: Easing.in(Easing.cubic) }, (finished) => {
      'worklet';
      if (finished) runOnJS(done)();
    });
  }, [ready, filmDone, exit]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  // 0 → 1: settles in (fully opaque from the first frame, so the film's black never shows through); 1 → 2: fades
  // off the film.
  const introStyle = useAnimatedStyle(() => ({
    opacity: intro.value <= 1 ? 1 : 2 - intro.value,
    transform: [{ scale: intro.value <= 1 ? 0.96 + intro.value * 0.04 : 1 + (intro.value - 1) * 0.04 }],
  }));

  return (
    <View style={styles.base}>
      <AmbientBackground />
      <Animated.View style={[StyleSheet.absoluteFill, styles.root, rootStyle]}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          allowsPictureInPicture={false}
        />
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.introPage, introStyle]}>
          <Image
            source={INTRO}
            style={styles.introImage}
            resizeMode="contain"
            accessibilityLabel="WishMe. Celebrate. Connect. Do Business. And MyAssistant. Handles your tasks."
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { flex: 1 },
  root: { overflow: 'hidden', backgroundColor: '#FFFFFF' },
  // The card's own background is white, so it letterboxes seamlessly on any screen shape.
  introPage: { backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  introImage: { width: '100%', height: '100%' },
});
