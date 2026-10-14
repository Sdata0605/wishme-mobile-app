import { Audio } from 'expo-av';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';
import { fetchRecordingLink } from '@/services/hub/callLogs';

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Plays one call's recording.
 *
 * The signed link is asked for afresh every time playback starts and is never kept in state or
 * written anywhere: it alone is enough to listen to a private conversation.
 */
export function RecordingPlayer({ callId, getAccessToken }: {
  callId: string;
  getAccessToken: () => Promise<string | null>;
}) {
  const { colors } = useTheme();
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(
    () => () => {
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    },
    [],
  );

  const toggle = useCallback(async () => {
    if (busy) return;

    const loaded = soundRef.current;
    if (loaded) {
      if (playing) {
        await loaded.pauseAsync().catch(() => {});
        setPlaying(false);
      } else {
        await loaded.playAsync().catch(() => {});
        setPlaying(true);
      }
      return;
    }

    setBusy(true);
    setProblem(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setProblem('Please sign in again to play this recording.');
        return;
      }
      const link = await fetchRecordingLink(token, callId);
      if (!link.ok) {
        setProblem(link.message);
        return;
      }
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
      const { sound } = await Audio.Sound.createAsync({ uri: link.url }, { shouldPlay: true });
      await sound.setProgressUpdateIntervalAsync(500);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        setPosition(status.positionMillis);
        if (status.durationMillis) setDuration(status.durationMillis);
        if (status.didJustFinish) {
          // Drop the loaded audio so the next press asks for a brand-new link.
          setPlaying(false);
          setPosition(0);
          soundRef.current?.unloadAsync().catch(() => {});
          soundRef.current = null;
        }
      });
      soundRef.current = sound;
      setPlaying(true);
    } catch {
      setProblem('The recording could not be played.');
    } finally {
      setBusy(false);
    }
  }, [busy, callId, getAccessToken, playing]);

  const progress = duration > 0 ? Math.min(1, position / duration) : 0;

  return (
    <View style={s.wrap}>
      <View style={[s.bar, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => void toggle()}
          style={[s.button, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause the recording' : 'Play the recording'}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Icon name={playing ? 'pause' : 'play'} size={14} color="#fff" />
          )}
        </TouchableOpacity>
        <View style={[s.track, { backgroundColor: colors.border }]}>
          <View style={[s.fill, { backgroundColor: colors.primary, width: `${progress * 100}%` }]} />
        </View>
        <Text style={[s.time, { color: colors.mutedForeground }]}>
          {duration > 0 ? `${clock(position)} / ${clock(duration)}` : 'Recording'}
        </Text>
      </View>
      {problem ? <Text style={[s.problem, { color: colors.mutedForeground }]}>{problem}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 6 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 9999, padding: 8, borderWidth: 1 },
  button: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%' },
  time: { fontSize: 10.5, fontFamily: 'Inter_500Medium', minWidth: 72, textAlign: 'right' },
  problem: { fontSize: 12.5, lineHeight: 17, fontFamily: 'Inter_400Regular', paddingHorizontal: 4 },
});
