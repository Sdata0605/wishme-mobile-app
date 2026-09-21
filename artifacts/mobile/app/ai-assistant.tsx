import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/constants/supabase';
import { useAIAssistant, type AIMessage } from '@/context/AIAssistantContext';
import { useAgentState } from '@/context/AgentStateContext';

const QUICK_STARTS = [
  { label: '🎬 Celebrity Wish', query: 'Book a celebrity video wish for me' },
  { label: '✈️ Book Flight', query: 'Book me a flight' },
  { label: '🏨 Book Hotel', query: 'Find a hotel for me' },
  { label: '🎵 Make a Song', query: 'Generate a song for me' },
  { label: '💡 Pay Bill', query: 'Pay my electricity bill' },
  { label: '💳 Wallet', query: 'Check my wallet balance' },
  { label: '🎂 Add Occasion', query: 'Add a birthday reminder' },
  { label: '🚌 Book Bus', query: 'Book a bus ticket' },
];

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 350, useNativeDriver: true }),
          Animated.delay(700 - delay),
        ]),
      );
    const a1 = anim(dot1, 0);
    const a2 = anim(dot2, 200);
    const a3 = anim(dot3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [dot1, dot2, dot3]);

  const dotStyle = (dot: Animated.Value) => ({
    transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
  });

  return (
    <View style={styles.typingWrap}>
      <View style={styles.assistantBubble}>
        <View style={styles.typingDots}>
          {[dot1, dot2, dot3].map((d, i) => (
            <Animated.View key={i} style={[styles.typingDot, dotStyle(d)]} />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Agent status bar ─────────────────────────────────────────────────────────

function AgentStatusBar({
  label,
  completedSteps,
  onCancel,
}: {
  label: string;
  completedSteps: string[];
  onCancel: () => void;
}) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.6, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.agentBar}>
      <LinearGradient
        colors={['#FF6B33', '#B44CFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.agentBarGradient}
      >
        <Animated.View style={[styles.agentDot, { opacity: pulse }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.agentBarLabel}>{label}</Text>
          {completedSteps.length > 0 && (
            <Text style={styles.agentBarSub}>
              ✅ {completedSteps[completedSteps.length - 1]}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={onCancel} style={styles.agentCancelBtn}>
          <Icon name="x" size={14} color="rgba(255,255,255,0.8)" />
          <Text style={styles.agentCancelText}>Stop</Text>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

// ─── Confirm card ─────────────────────────────────────────────────────────────

function ConfirmCard({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.confirmCard}>
      <Icon name="check-circle" size={22} color="#FF6B33" />
      <Text style={styles.confirmMsg}>{message}</Text>
      <View style={styles.confirmBtns}>
        <TouchableOpacity style={styles.confirmCancelBtn} onPress={onCancel}>
          <Text style={styles.confirmCancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onConfirm} activeOpacity={0.8}>
          <LinearGradient
            colors={['#FF6B33', '#B44CFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.confirmOkBtn}
          >
            <Text style={styles.confirmOkText}>Confirm & Continue ✓</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, onSuggestion }: { msg: AIMessage; onSuggestion: (s: string) => void }) {
  const isUser = msg.role === 'user';

  if (isUser) {
    return (
      <View style={styles.userBubbleWrap}>
        <LinearGradient
          colors={['#FF6B33', '#EC4899', '#B44CFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.userBubble}
        >
          <Text style={styles.userText}>{msg.content}</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.assistantBubbleWrap}>
      {/* Agent mode badge */}
      {msg.mode === 'agent' && (
        <View style={styles.agentBadge}>
          <Icon name="sparkles" size={10} color="#FF6B33" />
          <Text style={styles.agentBadgeText}>Agent</Text>
        </View>
      )}
      <View style={styles.assistantBubble}>
        <Text style={styles.assistantText}>{msg.content}</Text>
      </View>
      {msg.actions && msg.actions.length > 0 && (
        <View style={styles.actionsRow}>
          {msg.actions.map((action, i) => (
            <TouchableOpacity
              key={i}
              style={styles.actionBtn}
              onPress={() => {
                if (action.type === 'navigate' && action.data.route) {
                  router.push(action.data.route as Href);
                }
              }}
              activeOpacity={0.75}
            >
              <Text style={styles.actionBtnText}>{action.label}</Text>
              <Icon name="arrow-right" size={12} color="#aaa" />
            </TouchableOpacity>
          ))}
        </View>
      )}
      {msg.suggestions && msg.suggestions.length > 0 && (
        <View style={styles.suggestionsRow}>
          {msg.suggestions.map((s, i) => (
            <TouchableOpacity
              key={i}
              style={styles.suggestionChip}
              onPress={() => onSuggestion(s)}
              activeOpacity={0.75}
            >
              <Text style={styles.suggestionText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

import { Audio } from 'expo-av';
import { voiceService } from '@/services/voiceService';
import { geminiLiveAudio } from '@/services/geminiLiveService';
import { detectDirectSection } from '@/services/agentEngine';

export type GeminiVoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

// ── Load expo-speech-recognition dynamically ────────────────────────────────
type _SpeechEventName = 'start' | 'result' | 'end' | 'error';
interface _SpeechEvent {
  results?: ReadonlyArray<{ readonly transcript: string }>;
  isFinal?: boolean;
  error?: string;
}
type _SpeechEventHandler = (event: _SpeechEvent) => void;

interface _SpeechRecognitionModule {
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  start: (opts: Record<string, unknown>) => Promise<void>;
  stop: () => void;
}

let ExpoSpeechRecognitionModule: _SpeechRecognitionModule | null = null;
let useSpeechRecognitionEvent: (event: _SpeechEventName, handler: _SpeechEventHandler) => void =
  (_event, _handler) => {};
let hasSpeechRecognition = false;

try {
  const _mod = require('expo-speech-recognition') as {
    ExpoSpeechRecognitionModule: _SpeechRecognitionModule;
    useSpeechRecognitionEvent: (event: _SpeechEventName, handler: _SpeechEventHandler) => void;
  };
  ExpoSpeechRecognitionModule = _mod.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = _mod.useSpeechRecognitionEvent;
  hasSpeechRecognition = true;
} catch {}

export default function AIAssistantScreen() {
  const {
    messages,
    isTyping,
    sendMessage,
    clearMessages,
    pendingConfirm,
    confirmAgentStep,
    cancelAgent,
    isAgentExecuting,
    agentStepLabel,
  } = useAIAssistant();

  const { completedSteps } = useAgentState();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [input, setInput] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(voiceService.getIsSpeaking());

  // Inline Gemini Voice state
  const [voiceState, setVoiceState] = useState<GeminiVoiceState>('idle');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const voiceTranscriptRef = useRef('');
  const webRecogRef = useRef<any>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const processingRef = useRef(false);
  const ignoreUntilRef = useRef<number>(0);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = voiceService.addSpeakingListener(setIsSpeaking);
    return () => {
      unsub();
      voiceService.stop();
      geminiLiveAudio.stop();
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    };
  }, []);

  // ─── Handle voice complete ─────────────────────────────────────────────────
  const handleVoiceComplete = useCallback(async (spokenText: string) => {
    const clean = spokenText.trim();
    console.log('[AI Assistant Voice Stage 5: Instant Intent Execution] handleVoiceComplete triggered with input:', clean);
    if (!clean || processingRef.current) return;
    const now = Date.now();
    if (now < ignoreUntilRef.current) return;
    
    processingRef.current = true;
    setVoiceState('thinking');

    // 1. Instant local intent match (0ms latency on device)
    const directMatch = detectDirectSection(clean);
    if (directMatch) {
      console.log('[AI Assistant Voice Stage 5] Local instant match found! Navigating immediately to:', directMatch.sectionName);
      setVoiceState('speaking');

      // Navigate immediately in 0ms
      if (directMatch.serviceView) {
        if (directMatch.billKind) {
          router.navigate({
            pathname: '/services',
            params: { start: 'billPay', kind: directMatch.billKind },
          } as any);
        } else {
          router.navigate({
            pathname: '/services',
            params: { start: directMatch.serviceView },
          } as any);
        }
      } else if (directMatch.route) {
        router.push(directMatch.route as any);
      }

      // Stream Gemini voice aloud simultaneously in background
      geminiLiveAudio.speakWithVoice(directMatch.confirmMessage, () => {
        console.log('[AI Assistant Voice Stage 6] Speech completed');
        ignoreUntilRef.current = Date.now() + 500;
        setVoiceState('idle');
        setVoiceTranscript('');
        voiceTranscriptRef.current = '';
        processingRef.current = false;
      });

      // Still record in chat messages
      sendMessage(clean, true).catch(() => {});
      return;
    }

    // 2. General agent query if no direct service match
    try {
      console.log('[AI Assistant Voice Stage 5] Routing query to in-app agent engine:', clean);
      const aiReply = await sendMessage(clean, true);
      console.log('[AI Assistant Voice Stage 6: Gemini Voice Spoken] Agent engine returned reply:', aiReply);
      setVoiceState('speaking');
      geminiLiveAudio.speakWithVoice(aiReply, () => {
        console.log('[AI Assistant Voice Stage 6] Gemini Glow speech playback completed');
        ignoreUntilRef.current = Date.now() + 1000;
        setVoiceState('idle');
        setVoiceTranscript('');
        voiceTranscriptRef.current = '';
        processingRef.current = false;
      });
    } catch (err) {
      console.error('[AI Assistant Voice Error] Error executing voice intent:', err);
      setVoiceState('idle');
      processingRef.current = false;
    }
  }, [sendMessage]);

  // ─── Hook listeners for native speech recognition ─────────────────────────
  useSpeechRecognitionEvent('start', () => {
    console.log('[AI Assistant Voice] Native speech recognition started');
    setVoiceState('listening');
    if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    stopTimeoutRef.current = setTimeout(() => {
      try { ExpoSpeechRecognitionModule?.stop(); } catch {}
    }, 15000);
  });

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results?.[0]?.transcript ?? '';
    console.log('[AI Assistant Voice Stage 4] Native speech recognition result:', transcript, 'isFinal:', event.isFinal);
    if (transcript) {
      voiceTranscriptRef.current = transcript;
      setVoiceTranscript(transcript);
      if (event.isFinal) {
        handleVoiceComplete(transcript);
      }
    }
  });

  useSpeechRecognitionEvent('end', () => {
    console.log('[AI Assistant Voice] Native speech recognition ended');
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    setVoiceState((prev) => (prev === 'listening' ? 'idle' : prev));
    const pendingText = voiceTranscriptRef.current.trim();
    if (pendingText && !processingRef.current) {
      handleVoiceComplete(pendingText);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    console.warn('[AI Assistant Voice] Native speech recognition error:', event);
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    setVoiceState('idle');
  });

  // ─── Stop all voice & Transcribe ──────────────────────────────────────────
  const stopVoiceInput = useCallback(async () => {
    console.log('[AI Assistant Voice Stage 3: Audio Captured] Stopping voice input and extracting audio...');
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    // Stop native speech module
    try { ExpoSpeechRecognitionModule?.stop(); } catch {}
    // Stop web speech
    try {
      if (webRecogRef.current) {
        webRecogRef.current.stop?.();
        webRecogRef.current.abort?.();
        webRecogRef.current = null;
      }
    } catch {}

    // Stop expo-av recording & get URI
    let recordedUri: string | null = null;
    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        recordedUri = recordingRef.current.getURI();
        recordingRef.current = null;
        console.log('[AI Assistant Voice Stage 3] Audio recording stopped. File URI:', recordedUri);
      }
    } catch (err) {
      console.warn('[AI Assistant Voice Stage 3] Error stopping recording:', err);
    }

    const currentText = (voiceTranscriptRef.current || voiceTranscript).trim();
    if (currentText) {
      console.log('[AI Assistant Voice Stage 4] Using pre-transcribed on-device text:', currentText);
      handleVoiceComplete(currentText);
      return;
    }

    // If audio was recorded without live speech text, transcribe via Gemini cloud backend (Expo Go fallback only)
    if (recordedUri && !hasSpeechRecognition) {
      setVoiceState('thinking');
      try {
        console.log('[AI Assistant Voice Stage 4: Cloud Transcription] Reading audio file into base64...');
        
        let base64Audio = '';
        try {
          const LegacyFS = require('expo-file-system/legacy');
          base64Audio = await LegacyFS.readAsStringAsync(recordedUri, { encoding: 'base64' });
        } catch {
          try {
            const { File: ExpoFile } = require('expo-file-system');
            const f = new ExpoFile(recordedUri);
            base64Audio = await f.base64();
          } catch {}
        }

        console.log('[AI Assistant Voice Stage 4] Encoded audio base64 length:', base64Audio ? base64Audio.length : 0);

        if (base64Audio) {
          console.log('[AI Assistant Voice Stage 4] Sending base64 audio to Supabase ai-assistant edge function...');
          const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-assistant`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              audioBase64: base64Audio,
              mimeType: 'audio/mp4',
            }),
          });

          console.log('[AI Assistant Voice Stage 4] Edge function HTTP status:', res.status);
          if (res.ok) {
            const data = await res.json();
            console.log('[AI Assistant Voice Stage 4] Transcribed response from Supabase:', JSON.stringify(data));
            const recognizedText = data.query || (data.intent ? data.message : null);
            if (recognizedText && !processingRef.current) {
              setVoiceTranscript(recognizedText);
              voiceTranscriptRef.current = recognizedText;
              handleVoiceComplete(recognizedText);
              return;
            } else if (data.message && !processingRef.current) {
              // Spoken greeting/fallback from Gemini
              console.log('[AI Assistant Voice Stage 6] Playing default assistant greeting:', data.message);
              setVoiceState('speaking');
              await geminiLiveAudio.speakWithVoice(data.message, () => {
                setVoiceState('idle');
                processingRef.current = false;
              });
              return;
            }
          }
        }
      } catch (transcribeErr) {
        console.error('[AI Assistant Voice Error] Transcription error:', transcribeErr);
      }
    }

    // Stop audio playback
    geminiLiveAudio.stop();
    setVoiceState('idle');
    processingRef.current = false;
  }, [voiceTranscript, handleVoiceComplete]);

  // ─── Start voice ──────────────────────────────────────────────────────────
  const startVoiceInput = useCallback(async () => {
    console.log('[AI Assistant Voice Stage 1: Mic Tapped] User tapped mic button. Current state:', voiceState);
    if (voiceState === 'listening') {
      console.log('[AI Assistant Voice] State is listening -> stopping to process audio');
      await stopVoiceInput();
      return;
    }
    if (voiceState === 'speaking' || voiceState === 'thinking') {
      console.log('[AI Assistant Voice] Cancelling ongoing speech/thinking');
      geminiLiveAudio.stop();
      voiceService.stop();
      processingRef.current = false;
      setVoiceState('idle');
      return;
    }

    // ── Request Microphone Permission Explicitly ────────────────────────────
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        if (navigator?.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((track) => track.stop());
          console.log('[AI Assistant Voice Stage 1] Web microphone permission granted');
        }
      } catch (err) {
        console.warn('[AI Assistant Voice Stage 1] Web microphone permission error:', err);
        Alert.alert(
          'Microphone Access',
          'Please allow microphone access in your browser settings to speak to the assistant.'
        );
      }
    } else {
      try {
        console.log('[AI Assistant Voice Stage 1] Requesting Audio permission on native...');
        const { granted } = await Audio.requestPermissionsAsync();
        console.log('[AI Assistant Voice Stage 1] Native audio permission granted:', granted);
        if (!granted) {
          Alert.alert(
            'Microphone Permission Required',
            'Please allow microphone permission to talk with the AI assistant.'
          );
          setVoiceState('idle');
          return;
        }
      } catch (err) {
        console.warn('[AI Assistant Voice Stage 1] Audio permission request failed:', err);
      }
    }

    setVoiceState('listening');
    setVoiceTranscript('');
    voiceTranscriptRef.current = '';
    processingRef.current = false;

    // 1. Try Native Speech Recognition (100% On-Device in APK)
    if (hasSpeechRecognition && ExpoSpeechRecognitionModule) {
      try {
        console.log('[AI Assistant Voice Stage 2] Attempting ExpoSpeechRecognitionModule.start...');
        const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (granted) {
          await ExpoSpeechRecognitionModule.start({
            lang: 'en-US',
            interimResults: true,
            maxAlternatives: 1,
            continuous: false,
            contextualStrings: [
              'flight', 'flights', 'hotel', 'hotels', 'celebrity', 'video wish',
              'recharge', 'electricity', 'water', 'gas', 'bill', 'bills',
              'bus', 'wallet', 'balance', 'music', 'song', 'occasions',
            ],
          });
          console.log('[AI Assistant Voice Stage 2] ExpoSpeechRecognitionModule started successfully');
          return;
        }
      } catch (err) {
        console.log('[AI Assistant Voice Stage 2] ExpoSpeechRecognitionModule error:', err);
      }
    }

    // 2. Try Web SpeechRecognition
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const SpeechCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechCtor) {
        try {
          console.log('[AI Assistant Voice Stage 2] Starting Web SpeechRecognition...');
          const rec = new SpeechCtor();
          rec.continuous = false;
          rec.interimResults = true;
          rec.lang = 'en-US';
          rec.maxAlternatives = 1;
          webRecogRef.current = rec;

          rec.onstart = () => {
            console.log('[AI Assistant Voice Stage 2] Web SpeechRecognition onstart');
            setVoiceState('listening');
          };
          rec.onresult = (e: any) => {
            const current = Array.from(e.results).map((r: any) => r[0].transcript).join('');
            console.log('[AI Assistant Voice Stage 4] Web SpeechRecognition onresult:', current);
            setVoiceTranscript(current);
            if (e.results[0]?.isFinal) {
              rec.stop();
              handleVoiceComplete(current);
            }
          };
          rec.onerror = (e: any) => {
            console.warn('[AI Assistant Voice Error] Web SpeechRecognition onerror:', e);
            setVoiceState('idle');
          };
          rec.onend = () => {
            console.log('[AI Assistant Voice Stage 3] Web SpeechRecognition onend');
            setVoiceTranscript((prev) => {
              if (prev.trim() && !processingRef.current) handleVoiceComplete(prev);
              else setVoiceState((st) => (st === 'listening' ? 'idle' : st));
              return prev;
            });
          };
          rec.start();
          return;
        } catch (err) {
          console.warn('[AI Assistant Voice Error] Web SpeechRecognition start failed:', err);
        }
      }
    }

    // 3. Fallback: Native Audio Recording via expo-av (Expo Go compatible)
    try {
      console.log('[AI Assistant Voice Stage 2: Recording Started] Initializing expo-av Audio.Recording...');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.LOW_QUALITY
      );
      recordingRef.current = recording;
      setVoiceState('listening');
      console.log('[AI Assistant Voice Stage 2] expo-av Audio.Recording active with low-latency speech profile...');
      return;
    } catch (err) {
      console.warn('[AI Assistant Voice Error] expo-av Recording createAsync failed:', err);
    }

    // Stay listening so user can speak/send
    setVoiceState('listening');
  }, [voiceState, voiceTranscript, stopVoiceInput, handleVoiceComplete]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, isTyping, pendingConfirm]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    sendMessage(text);
  }, [input, sendMessage]);

  const handleSuggestion = useCallback((s: string) => { sendMessage(s); }, [sendMessage]);
  const handleQuickStart = useCallback((query: string) => { sendMessage(query); }, [sendMessage]);

  const inputBarPaddingBottom = keyboardVisible ? 16 : Math.max(16, insets.bottom);

  return (
    <View style={[styles.container, { backgroundColor: '#0D1117' }]}>

      {/* ── Clean Minimal Header: sparkles logo + trash + X ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        {/* Animated sparkles/mic logo — tap to start/stop voice */}
        <TouchableOpacity onPress={startVoiceInput} activeOpacity={0.8}>
          <LinearGradient
            colors={
              voiceState === 'listening'  ? ['#E8527A', '#B44CFF']
              : voiceState === 'thinking' ? ['#F59E0B', '#EF4444']
              : voiceState === 'speaking' ? ['#10B981', '#3B82F6']
              : ['#3B82F6', '#8B5CF6', '#EC4899']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatar}
          >
            <Icon
              name={
                voiceState === 'listening' ? 'mic'
                : voiceState === 'speaking' ? 'volume-2'
                : 'sparkles'
              }
              size={24}
              color="#fff"
            />
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        {/* Trash — clear chat */}
        <TouchableOpacity onPress={clearMessages} style={styles.headerAction}>
          <Icon name="trash-2" size={18} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>

        {/* X — close */}
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Icon name="x" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Agent status bar */}
      {isAgentExecuting && (
        <AgentStatusBar
          label={agentStepLabel || 'Working...'}
          completedSteps={completedSteps}
          onCancel={cancelAgent}
        />
      )}

      {/* Content */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <LinearGradient
                colors={['#FF6B33', '#EC4899', '#B44CFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyAvatar}
              >
                <Icon name="sparkles" size={32} color="#fff" />
              </LinearGradient>
              <Text style={styles.emptyTitle}>What can I do for you?</Text>
              <Text style={styles.emptySubtitle}>
                I can book celebrity wishes, flights, hotels, pay bills,{'\n'}generate music, and much more!
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.quickStartScroll}
                contentContainerStyle={styles.quickStartRow}
              >
                {QUICK_STARTS.map((qs, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.quickChip}
                    onPress={() => handleQuickStart(qs.query)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.quickChipText}>{qs.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : (
            messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} onSuggestion={handleSuggestion} />
            ))
          )}

          {isTyping && <TypingIndicator />}

          {pendingConfirm && (
            <ConfirmCard message={pendingConfirm} onConfirm={confirmAgentStep} onCancel={cancelAgent} />
          )}
        </ScrollView>

        {/* Input bar */}
        <View style={[styles.inputBar, { paddingBottom: inputBarPaddingBottom }]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={
              voiceState === 'listening'
                ? voiceTranscript
                  ? `🎙️ "${voiceTranscript}"`
                  : '🎙️ Listening... speak now'
                : voiceState === 'thinking'
                ? '⚡ Processing...'
                : isAgentExecuting
                ? 'Agent is working...'
                : 'Type or tap 🎙️ to speak...'
            }
            placeholderTextColor="rgba(255,255,255,0.35)"
            returnKeyType="send"
            onSubmitEditing={handleSend}
            multiline={false}
            editable={!isAgentExecuting && voiceState === 'idle'}
          />
          <TouchableOpacity
            onPress={isAgentExecuting ? cancelAgent : (input.trim() ? handleSend : startVoiceInput)}
            activeOpacity={0.8}
          >
            {isAgentExecuting ? (
              <View style={[styles.sendBtn, { backgroundColor: '#EF4444' }]}>
                <Icon name="x" size={16} color="#fff" />
              </View>
            ) : input.trim() ? (
              <LinearGradient
                colors={['#FF6B33', '#B44CFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sendBtn}
              >
                <Icon name="send" size={18} color="#fff" />
              </LinearGradient>
            ) : (
              <View style={[styles.sendBtn, { backgroundColor: voiceState === 'listening' ? '#EF4444' : '#2563EB' }]}>
                <Icon name={voiceState === 'listening' ? 'mic-off' : 'mic'} size={18} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  headerAction: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },

  agentBar: { marginHorizontal: 12, marginVertical: 8, borderRadius: 12, overflow: 'hidden' },
  agentBarGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  agentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  agentBarLabel: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  agentBarSub: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  agentCancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 9999 },
  agentCancelText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontFamily: 'Inter_500Medium' },

  confirmCard: { backgroundColor: '#1C2438', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,107,51,0.3)', padding: 18, marginBottom: 12, gap: 12 },
  confirmMsg: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 21 },
  confirmBtns: { flexDirection: 'row', gap: 10 },
  confirmCancelBtn: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  confirmCancelText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontFamily: 'Inter_500Medium' },
  confirmOkBtn: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingHorizontal: 16 },
  confirmOkText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, flexGrow: 1 },

  emptyState: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyAvatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { color: '#fff', fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 6 },
  emptySubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 24, textAlign: 'center', lineHeight: 20 },
  quickStartScroll: { flexShrink: 0, flexGrow: 0 },
  quickStartRow: { gap: 10, paddingHorizontal: 4, alignItems: 'center', flexWrap: 'wrap' },
  quickChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 8,
  },
  quickChipText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_500Medium' },

  agentBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  agentBadgeText: { color: '#FF6B33', fontSize: 10, fontFamily: 'Inter_600SemiBold' },

  userBubbleWrap: { alignItems: 'flex-end', marginBottom: 12 },
  userBubble: { maxWidth: '88%', borderRadius: 20, borderBottomRightRadius: 4, paddingHorizontal: 18, paddingVertical: 12 },
  userText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 22 },

  assistantBubbleWrap: { alignItems: 'flex-start', marginBottom: 12 },
  assistantBubble: {
    backgroundColor: '#1C2438', borderRadius: 16, borderBottomLeftRadius: 4,
    paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)', maxWidth: '92%',
  },
  assistantText: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 22 },

  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999,
    backgroundColor: '#1C2438', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  actionBtnText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: 'Inter_500Medium' },

  suggestionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  suggestionChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999,
    backgroundColor: '#1C2438', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  suggestionText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: 'Inter_400Regular' },

  typingWrap: { alignItems: 'flex-start', marginBottom: 12 },
  typingDots: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 4, paddingVertical: 4 },
  typingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },

  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)', backgroundColor: '#0D1117',
  },
  input: {
    flex: 1, fontSize: 16, fontFamily: 'Inter_400Regular', color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10, minHeight: 44,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.08)' },
});
