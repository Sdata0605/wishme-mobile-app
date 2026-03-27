import * as FileSystem from 'expo-file-system';
import * as Speech from 'expo-speech';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import { Icon, type IconName } from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { supabaseFetch } from '@/constants/supabase';
import { useAIAssistant } from '@/context/AIAssistantContext';

type VoiceStatus = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking' | 'error';

const BG_BY_STATUS: Record<VoiceStatus, string> = {
  idle: '#FF6B33',
  connecting: '#666666',
  listening: '#E8527A',
  processing: '#666666',
  speaking: '#22C55E',
  error: '#E8527A',
};

const ICON_BY_STATUS: Record<VoiceStatus, IconName> = {
  idle: 'mic',
  connecting: 'loader',
  listening: 'mic',
  processing: 'loader',
  speaking: 'volume-2',
  error: 'mic-off',
};

const LABEL_BY_STATUS: Record<VoiceStatus, string> = {
  idle: '',
  connecting: 'Connecting...',
  listening: 'Listening...',
  processing: 'Thinking...',
  speaking: 'Speaking...',
  error: 'Tap to retry',
};

interface WebSpeechRecognitionResult {
  readonly transcript: string;
  readonly confidence: number;
}

interface WebSpeechRecognitionResultList {
  readonly length: number;
  item(index: number): { readonly length: number; item(i: number): WebSpeechRecognitionResult };
  [index: number]: { readonly length: number; [i: number]: WebSpeechRecognitionResult };
}

interface WebSpeechRecognitionEvent {
  readonly results: WebSpeechRecognitionResultList;
}

interface WebSpeechRecognitionErrorEvent {
  readonly error: string;
}

interface WebSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: WebSpeechRecognitionEvent) => void) | null;
  onerror: ((event: WebSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface WindowWithSpeech extends Window {
  SpeechRecognition?: new () => WebSpeechRecognition;
  webkitSpeechRecognition?: new () => WebSpeechRecognition;
}

function getSpeechRecognitionCtor(): (new () => WebSpeechRecognition) | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as WindowWithSpeech;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function VoiceAssistantButton() {
  const { session } = useAuth();
  const { sendMessage } = useAIAssistant();

  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [userTranscript, setUserTranscript] = useState('');
  const [aiTranscript, setAiTranscript] = useState('');
  const [showCards, setShowCards] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [fallbackInput, setFallbackInput] = useState('');

  const recordingRef = useRef<Audio.Recording | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideCardsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreUntilRef = useRef<number>(0);
  const lastTranscriptRef = useRef<string>('');
  const lastTranscriptTimeRef = useRef<number>(0);
  const recognitionRef = useRef<WebSpeechRecognition | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.5)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  const pulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const spinAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (status === 'listening') {
      pulseAnimRef.current = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.6, duration: 600, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(pulseOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
            Animated.timing(pulseOpacity, { toValue: 0.5, duration: 600, useNativeDriver: true }),
          ]),
        ]),
      );
      pulseAnimRef.current.start();
    } else {
      pulseAnimRef.current?.stop();
      pulseAnim.setValue(1);
      pulseOpacity.setValue(0.5);
    }
  }, [status, pulseAnim, pulseOpacity]);

  useEffect(() => {
    if (status === 'connecting' || status === 'processing') {
      spinAnimRef.current = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      spinAnimRef.current.start();
    } else {
      spinAnimRef.current?.stop();
      spinAnim.setValue(0);
    }
  }, [status, spinAnim]);

  const showTranscriptCards = useCallback(
    (user: string, ai: string) => {
      setUserTranscript(user);
      setAiTranscript(ai.slice(0, 120));
      setShowCards(true);
      cardOpacity.setValue(0);
      Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      if (hideCardsTimeoutRef.current) clearTimeout(hideCardsTimeoutRef.current);
      hideCardsTimeoutRef.current = setTimeout(() => {
        Animated.timing(cardOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start(() => setShowCards(false));
      }, 8000);
    },
    [cardOpacity],
  );

  const speakNative = useCallback(async (text: string) => {
    setStatus('speaking');
    await new Promise<void>((resolve) => {
      Speech.speak(text, {
        language: 'en-US',
        rate: 1.0,
        pitch: 1.05,
        onDone: () => resolve(),
        onError: () => resolve(),
      });
    });
    ignoreUntilRef.current = Date.now() + 2200;
    setStatus('idle');
  }, []);

  const speakWeb = useCallback((text: string) => {
    setStatus('speaking');
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setStatus('idle');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const preferred = ['Samantha', 'Victoria', 'Karen', 'Zira', 'Google UK English Female'];
    const found = voices.find((v) => preferred.some((p) => v.name.includes(p)));
    if (found) utterance.voice = found;
    utterance.onend = () => {
      ignoreUntilRef.current = Date.now() + 2200;
      setStatus('idle');
    };
    utterance.onerror = () => setStatus('idle');
    window.speechSynthesis.speak(utterance);
  }, []);

  const stopRecording = useCallback(async () => {
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    const recording = recordingRef.current;
    if (!recording) return;
    recordingRef.current = null;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (!uri) throw new Error('No recording URI');
      setStatus('processing');
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const res = await supabaseFetch(
        '/functions/v1/ai-assistant',
        {
          method: 'POST',
          body: JSON.stringify({
            query: '[VOICE_AUDIO]',
            audioBase64: base64,
            audioMimeType: 'audio/m4a',
            context: { currentRoute: '/', isVoiceInput: true },
            model: 'google/gemini-2.5-flash',
          }),
        },
        session?.access_token,
      );
      if (!res.ok) throw new Error('audio_unsupported');
      const data = (await res.json()) as { transcript?: string; message?: string };
      const userSaid = data.transcript ?? '[voice input]';
      const aiSaid = data.message ?? "Sorry, I'm having trouble right now.";
      showTranscriptCards(userSaid, aiSaid);
      await speakNative(aiSaid);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'audio_unsupported' || msg.toLowerCase().includes('audio')) {
        setShowFallback(true);
        setStatus('idle');
      } else {
        setStatus('error');
      }
    }
  }, [session?.access_token, showTranscriptCards, speakNative]);

  const startNative = useCallback(async () => {
    try {
      setStatus('connecting');
      const { status: permStatus } = await Audio.requestPermissionsAsync();
      if (permStatus !== 'granted') {
        setStatus('error');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setStatus('listening');
      stopTimeoutRef.current = setTimeout(() => stopRecording(), 8000);
    } catch {
      setStatus('error');
    }
  }, [stopRecording]);

  const startWeb = useCallback(() => {
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) {
      setShowFallback(true);
      return;
    }
    setStatus('connecting');
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => setStatus('listening');
    recognition.onresult = (event: WebSpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript.trim();
      if (!transcript) return;
      const now = Date.now();
      if (now < ignoreUntilRef.current) return;
      if (
        transcript === lastTranscriptRef.current &&
        now - lastTranscriptTimeRef.current < 8000
      ) {
        return;
      }
      lastTranscriptRef.current = transcript;
      lastTranscriptTimeRef.current = now;
      setUserTranscript(transcript);
      setStatus('processing');
      recognition.stop();
      sendMessage(transcript, true)
        .then((aiMsg) => {
          showTranscriptCards(transcript, aiMsg);
          speakWeb(aiMsg);
        })
        .catch(() => setStatus('error'));
    };
    recognition.onerror = (e: WebSpeechRecognitionErrorEvent) => {
      if (e.error === 'no-speech' || e.error === 'aborted') {
        setStatus('idle');
      } else {
        setStatus('error');
      }
    };
    recognition.onend = () => {
      setStatus((prev) => (prev === 'listening' ? 'idle' : prev));
    };
    try {
      recognition.start();
    } catch {
      setStatus('error');
    }
  }, [sendMessage, showTranscriptCards, speakWeb]);

  const handlePress = useCallback(() => {
    if (status === 'listening') {
      if (Platform.OS !== 'web') {
        stopRecording();
      } else {
        recognitionRef.current?.stop();
        setStatus('idle');
      }
      return;
    }
    if (status === 'speaking') {
      if (Platform.OS === 'web') window.speechSynthesis?.cancel();
      else Speech.stop();
      setStatus('idle');
      return;
    }
    if (status === 'idle' || status === 'error') {
      if (Platform.OS === 'web') {
        startWeb();
      } else {
        startNative();
      }
    }
  }, [status, stopRecording, startWeb, startNative]);

  const handleFallbackSend = useCallback(async () => {
    const query = fallbackInput.trim();
    if (!query) return;
    Keyboard.dismiss();
    setFallbackInput('');
    setShowFallback(false);
    setStatus('processing');
    try {
      const aiMsg = await sendMessage(query, true);
      showTranscriptCards(query, aiMsg);
      if (Platform.OS !== 'web') {
        await speakNative(aiMsg);
      } else {
        speakWeb(aiMsg);
      }
    } catch {
      setStatus('error');
    }
  }, [fallbackInput, sendMessage, showTranscriptCards, speakNative, speakWeb]);

  useEffect(() => {
    return () => {
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
      if (hideCardsTimeoutRef.current) clearTimeout(hideCardsTimeoutRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      recognitionRef.current?.abort();
      if (Platform.OS === 'web') window.speechSynthesis?.cancel();
      else Speech.stop();
    };
  }, []);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const label = LABEL_BY_STATUS[status];

  return (
    <>
      {showCards && (
        <Animated.View
          style={[styles.cardsContainer, { opacity: cardOpacity }]}
          pointerEvents="none"
        >
          {aiTranscript ? (
            <View style={styles.aiCard}>
              <Text style={styles.cardLabel}>AI:</Text>
              <Text style={styles.cardText}>{aiTranscript}</Text>
            </View>
          ) : null}
          {userTranscript ? (
            <View style={styles.userCard}>
              <Text style={styles.cardLabel}>You said:</Text>
              <Text style={styles.cardText}>{userTranscript}</Text>
            </View>
          ) : null}
        </Animated.View>
      )}

      {showFallback && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'position' : undefined}
          style={styles.fallbackWrapper}
        >
          <View style={styles.fallbackCard}>
            <Text style={styles.fallbackLabel}>Voice Mode (type to speak)</Text>
            <View style={styles.fallbackRow}>
              <TextInput
                style={styles.fallbackInput}
                value={fallbackInput}
                onChangeText={setFallbackInput}
                placeholder="Type your message..."
                placeholderTextColor="#aaa"
                onSubmitEditing={handleFallbackSend}
                returnKeyType="send"
                autoFocus
              />
              <TouchableOpacity
                style={styles.fallbackSend}
                onPress={handleFallbackSend}
                activeOpacity={0.75}
              >
                <Icon name="send" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setShowFallback(false)} style={styles.fallbackClose}>
              <Text style={styles.fallbackCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      <View style={styles.container}>
        {status === 'listening' && (
          <Animated.View
            style={[
              styles.pulseRing,
              { transform: [{ scale: pulseAnim }], opacity: pulseOpacity },
            ]}
            pointerEvents="none"
          />
        )}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: BG_BY_STATUS[status] }]}
          onPress={handlePress}
          activeOpacity={0.85}
        >
          {status === 'connecting' || status === 'processing' ? (
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <Icon name={ICON_BY_STATUS[status]} size={28} color="#fff" />
            </Animated.View>
          ) : (
            <Icon name={ICON_BY_STATUS[status]} size={28} color="#fff" />
          )}
        </TouchableOpacity>

        {label !== '' && <Text style={styles.label}>{label}</Text>}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    alignItems: 'center',
    zIndex: 9997,
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  pulseRing: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E8527A',
    top: 0,
  },
  label: {
    marginTop: 4,
    fontSize: 10,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    textAlign: 'center',
  },
  cardsContainer: {
    position: 'absolute',
    bottom: 170,
    left: 16,
    zIndex: 9997,
    gap: 8,
  },
  userCard: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 12,
    padding: 10,
    maxWidth: 220,
  },
  aiCard: {
    backgroundColor: 'rgba(255,107,51,0.15)',
    borderRadius: 12,
    padding: 10,
    maxWidth: 220,
    borderWidth: 1,
    borderColor: 'rgba(255,107,51,0.3)',
  },
  cardLabel: {
    fontSize: 10,
    color: '#FF6B33',
    fontWeight: '700',
    marginBottom: 3,
  },
  cardText: {
    fontSize: 12,
    color: '#fff',
    lineHeight: 16,
  },
  fallbackWrapper: {
    position: 'absolute',
    bottom: 170,
    left: 16,
    zIndex: 9998,
  },
  fallbackCard: {
    backgroundColor: 'rgba(20,20,30,0.95)',
    borderRadius: 16,
    padding: 14,
    width: 240,
    borderWidth: 1,
    borderColor: 'rgba(255,107,51,0.4)',
  },
  fallbackLabel: {
    fontSize: 11,
    color: '#FF6B33',
    fontWeight: '700',
    marginBottom: 10,
  },
  fallbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fallbackInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  fallbackSend: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF6B33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackClose: {
    marginTop: 10,
    alignSelf: 'flex-end',
  },
  fallbackCloseText: {
    fontSize: 12,
    color: '#aaa',
  },
});
