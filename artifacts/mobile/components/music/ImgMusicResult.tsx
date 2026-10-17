/** Result panel for the Img+Music tab: image with play overlay, save-audio and download-MP4 (built in-browser on web). */
import { Audio } from 'expo-av';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon } from '@/components/Icon';
import { saveAudioToCache, downloadToDevice, downloadUrlToDevice, s } from './shared';
import { WaveformBar } from './AudioPlayer';

function buildMp4ViaCanvas(imgSrc: string, audioDataUri: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 450;
      const ctx2d = canvas.getContext('2d');
      if (!ctx2d) { resolve(); return; }
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx2d.drawImage(img, 0, 0, 800, 450);
        const stream = canvas.captureStream(1);
        const mimeType =
          typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/mp4')
            ? 'video/mp4'
            : 'video/webm';
        if (typeof MediaRecorder === 'undefined') { resolve(); return; }
        const recorder = new MediaRecorder(stream, { mimeType });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e: BlobEvent) => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `wishme_video_${Date.now()}.${mimeType === 'video/mp4' ? 'mp4' : 'webm'}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          resolve();
        };
        try {
          const audioBase64 = audioDataUri.includes(',') ? audioDataUri.split(',')[1] : audioDataUri;
          const binary = atob(audioBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const audioCtx = new AudioContext();
          audioCtx.decodeAudioData(bytes.buffer.slice(0)).then((buffer) => {
            const source = audioCtx.createBufferSource();
            source.buffer = buffer;
            const dest = audioCtx.createMediaStreamDestination();
            source.connect(dest);
            stream.addTrack(dest.stream.getAudioTracks()[0]);
            recorder.start();
            source.start();
            setTimeout(() => { recorder.stop(); source.stop(); audioCtx.close(); }, buffer.duration * 1000 + 300);
          }).catch(() => {
            recorder.start();
            setTimeout(() => recorder.stop(), 5000);
          });
        } catch {
          recorder.start();
          setTimeout(() => recorder.stop(), 5000);
        }
      };
      img.onerror = () => resolve();
      img.src = imgSrc;
    } catch {
      resolve();
    }
  });
}

export function ImgMusicResult({ audioUrl, imgBase64, hasVocals, videoUrl }: {
  audioUrl: string;
  imgBase64: string;
  hasVocals: boolean;
  videoUrl?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [audioSaved, setAudioSaved] = useState(false);
  const [videoSaved, setVideoSaved] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => () => { soundRef.current?.unloadAsync().catch(() => {}); }, []);

  const toggle = async () => {
    if (loading) return;
    if (!soundRef.current) {
      setLoading(true);
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
        const isRemoteUrl = audioUrl.startsWith('http://') || audioUrl.startsWith('https://');
        const uri = isRemoteUrl ? audioUrl : await saveAudioToCache(audioUrl);
        const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
        sound.setOnPlaybackStatusUpdate(st => {
          if (st.isLoaded && st.didJustFinish) setPlaying(false);
        });
        soundRef.current = sound;
        setPlaying(true);
      } catch {}
      setLoading(false);
      return;
    }
    if (playing) { await soundRef.current.pauseAsync(); setPlaying(false); }
    else { await soundRef.current.playAsync(); setPlaying(true); }
  };

  const stopPlayback = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setPlaying(false);
  };

  const saveAudio = async () => {
    try {
      const isMP3 = audioUrl.startsWith('data:audio/mpeg') || audioUrl.endsWith('.mp3');
      const ext = isMP3 ? 'mp3' : audioUrl.startsWith('data:audio/mp4') || audioUrl.startsWith('data:audio/m4a') ? 'm4a' : 'wav';
      if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
        await downloadUrlToDevice(audioUrl, `wishme_audio_${Date.now()}.${ext}`);
      } else {
        await downloadToDevice(audioUrl, `wishme_audio_${Date.now()}.${ext}`);
      }
      setAudioSaved(true);
      setTimeout(() => setAudioSaved(false), 2500);
    } catch (err) {
      const msg = err instanceof Error && err.message === 'media_library_permission_denied'
        ? 'Please allow media library access to save audio to your device.'
        : 'Could not save the audio. Please try again.';
      Alert.alert('Save Failed', msg);
    }
  };

  const downloadMp4 = async () => {
    try {
      if (Platform.OS === 'web') {
        await buildMp4ViaCanvas(imgBase64, audioUrl);
      } else if (videoUrl) {
        const filename = `wishme_video_${Date.now()}.mp4`;
        if (videoUrl.startsWith('data:') || videoUrl.startsWith('file://')) {
          await downloadToDevice(videoUrl, filename);
        } else {
          await downloadUrlToDevice(videoUrl, filename);
        }
      } else {
        return;
      }
      setVideoSaved(true);
      setTimeout(() => setVideoSaved(false), 2500);
    } catch (err) {
      const msg = err instanceof Error && err.message === 'media_library_permission_denied'
        ? 'Please allow media library access to save video to your device.'
        : 'Could not save the video. Please try again.';
      Alert.alert('Save Failed', msg);
    }
  };

  return (
    <View style={s.imgMusicResult}>
      <View style={{ borderRadius: 16, overflow: 'hidden' }}>
        <Image source={{ uri: imgBase64 }} style={{ width: '100%', height: 220 }} resizeMode="cover" />
        <View style={s.imgOverlay}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity style={s.overlayPlayBtn} onPress={toggle} disabled={loading} activeOpacity={0.8}>
              <Icon name={loading ? 'refresh-cw' : playing ? 'pause' : 'play'} size={30} color="#fff" />
            </TouchableOpacity>
            {(playing || soundRef.current !== null) ? (
              <TouchableOpacity style={[s.overlayPlayBtn, { width: 44, height: 44 }]} onPress={stopPlayback} activeOpacity={0.8}>
                <Icon name="volume-x" size={20} color="#fff" />
              </TouchableOpacity>
            ) : null}
          </View>
          {playing && (
            <View style={s.imgWaveRow}>
              {Array.from({ length: 10 }).map((_, i) => <WaveformBar key={i} delay={i * 80} color="#fff" active={true} />)}
            </View>
          )}
        </View>
        {hasVocals && (
          <View style={s.imgBadgeTop}>
            <Icon name="music" size={12} color="#fff" />
            <Text style={s.imgBadgeText}>AI Vocals</Text>
          </View>
        )}
      </View>
      <View style={s.imgMusicActions}>
        <TouchableOpacity style={[s.actionBtn, { flex: 1, borderColor: '#B44CFF', borderWidth: 1.5 }]} onPress={saveAudio}>
          <Icon name={audioSaved ? 'check' : 'download'} size={15} color="#B44CFF" />
          <Text style={[s.actionBtnText, { color: '#B44CFF' }]}>{audioSaved ? 'Audio Saved!' : 'Save Audio'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, { flex: 1, backgroundColor: '#B44CFF' }]} onPress={downloadMp4}>
          <Icon name={videoSaved ? 'check' : 'download'} size={15} color="#fff" />
          <Text style={[s.actionBtnText, { color: '#fff' }]}>{videoSaved ? 'Saved!' : 'Download MP4'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
