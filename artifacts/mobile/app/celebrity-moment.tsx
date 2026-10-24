import { useEvent, useEventListener } from 'expo';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YouTubeMoment } from '@/components/celebrity/YouTubeMoment';
import { Icon } from '@/components/Icon';
import { findMoment, stockMoment, type Moment } from '@/services/celebrityMoment';

/** If the clip has not started within this long (slow network), the profile opens anyway. */
const START_TIMEOUT_MS = 10000;

type Params = { id: string; name?: string; category?: string; image?: string };

/**
 * The best-moment screen: tapping a celebrity card lands here. Their clip plays full screen with the sound on, and
 * when it ends (or Skip is tapped) the profile opens in its place, so Back from the profile returns to where the user
 * was, not to the video. An original clip that refuses to play falls back to the stock clip for the category.
 */
export default function CelebrityMomentScreen() {
  const { id, name = '', category = '', image = '' } = useLocalSearchParams<Params>();
  const insets = useSafeAreaInsets();
  const [moment, setMoment] = useState<Moment | null>(null);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const left = useRef(false);

  // Replace, not push: the profile takes this screen's place in the stack.
  const openProfile = useCallback(() => {
    if (left.current) return;
    left.current = true;
    router.replace({ pathname: '/celebrity/[id]', params: { id } });
  }, [id]);

  useEffect(() => {
    let alive = true;
    if (!id) { openProfile(); return; }
    void findMoment({ id, name, category }).then((m) => { if (alive) setMoment(m); });
    return () => { alive = false; };
  }, [id, name, category, openProfile]);

  // The original clip would not play (owner blocks apps, no network): show the stock clip once, then give up.
  const fallback = useCallback(() => {
    setMoment((m) => {
      if (!m || m.kind === 'video') { openProfile(); return m; }
      setReady(false);
      setProgress(0);
      return stockMoment(category);
    });
  }, [category, openProfile]);

  // A clip that cannot start is not worth waiting for.
  useEffect(() => {
    if (ready || !moment) return;
    const t = setTimeout(fallback, START_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [ready, moment, fallback]);

  const onReady = useCallback(() => setReady(true), []);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {/* The photo sits under the video, so the screen is never black while the clip loads. */}
      {!!image && <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={18} />}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />

      {moment?.kind === 'video' && (
        <Clip key={moment.url} url={moment.url} onReady={onReady} onProgress={setProgress} onDone={openProfile} onError={fallback} />
      )}
      {moment?.kind === 'youtube' && (
        <YouTubeMoment
          key={moment.videoId}
          videoId={moment.videoId}
          start={moment.start}
          end={moment.end}
          onReady={onReady}
          onProgress={setProgress}
          onEnded={openProfile}
          onError={fallback}
        />
      )}

      {!ready && (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      <LinearGradient colors={['rgba(0,0,0,0.55)', 'transparent']} style={[styles.topShade, { height: insets.top + 90 }]} pointerEvents="none" />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={[styles.bottomShade, { height: insets.bottom + 200 }]} pointerEvents="none" />

      <Pressable
        onPress={openProfile}
        accessibilityRole="button"
        accessibilityLabel="Skip the video and open the profile"
        hitSlop={10}
        style={({ pressed }) => [styles.skip, { top: insets.top + 14, opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={styles.skipText}>Skip</Text>
        <Icon name="chevron-right" size={16} color="#fff" />
      </Pressable>

      <View style={[styles.caption, { bottom: insets.bottom + 28 }]} pointerEvents="none">
        <Text style={styles.overline}>Best moment</Text>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        {!!moment?.caption && <Text style={styles.sub} numberOfLines={1}>{moment.caption}</Text>}
      </View>
      <View style={[styles.track, { bottom: insets.bottom + 14 }]} pointerEvents="none">
        <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
    </View>
  );
}

interface ClipProps {
  url: string;
  onReady: () => void;
  onProgress: (fraction: number) => void;
  onDone: () => void;
  onError: () => void;
}

/** A plain video file (the celebrity's upload or a stock clip) through expo-video. */
function Clip({ url, onReady, onProgress, onDone, onError }: ClipProps) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.muted = false;
    p.timeUpdateEventInterval = 0.2;
    p.play();
  });
  const { status, error } = useEvent(player, 'statusChange', { status: player.status, error: undefined });
  const time = useEvent(player, 'timeUpdate', { currentTime: 0, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0 });
  useEventListener(player, 'playToEnd', onDone);

  const ready = status === 'readyToPlay';
  useEffect(() => { if (ready) { player.play(); onReady(); } }, [ready, player, onReady]);
  useEffect(() => { if (status === 'error' || error) onError(); }, [status, error, onError]);
  useEffect(() => {
    if (player.duration > 0) onProgress(Math.min(1, time.currentTime / player.duration));
  }, [time.currentTime, player, onProgress]);

  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} allowsFullscreen={false} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  topShade: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottomShade: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  skip: {
    position: 'absolute', right: 16, flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingLeft: 16, paddingRight: 10, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
  },
  skipText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  caption: { position: 'absolute', left: 20, right: 20 },
  overline: { color: 'rgba(255,255,255,0.75)', fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  name: { color: '#fff', fontSize: 28, fontFamily: 'Inter_700Bold' },
  sub: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 2 },
  track: { position: 'absolute', left: 20, right: 20, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#fff' },
});
