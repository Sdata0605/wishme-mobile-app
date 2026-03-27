import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { useAIAssistant } from '@/context/AIAssistantContext';

type VoiceStatus = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking' | 'error';

const BG_BY_STATUS: Record<VoiceStatus, string> = {
  idle: '#FF6B33',
  connecting: '#888888',
  listening: '#E8527A',
  processing: '#888888',
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
  const { sendMessage } = useAIAssistant();

  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [userTranscript, setUserTranscript] = useState('');
  const [aiTranscript, setAiTranscript] = useState('');
  const [showCards, setShowCards] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [fallbackInput, setFallbackInput] = useState('');

  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideCardsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreUntilRef = useRef<number>(0);
  const lastTranscriptRef = useRef<string>('');
  const lastTranscriptTimeRef = useRef<number>(0);
  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  const processingRef = useRef(false);

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
      setAiTranscript(ai.slice(0, 140));
      setShowCards(true);
      cardOpacity.setValue(0);
      Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      if (hideCardsTimeoutRef.current) clearTimeout(hideCardsTimeoutRef.current);
      hideCardsTimeoutRef.current = setTimeout(() => {
        Animated.timing(cardOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() =>
          setShowCards(false),
        );
      }, 9000);
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

  const handleTranscript = useCallback(
    async (transcript: string) => {
      if (!transcript.trim()) return;
      if (processingRef.current) return;
      const now = Date.now();
      if (now < ignoreUntilRef.current) return;
      if (transcript === lastTranscriptRef.current && now - lastTranscriptTimeRef.current < 8000) return;
      lastTranscriptRef.current = transcript;
      lastTranscriptTimeRef.current = now;
      processingRef.current = true;

      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
        stopTimeoutRef.current = null;
      }

      setStatus('processing');
      try {
        const aiMsg = await sendMessage(transcript.trim(), true);
        showTranscriptCards(transcript.trim(), aiMsg);
        await speakNative(aiMsg);
      } catch {
        setStatus('error');
      } finally {
        processingRef.current = false;
      }
    },
    [sendMessage, showTranscriptCards, speakNative],
  );

  useSpeechRecognitionEvent('start', () => {
    setStatus('listening');
    stopTimeoutRef.current = setTimeout(() => {
      ExpoSpeechRecognitionModule.stop();
    }, 12000);
  });

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results?.[0]?.transcript ?? '';
    if (transcript) {
      handleTranscript(transcript);
    }
  });

  useSpeechRecognitionEvent('end', () => {
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    setStatus((prev) => (prev === 'listening' ? 'idle' : prev));
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    const code = event.error ?? '';
    if (code === 'no-speech' || code === '7') {
      setStatus('idle');
    } else if (code === 'not-allowed' || code === '9') {
      setShowFallback(true);
      setStatus('idle');
    } else {
      setStatus('error');
    }
  });

  const startNative = useCallback(async () => {
    try {
      setStatus('connecting');
      processingRef.current = false;
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) {
        setShowFallback(true);
        setStatus('idle');
        return;
      }
      await ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: false,
        maxAlternatives: 1,
        continuous: false,
      });
    } catch {
      setShowFallback(true);
      setStatus('idle');
    }
  }, []);

  const stopNative = useCallback(() => {
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {}
    setStatus('idle');
  }, []);

  const startWeb = useCallback(() => {
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) {
      setStatus('error');
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
      if (transcript === lastTranscriptRef.current && now - lastTranscriptTimeRef.current < 8000) return;
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
      if (e.error === 'no-speech' || e.error === 'aborted') setStatus('idle');
      else setStatus('error');
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
      if (Platform.OS !== 'web') stopNative();
      else { recognitionRef.current?.stop(); setStatus('idle'); }
      return;
    }
    if (status === 'speaking') {
      if (Platform.OS === 'web') window.speechSynthesis?.cancel();
      else Speech.stop();
      setStatus('idle');
      return;
    }
    if (status === 'idle' || status === 'error') {
      if (Platform.OS === 'web') startWeb();
      else startNative();
    }
  }, [status, stopNative, startWeb, startNative]);

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
      if (Platform.OS !== 'web') await speakNative(aiMsg);
      else speakWeb(aiMsg);
    } catch {
      setStatus('error');
    }
  }, [fallbackInput, sendMessage, showTranscriptCards, speakNative, speakWeb]);

  useEffect(() => {
    return () => {
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
      if (hideCardsTimeoutRef.current) clearTimeout(hideCardsTimeoutRef.current);
      if (Platform.OS === 'web') {
        window.speechSynthesis?.cancel();
        recognitionRef.current?.abort();
      } else {
        try { ExpoSpeechRecognitionModule.stop(); } catch {}
        Speech.stop();
      }
    };
  }, []);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const label = LABEL_BY_STATUS[status];

  return (
    <>
      {showCards && (
        <Animated.View style={[styles.cardsContainer, { opacity: cardOpacity }]} pointerEvents="none">
          {aiTranscript ? (
            <View style={styles.aiCard}>
              <Text style={styles.cardLabel}>WishMe AI</Text>
              <Text style={styles.cardText}>{aiTranscript}</Text>
            </View>
          ) : null}
          {userTranscript ? (
            <View style={styles.userCard}>
              <Text style={styles.cardLabel}>You said</Text>
              <Text style={styles.cardText}>{userTranscript}</Text>
            </View>
          ) : null}
        </Animated.View>
      )}

      <Modal
        visible={showFallback}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFallback(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalIconRow}>
              <View style={styles.modalIconBg}>
                <Icon name="mic-off" size={28} color="#FF6B33" />
              </View>
            </View>
            <Text style={styles.modalTitle}>Voice input unavailable</Text>
            <Text style={styles.modalSubtitle}>
              Speech recognition isn't available on this device. Type your message below and WishMe AI will speak the reply.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={fallbackInput}
              onChangeText={setFallbackInput}
              placeholder="Ask me anything..."
              placeholderTextColor="#666"
              onSubmitEditing={handleFallbackSend}
              returnKeyType="send"
              autoFocus
              multiline={false}
            />
            <TouchableOpacity style={styles.modalSendBtn} onPress={handleFallbackSend} activeOpacity={0.8}>
              <Icon name="send" size={18} color="#fff" />
              <Text style={styles.modalSendText}>Send & Speak</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowFallback(false)} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.container}>
        {status !== 'idle' && label !== '' && (
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>{label}</Text>
          </View>
        )}

        {status === 'listening' && (
          <Animated.View
            style={[styles.pulseRing, { transform: [{ scale: pulseAnim }], opacity: pulseOpacity }]}
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
              <Icon name={ICON_BY_STATUS[status]} size={20} color="#fff" />
            </Animated.View>
          ) : (
            <Icon name={ICON_BY_STATUS[status]} size={20} color="#fff" />
          )}
        </TouchableOpacity>
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
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  pulseRing: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8527A',
    top: 0,
  },
  statusPill: {
    backgroundColor: 'rgba(0,0,0,0.82)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  statusPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  cardsContainer: {
    position: 'absolute',
    bottom: 170,
    left: 16,
    zIndex: 9997,
    gap: 8,
  },
  userCard: {
    backgroundColor: 'rgba(10,13,20,0.92)',
    borderRadius: 14,
    padding: 12,
    maxWidth: 240,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  aiCard: {
    backgroundColor: 'rgba(255,107,51,0.12)',
    borderRadius: 14,
    padding: 12,
    maxWidth: 240,
    borderWidth: 1,
    borderColor: 'rgba(255,107,51,0.35)',
  },
  cardLabel: {
    fontSize: 10,
    color: '#FF6B33',
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardText: {
    fontSize: 13,
    color: '#fff',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 20,
  },
  modalIconRow: {
    marginBottom: 16,
  },
  modalIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,107,51,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,107,51,0.3)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  modalInput: {
    width: '100%',
    backgroundColor: '#1F2937',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 14,
  },
  modalSendBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B33',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    marginBottom: 12,
  },
  modalSendText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  modalCancel: {
    paddingVertical: 8,
  },
  modalCancelText: {
    color: '#6B7280',
    fontSize: 14,
  },
});
