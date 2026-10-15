/** Ways to get audio or an image into a tab: the microphone recorder, upload-or-record, and the image picker. */
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';
import { fileUriToBase64, s } from './shared';
import { WaveformBar } from './AudioPlayer';

type RecorderState = 'idle' | 'recording' | 'preview';

function AudioRecorder({ onAudio, label = 'Record Audio' }: { onAudio: (base64: string, name: string) => void; label?: string }) {
  const { colors } = useTheme();
  const [state, setState] = useState<RecorderState>('idle');
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState('');
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  const startPulse = useCallback(() => {
    pulseAnim.setValue(1);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]));
    pulseRef.current = loop;
    loop.start();
  }, [pulseAnim]);

  const stopPulse = () => { pulseRef.current?.stop(); pulseRef.current = null; };
  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };

  useEffect(() => () => {
    stopTimer();
    stopPulse();
    recordingRef.current?.stopAndUnloadAsync().catch(() => {});
  }, []);

  const startRecord = async () => {
    setError('');
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { setError('Microphone permission denied'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setState('recording');
      setSecs(0);
      startPulse();
      timerRef.current = setInterval(() => setSecs(s => s + 1), 1000);
    } catch {
      setError('Could not start recording');
    }
  };

  const stopRecord = async () => {
    stopTimer();
    stopPulse();
    const rec = recordingRef.current;
    if (!rec) { setState('idle'); return; }
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      recordingRef.current = null;
      if (uri) {
        const ext = uri.split('.').pop()?.toLowerCase() ?? 'wav';
        const mime = ext === 'm4a' ? 'audio/m4a' : ext === 'caf' ? 'audio/x-caf' : ext === '3gp' ? 'audio/3gp' : 'audio/wav';
        const base64 = await fileUriToBase64(uri, mime);
        onAudio(base64, `recording.${ext}`);
        setState('preview');
      } else {
        setState('idle');
      }
    } catch {
      setState('idle');
    }
  };

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (state === 'preview') {
    return (
      <View style={[s.recorderPreview, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={s.waveRow}>
          {Array.from({ length: 12 }).map((_, i) => <WaveformBar key={i} delay={i * 80} color="#1F7BFF" active={false} />)}
        </View>
        <Text style={[s.recDuration, { color: colors.mutedForeground }]}>{fmtTime(secs)}</Text>
        <TouchableOpacity style={[s.reRecordBtn, { borderColor: colors.border }]} onPress={() => { setState('idle'); setSecs(0); }}>
          <Icon name="mic" size={14} color={colors.mutedForeground} />
          <Text style={[s.reRecordText, { color: colors.mutedForeground }]}>Re-record</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      <TouchableOpacity
        style={[s.recorderBtn, { backgroundColor: state === 'recording' ? '#7B5CFA15' : colors.card, borderColor: state === 'recording' ? '#7B5CFA' : colors.border }]}
        onPress={state === 'idle' ? startRecord : stopRecord}
        activeOpacity={0.8}
      >
        {state === 'recording' ? (
          <View style={s.recRow}>
            <Animated.View style={[s.recDot, { transform: [{ scale: pulseAnim }] }]} />
            <Text style={[s.recLabel, { color: '#7B5CFA' }]}>Recording... {fmtTime(secs)}</Text>
            <Text style={[s.recHint, { color: colors.mutedForeground }]}>Tap to stop</Text>
          </View>
        ) : (
          <View style={s.recRow}>
            <Icon name="mic" size={20} color="#1F7BFF" />
            <Text style={[s.recLabel, { color: colors.foreground }]}>{label}</Text>
          </View>
        )}
      </TouchableOpacity>
      {!!error && <Text style={s.errorText}>{error}</Text>}
    </View>
  );
}

export function UploadOrRecord({ audioFileName, onAudio, onClear, showRecorder = true }: {
  audioFileName: string | null;
  onAudio: (base64: string, name: string) => void;
  onClear: () => void;
  showRecorder?: boolean;
}) {
  const { colors } = useTheme();

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['audio/*'], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? 'audio/wav';
      const base64 = await fileUriToBase64(asset.uri, mimeType);
      onAudio(base64, asset.name ?? 'audio.wav');
    } catch {}
  };

  if (audioFileName) {
    return (
      <View style={[s.recorderPreview, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Icon name="music" size={18} color="#1F7BFF" />
        <Text style={[s.uploadText, { color: colors.foreground, flex: 1 }]} numberOfLines={1}>{audioFileName}</Text>
        <TouchableOpacity onPress={onClear}>
          <Icon name="x" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.uploadOrRec}>
      <TouchableOpacity style={[s.uploadBtn, { borderColor: colors.border, backgroundColor: colors.card }]} activeOpacity={0.8} onPress={pickFile}>
        <Icon name="upload" size={18} color="#1F7BFF" />
        <Text style={[s.uploadText, { color: colors.foreground }]}>Upload Audio File</Text>
      </TouchableOpacity>
      {showRecorder && (
        <>
          <View style={s.orDivider}>
            <View style={[s.divLine, { backgroundColor: colors.border }]} />
            <Text style={[s.orText, { color: colors.mutedForeground }]}>or</Text>
            <View style={[s.divLine, { backgroundColor: colors.border }]} />
          </View>
          <AudioRecorder onAudio={onAudio} />
        </>
      )}
    </View>
  );
}

export function ImageUploadArea({ imageUri, onImage, onClear }: { imageUri: string | null; onImage: (base64: string, displayUri: string) => void; onClear: () => void }) {
  const { colors } = useTheme();

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    const b64 = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : '';
    if (b64) onImage(b64, asset.uri);
  };

  if (imageUri) {
    return (
      <View style={[s.imagePreview, { borderColor: '#1F7BFF' }]}>
        <Image source={{ uri: imageUri }} style={{ width: '100%', height: 160, borderRadius: 12 }} resizeMode="cover" />
        <TouchableOpacity style={s.changeImageBtn} onPress={onClear}>
          <Text style={s.changeImageText}>Change Image</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity style={[s.imageUploadArea, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={pick} activeOpacity={0.8}>
      <Icon name="upload" size={28} color="#1F7BFF" />
      <Text style={[s.imageUploadText, { color: colors.foreground }]}>Tap to Upload Image</Text>
      <Text style={[{ fontSize: 12, fontFamily: 'Inter_400Regular' }, { color: colors.mutedForeground }]}>JPG, PNG up to 10MB</Text>
    </TouchableOpacity>
  );
}
