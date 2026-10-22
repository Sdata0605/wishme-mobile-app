import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { WaveformBar } from '@/components/music/AudioPlayer';
import { PressScale } from '@/components/neon/Motion';
import { useTheme } from '@/context/ThemeContext';
import { fmtMs, radio, useRadio, type Playlist } from '@/services/home/radio';

const PLAYLISTS: { id: Playlist; label: string }[] = [
  { id: 'open', label: 'Free & open' },
  { id: 'ai', label: 'AI made' },
];

/**
 * The music player at the bottom of Home: a playlist switch (free & open, AI made), the track with its credit and
 * licence, a progress line and the controls. The sound itself lives in services/home/radio so it keeps playing when
 * this card scrolls away or the user opens another tab.
 */
export function MusicPlayerCard() {
  const { neon } = useTheme();
  const st = useRadio();
  const track = st.tracks[st.index];
  const playing = st.status === 'playing';
  const loading = st.status === 'loading';
  const progress = st.durationMs > 0 ? Math.min(1, st.positionMs / st.durationMs) : 0;

  useEffect(() => { void radio.preload(); }, []);

  return (
    <View style={[styles.card, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}>
      <View style={styles.head}>
        <View style={styles.headLeft}>
          <Icon name="music" size={18} color={neon.pink} />
          <Text style={[styles.headText, { color: neon.textHi }]}>Music for now</Text>
        </View>
        <View style={[styles.seg, { backgroundColor: neon.surface, borderColor: neon.cardBorder }]}>
          {PLAYLISTS.map((p) => {
            const on = st.playlist === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => void radio.setPlaylist(p.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.segBtn, on && { backgroundColor: neon.violet }]}
              >
                <Text style={[styles.segText, { color: on ? '#FFFFFF' : neon.textLo }]}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.row}>
        {track?.artwork ? (
          <Image source={{ uri: track.artwork }} style={styles.art} contentFit="cover" transition={200} />
        ) : (
          <LinearGradient colors={[neon.blue, neon.pink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.art, styles.artEmpty]}>
            <Icon name="music" size={26} color="#FFFFFF" />
          </LinearGradient>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          {track ? (
            <>
              <Text style={[styles.title, { color: neon.textHi }]} numberOfLines={1}>{track.title}</Text>
              <Text style={[styles.artist, { color: neon.textLo }]} numberOfLines={1}>{track.artist}</Text>
              <Pressable onPress={() => void Linking.openURL(track.pageUrl)} accessibilityRole="link" hitSlop={6} style={styles.credit}>
                <Text style={[styles.creditText, { color: neon.textDim }]} numberOfLines={1}>
                  {track.license} · {track.source}
                </Text>
                <Icon name="arrow-up-right" size={12} color={neon.textDim} />
              </Pressable>
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: neon.textHi }]} numberOfLines={1}>
                {loading ? 'Finding music…' : st.status === 'error' ? 'Nothing playing' : 'Press play'}
              </Text>
              <Text style={[styles.artist, { color: neon.textLo }]} numberOfLines={2}>
                {st.message || (st.playlist === 'open' ? 'Creative Commons tracks from Jamendo, picked for the time of day.' : 'Open-licence music people made with AI, from the Internet Archive.')}
              </Text>
            </>
          )}
        </View>
        {playing ? (
          <View style={styles.wave}>
            {[0, 120, 240, 360].map((d) => <WaveformBar key={d} delay={d} color={neon.cyan} active />)}
          </View>
        ) : null}
      </View>

      <View style={[styles.bar, { backgroundColor: neon.line }]}>
        <LinearGradient colors={[neon.blue, neon.pink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.barFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
      <View style={styles.times}>
        <Text style={[styles.time, { color: neon.textDim }]}>{fmtMs(st.positionMs)}</Text>
        <Text style={[styles.time, { color: neon.textDim }]}>{st.durationMs ? fmtMs(st.durationMs) : '--:--'}</Text>
      </View>

      <View style={styles.controls}>
        <Pressable onPress={() => void radio.prev()} accessibilityRole="button" accessibilityLabel="Previous track" hitSlop={8} style={[styles.small, { backgroundColor: neon.surface, borderColor: neon.cardBorder }]}>
          <Icon name="chevron-left" size={22} color={neon.textHi} />
        </Pressable>
        <PressScale onPress={() => void (st.status === 'error' ? radio.retry() : radio.toggle())} accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Play'}>
          <LinearGradient colors={[neon.blue, neon.pink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.big}>
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Icon name={playing ? 'pause' : st.status === 'error' ? 'refresh-cw' : 'play'} size={26} color="#FFFFFF" />}
          </LinearGradient>
        </PressScale>
        <Pressable onPress={() => void radio.next()} accessibilityRole="button" accessibilityLabel="Next track" hitSlop={8} style={[styles.small, { backgroundColor: neon.surface, borderColor: neon.cardBorder }]}>
          <Icon name="chevron-right" size={22} color={neon.textHi} />
        </Pressable>
      </View>
      {st.message && track ? <Text style={[styles.note, { color: neon.textLo }]}>{st.message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1.2, padding: 16 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  headText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  seg: { flexDirection: 'row', borderRadius: 100, borderWidth: 1, padding: 3 },
  segBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
  segText: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  art: { width: 60, height: 60, borderRadius: 14 },
  artEmpty: { alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  artist: { fontSize: 13.5, fontFamily: 'Inter_400Regular', marginTop: 2 },
  credit: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, alignSelf: 'flex-start' },
  creditText: { fontSize: 11.5, fontFamily: 'Inter_500Medium' },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 28 },
  bar: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 14 },
  barFill: { height: 4, borderRadius: 2 },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  time: { fontSize: 11, fontFamily: 'Inter_500Medium', fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22, marginTop: 10 },
  small: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  big: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  note: { fontSize: 12.5, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 10 },
});
