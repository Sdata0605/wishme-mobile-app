/** Media building blocks used inside the cards: pulsing status badge, audio player, download link, image preview modal, inline video player. */
import { Audio } from 'expo-av';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { fmtMs, s } from './shared';
import type { Colors } from './shared';

export function PulseStatusBadge({ label, color, pulse }: { label: string; color: string; pulse: boolean }) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!pulse) { anim.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse, anim]);
  return (
    <Animated.View style={[s.statusBadge, { backgroundColor: color + '22', opacity: pulse ? anim : 1 }]}>
      <Text style={[s.statusText, { color }]}>{label}</Text>
    </Animated.View>
  );
}

export function BookingAudioPlayer({ audioUrl, colors }: { audioUrl: string | null; colors: Colors }) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => () => { soundRef.current?.unloadAsync().catch(() => {}); }, []);

  const toggle = async () => {
    if (!audioUrl || loading) return;
    if (!soundRef.current) {
      setLoading(true);
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
        const { sound } = await Audio.Sound.createAsync({ uri: audioUrl }, { shouldPlay: true });
        await sound.setProgressUpdateIntervalAsync(500);
        sound.setOnPlaybackStatusUpdate(st => {
          if (!st.isLoaded) return;
          setPosition(st.positionMillis);
          if (st.durationMillis) setDuration(st.durationMillis);
          if (st.didJustFinish) { setPlaying(false); setPosition(0); }
        });
        soundRef.current = sound;
        setPlaying(true);
      } catch { setPlaying(false); }
      setLoading(false);
      return;
    }
    if (playing) {
      await soundRef.current.pauseAsync();
      setPlaying(false);
    } else {
      await soundRef.current.playAsync();
      setPlaying(true);
    }
  };

  const progress = duration > 0 ? position / duration : 0;
  return (
    <View style={[s.audioPlayer, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <TouchableOpacity onPress={toggle} style={[s.playBtn, { backgroundColor: '#FF6B33' }]} disabled={!audioUrl}>
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Icon name={playing ? 'pause' : 'play'} size={13} color="#fff" />
        )}
      </TouchableOpacity>
      <View style={s.audioBar}>
        <View style={[s.audioProgress, { backgroundColor: '#FF6B33', width: `${progress * 100}%` }]} />
      </View>
      <Text style={[s.audioDuration, { color: colors.mutedForeground }]}>
        {duration > 0 ? `${fmtMs(position)} / ${fmtMs(duration)}` : audioUrl ? '--:--' : 'N/A'}
      </Text>
    </View>
  );
}

export function DownloadLink({ url, colors }: { url: string; colors: Colors }) {
  return (
    <TouchableOpacity
      onPress={() => Linking.openURL(url).catch(() => {})}
      style={s.downloadLink}
    >
      <Icon name="download" size={13} color="#3B82F6" />
      <Text style={[s.downloadLinkText, { color: '#3B82F6' }]}>Download</Text>
    </TouchableOpacity>
  );
}

export function ImagePreviewModal({ url, onClose }: { url: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={[s.imgModalOverlay]}>
        <TouchableOpacity style={[s.imgModalClose, { top: insets.top + 16 }]} onPress={onClose}>
          <Icon name="x" size={22} color="#fff" />
        </TouchableOpacity>
        <Image source={{ uri: url }} style={s.imgModalImage} resizeMode="contain" />
      </View>
    </Modal>
  );
}

export function InlineCelebVideoPlayer({ videoUri, colors }: { videoUri: string; colors: Colors }) {
  const player = useVideoPlayer(videoUri, p => { p.loop = false; });
  return (
    <View style={[s.videoWrapper, { borderColor: colors.border }]}>
      <VideoView player={player} style={s.videoView} nativeControls />
    </View>
  );
}
