/**
 * The launch splash: the client's brand clip (assets/videos/splash.mp4), played full screen between the native
 * splash image and the first screen. It stands in for the old onboarding intro video, so the brand moment happens
 * once, here.
 *
 * The clip: a holographic portal and a neon heart rising out of its beam, a flash, and the WishMe logo on a white
 * card. The client only had a WhatsApp-compressed copy (464x832), so the file here is that clip upscaled 4x with
 * Real-ESRGAN (realesr-animevideov3) and re-encoded at 1080x1936; its first 0.57 s, which showed the generator's
 * misspelt "Wishshe me", were cut. The tagline is laid over the final card shot, and the last frame holds for a moment
 * so it can be read.
 *
 * Once the clip has finished (or failed, or stalled past a safety limit) and `ready` is true, the splash fades out
 * over the app background and calls `onDone` (exactly once) so the caller can navigate.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { withAlpha } from '@/constants/neon';

const CLIP = require('@/assets/videos/splash.mp4');
/** The clip's own size, used to place the tagline on the frame however the screen crops it. */
const CLIP_W = 1080;
const CLIP_H = 1936;
/** When the logo card has settled, in clip seconds: the tagline fades in here. */
const TAGLINE_AT = 3.95;
/** Where the tagline sits on the frame, in clip pixels: on the plain grey below the card and the envelope. */
const TAGLINE_Y = 1715;
/** How long the last frame holds after the clip ends, so the tagline can be read. */
const HOLD_MS = 900;
/** If the clip has not finished by then (a decoder stall, say), leave anyway. */
const SAFETY_MS = 9000;
const EXIT_MS = 450;

const TAGLINE = 'All business in one app';
/** The clip's first frames are this near-black navy, so nothing flashes before the first frame is drawn. */
const STAGE = '#050A14';

export interface AnimatedSplashProps {
  /** True once the app knows where to go. The splash finishes the clip first, then leaves. */
  ready: boolean;
  /** Called once, after the exit animation, so the caller can navigate. */
  onDone: () => void;
  /** Ignored; the clip sets the length. Kept so callers need not change. */
  minDurationMs?: number;
}

export function AnimatedSplash({ ready, onDone }: AnimatedSplashProps) {
  const { width: w, height: h } = useWindowDimensions();
  const [finished, setFinished] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const leaving = useRef(false);

  const shown = useSharedValue(0);
  const tagline = useSharedValue(0);
  const exit = useSharedValue(0);

  const player = useVideoPlayer(CLIP, (p) => {
    p.muted = true;
    p.loop = false;
    p.timeUpdateEventInterval = 0.1;
  });

  useEffect(() => {
    let started = false;
    let visible = false;
    let taglineShown = false;
    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (holdTimer) return;
      holdTimer = setTimeout(() => setFinished(true), HOLD_MS);
    };
    const showTagline = () => {
      if (taglineShown) return;
      taglineShown = true;
      tagline.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    };

    const start = () => {
      if (started) return;
      started = true;
      player.play();
    };
    const subs = [
      player.addListener('statusChange', ({ status }) => {
        if (status === 'readyToPlay') start();
        if (status === 'error') finish();
      }),
      // The view stays hidden until frames are actually moving, so the player's blank surface never shows.
      player.addListener('timeUpdate', ({ currentTime }) => {
        if (!visible && currentTime > 0) {
          visible = true;
          shown.value = 1;
        }
        if (currentTime >= TAGLINE_AT) showTagline();
      }),
      player.addListener('playToEnd', () => {
        showTagline();
        finish();
      }),
    ];
    if (player.status === 'readyToPlay') start();
    const safety = setTimeout(() => setFinished(true), SAFETY_MS);

    return () => {
      subs.forEach((s) => s.remove());
      clearTimeout(safety);
      if (holdTimer) clearTimeout(holdTimer);
    };
  }, [player, shown, tagline]);

  useEffect(() => {
    if (!ready || !finished || leaving.current) return;
    leaving.current = true;
    const done = () => onDoneRef.current();
    exit.value = withTiming(1, { duration: EXIT_MS, easing: Easing.in(Easing.cubic) }, (ok) => {
      'worklet';
      if (ok) runOnJS(done)();
    });
  }, [ready, finished, exit]);

  // The clip fills the screen like `cover`: scaled until both sides are covered, centred, the overflow cropped.
  const scale = Math.max(w / CLIP_W, h / CLIP_H);
  const taglineTop = (h - CLIP_H * scale) / 2 + TAGLINE_Y * scale;

  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  const videoStyle = useAnimatedStyle(() => ({ opacity: shown.value }));
  const taglineStyle = useAnimatedStyle(() => ({
    opacity: tagline.value,
    transform: [{ translateY: (1 - tagline.value) * 12 }],
  }));
  const lineStyle = useAnimatedStyle(() => ({ opacity: tagline.value, transform: [{ scaleX: tagline.value }] }));

  // The app background sits underneath, so when the clip fades out the next screen (on the same background)
  // takes over without a flash of another colour.
  return (
    <View style={styles.root}>
      <AmbientBackground />
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: STAGE }, rootStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, videoStyle]}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
            // A texture view fades with its parent; a surface view would ignore the opacity.
            surfaceType="textureView"
            allowsPictureInPicture={false}
          />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.taglineBox, { top: taglineTop }, taglineStyle]}>
          <Animated.Text style={styles.tagline} maxFontSizeMultiplier={1.2}>
            {TAGLINE}
          </Animated.Text>
          <Animated.View style={[styles.underline, lineStyle]}>
            <LinearGradient
              colors={[withAlpha('#1FA2E6', 0), '#1FA2E6', '#E56BC9', withAlpha('#E56BC9', 0)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  taglineBox: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  // The navy of the card's wordmark, so it reads on the clip's pale grey last shot.
  tagline: { color: '#1C2A6B', fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: 0.3, textAlign: 'center' },
  underline: { width: 170, height: 2.5, borderRadius: 1.25, marginTop: 8, overflow: 'hidden', transformOrigin: 'center' },
});
