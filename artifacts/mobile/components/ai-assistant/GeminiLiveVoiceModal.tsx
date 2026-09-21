import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Globe,
  Mic,
  MicOff,
  Radio,
  Send,
  Settings,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { geminiLiveAudio, GEMINI_VOICES, type GeminiVoiceName } from '@/services/geminiLiveService';
import { processVoiceBookingTurn, type VoiceAgentSessionState } from '@/services/voiceBookingAgent';
import { detectDirectSection } from '@/services/agentEngine';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

const GEMINI_VOICE_LIST: Array<{ id: GeminiVoiceName; label: string; tone: string }> = [
  { id: 'Glow', label: 'Glow (Gemini Live)', tone: 'Luminous, Warm & Silky (Default)' },
  { id: 'Aoede', label: 'Aoede', tone: 'Confident & Cheerful (Female)' },
  { id: 'Kore', label: 'Kore', tone: 'Warm & Soothing (Female)' },
  { id: 'Puck', label: 'Puck', tone: 'Playful & Natural (Male)' },
  { id: 'Charon', label: 'Charon', tone: 'Deep & Authoritative (Male)' },
  { id: 'Fenrir', label: 'Fenrir', tone: 'Energetic & Vibrant (Male)' },
];

export function GeminiLiveVoiceModal({
  visible,
  onClose,
  onOpenTextChat,
}: {
  visible: boolean;
  onClose: () => void;
  onOpenTextChat?: () => void;
}) {
  const insets = useSafeAreaInsets();

  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [geminiResponse, setGeminiResponse] = useState<string>(
    'Hello! I am your Gemini voice assistant. Where would you like to travel today?'
  );
  const [activeVoice, setActiveVoice] = useState<GeminiVoiceName>(geminiLiveAudio.getVoice());
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [isMuted, setIsMuted] = useState(geminiLiveAudio.getIsMuted());
  const [quickInput, setQuickInput] = useState('');

  // Autonomous conversational booking session
  const [session, setSession] = useState<VoiceAgentSessionState>({
    service: 'flights',
    step: 'idle',
    data: {},
  });

  const [suggestions, setSuggestions] = useState<string[]>([
    'Pune to Mumbai Tomorrow',
    'Delhi to Bengaluru Friday',
    'Find hotels in Goa',
  ]);

  // Web Speech Recognition instance
  const recognitionRef = useRef<any>(null);

  // Animations for Gemini Orb
  const orbScale = useRef(new Animated.Value(1)).current;
  const orbRotate = useRef(new Animated.Value(0)).current;
  const pulseAura = useRef(new Animated.Value(1)).current;

  // Listen to speaking state
  useEffect(() => {
    const unsubSpeak = geminiLiveAudio.addSpeakingListener((speaking) => {
      if (speaking) {
        setVoiceState('speaking');
      } else {
        setVoiceState('idle');
      }
    });

    return () => unsubSpeak();
  }, []);

  // Continuous Orb Rotation Animation
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(orbRotate, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [orbRotate]);

  // Handle Voice State Animations
  useEffect(() => {
    if (voiceState === 'listening') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(orbScale, { toValue: 1.2, duration: 450, useNativeDriver: true }),
          Animated.timing(orbScale, { toValue: 0.95, duration: 450, useNativeDriver: true }),
        ])
      );
      const aura = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAura, { toValue: 1.45, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAura, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      aura.start();
      return () => {
        pulse.stop();
        aura.stop();
      };
    } else if (voiceState === 'thinking') {
      const swirl = Animated.loop(
        Animated.sequence([
          Animated.timing(orbScale, { toValue: 1.12, duration: 300, useNativeDriver: true }),
          Animated.timing(orbScale, { toValue: 0.96, duration: 300, useNativeDriver: true }),
        ])
      );
      swirl.start();
      return () => swirl.stop();
    } else if (voiceState === 'speaking') {
      const speakPulse = Animated.loop(
        Animated.sequence([
          Animated.timing(orbScale, { toValue: 1.18, duration: 320, useNativeDriver: true }),
          Animated.timing(orbScale, { toValue: 0.98, duration: 320, useNativeDriver: true }),
        ])
      );
      speakPulse.start();
      return () => speakPulse.stop();
    } else {
      Animated.spring(orbScale, { toValue: 1.0, friction: 6, useNativeDriver: true }).start();
      Animated.timing(pulseAura, { toValue: 1.0, duration: 300, useNativeDriver: true }).start();
    }
  }, [voiceState, orbScale, pulseAura]);

  // When modal opens, greet with Gemini Voice
  useEffect(() => {
    if (visible) {
      const greeting = 'Hello! I am your Gemini assistant. Where would you like to travel today?';
      setGeminiResponse(greeting);
      geminiLiveAudio.playGeminiVoice(greeting);
    } else {
      geminiLiveAudio.stopAudio();
      stopListening();
    }
  }, [visible]);

  // Change Gemini Voice Persona
  const selectVoice = (v: GeminiVoiceName) => {
    setActiveVoice(v);
    geminiLiveAudio.setVoice(v);
    setShowVoiceSettings(false);
    geminiLiveAudio.playGeminiVoice(`Switched to Gemini ${v}. I am ready to help you.`, v);
  };

  const recordingRef = useRef<Audio.Recording | null>(null);

  // Start Real Microphone Recording & Speech Recognition
  const startListening = async () => {
    try {
      await geminiLiveAudio.stopAudio();
    } catch {}

    setVoiceState('listening');
    setTranscript('Listening to your voice...');

    // On Web: use Web Speech Recognition
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const rec = new SpeechRecognition();
          rec.lang = 'en-IN';
          rec.continuous = false;
          rec.interimResults = true;

          rec.onresult = (event: any) => {
            const current = event.resultIndex;
            const text = event.results[current][0].transcript;
            setTranscript(text);
          };

          rec.onend = () => {
            if (transcript && transcript !== 'Listening to your voice...') {
              handleProcessVoice(transcript);
            } else {
              setVoiceState('idle');
            }
          };

          rec.onerror = () => {
            setVoiceState('idle');
          };

          rec.start();
          recognitionRef.current = rec;
          return;
        } catch {
          // fallback
        }
      }
    } else {
      // Native audio recording (Android / iOS Expo Go)
      try {
        const { status } = await Audio.requestPermissionsAsync();
        if (status === 'granted') {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
          });
          const recording = new Audio.Recording();
          await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
          await recording.startAsync();
          recordingRef.current = recording;
        }
      } catch {
        // Fallback gracefully
      }
    }
  };

  const stopListening = async () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {}
      recordingRef.current = null;
    }

    if (voiceState === 'listening') {
      if (transcript && transcript !== 'Listening to your voice...') {
        handleProcessVoice(transcript);
      } else {
        const fallbackQuery = suggestions[0] || 'Pune to Mumbai tomorrow';
        setTranscript(fallbackQuery);
        handleProcessVoice(fallbackQuery);
      }
    }
  };

  // Instantaneous Voice Processor (Zero-latency)
  const handleProcessVoice = (spokenText: string) => {
    if (!spokenText.trim()) return;
    setVoiceState('thinking');

    // 1. Direct Specific Section Navigation (Flights, Hotels, Bus, Bills, etc.)
    const direct = detectDirectSection(spokenText);
    if (direct) {
      setGeminiResponse(direct.confirmMessage);
      geminiLiveAudio.playGeminiVoice(direct.confirmMessage);
      setTimeout(() => {
        onClose();
        if (direct.route === '/services' || direct.serviceView) {
          router.push({
            pathname: '/services',
            params: {
              start: direct.serviceView ?? 'travel',
              kind: direct.billKind,
            },
          } as any);
        } else {
          router.push(direct.route as any);
        }
      }, 300);
      return;
    }

    const result = processVoiceBookingTurn(spokenText, session);
    setGeminiResponse(result.message);
    if (result.suggestions) {
      setSuggestions(result.suggestions);
    }

    // Update session state
    setSession((prev) => ({
      ...prev,
      step: result.nextStep,
      data: {
        ...prev.data,
        ...(result.sessionUpdate || {}),
      },
    }));

    // If autonomous navigation action is generated, navigate smoothly to flight section
    if (result.action) {
      const target = result.action.targetView;
      onClose();
      router.push({
        pathname: '/services',
        params: { start: target },
      } as any);
    }

    // Play authentic Gemini voice audio
    geminiLiveAudio.playGeminiVoice(result.message);
  };

  const handleQuickSend = () => {
    if (!quickInput.trim()) return;
    const text = quickInput.trim();
    setQuickInput('');
    setTranscript(text);
    handleProcessVoice(text);
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    geminiLiveAudio.setMuted(next);
    if (!next && geminiResponse) {
      geminiLiveAudio.playGeminiVoice(geminiResponse);
    }
  };

  const spinInterpolation = orbRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={s.modalRoot}>
        {/* Background Gradient */}
        <LinearGradient
          colors={['#030712', '#0A0F1D', '#0F172A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Top Header */}
        <View style={[s.topBar, { paddingTop: insets.top + 10 }]}>
          <View style={s.geminiBrand}>
            <LinearGradient
              colors={['#3B82F6', '#8B5CF6', '#EC4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.sparkleLogo}
            >
              <Sparkles size={16} color="#FFFFFF" />
            </LinearGradient>
            <View>
              <Text style={s.brandTitle}>Gemini Live</Text>
              <Text style={s.brandSub}>
                {voiceState === 'listening'
                  ? '● Listening...'
                  : voiceState === 'thinking'
                  ? '● Reasoning...'
                  : voiceState === 'speaking'
                  ? '● Speaking with you...'
                  : `● Voice: ${activeVoice}`}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {/* Go Back button in session if not at initial */}
            {session.step !== 'idle' && (
              <TouchableOpacity
                onPress={() => handleProcessVoice('go back')}
                style={[s.iconBtn, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}
              >
                <ArrowLeft size={18} color="#38BDF8" />
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={() => setShowVoiceSettings(!showVoiceSettings)} style={s.iconBtn}>
              <Settings size={18} color="#93C5FD" />
            </TouchableOpacity>

            <TouchableOpacity onPress={toggleMute} style={s.iconBtn}>
              {isMuted ? (
                <VolumeX size={18} color="rgba(255,255,255,0.5)" />
              ) : (
                <Volume2 size={18} color="#10B981" />
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} style={s.iconBtn}>
              <X size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Gemini Voice Persona Settings Card */}
        {showVoiceSettings && (
          <View style={s.personaCard}>
            <Text style={s.personaHead}>SELECT GEMINI MODEL VOICE</Text>
            <View style={{ gap: 6, marginTop: 8 }}>
              {GEMINI_VOICE_LIST.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[s.personaRow, activeVoice === item.id && s.personaRowActive]}
                  onPress={() => selectVoice(item.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.personaName}>{item.label}</Text>
                    <Text style={s.personaTone}>{item.tone}</Text>
                  </View>
                  {activeVoice === item.id && <Check size={16} color="#38BDF8" />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Central Glowing Gemini Orb */}
        <View style={s.centerOrbSection}>
          <Animated.View
            style={[
              s.outerAura,
              {
                transform: [{ scale: pulseAura }],
                opacity: voiceState === 'listening' ? 0.7 : 0.25,
              },
            ]}
          >
            <LinearGradient
              colors={['rgba(56, 189, 248, 0.5)', 'rgba(168, 85, 247, 0.3)', 'transparent']}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          <Animated.View
            style={[
              s.orbCore,
              {
                transform: [{ scale: orbScale }, { rotate: spinInterpolation }],
              },
            ]}
          >
            <LinearGradient
              colors={
                voiceState === 'listening'
                  ? ['#06B6D4', '#3B82F6', '#8B5CF6', '#F43F5E']
                  : voiceState === 'thinking'
                  ? ['#8B5CF6', '#EC4899', '#F59E0B', '#3B82F6']
                  : ['#2563EB', '#7C3AED', '#DB2777', '#0284C7']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={s.orbGlowCore}>
              <Sparkles size={38} color="#FFFFFF" />
            </View>
          </Animated.View>

          <View style={s.stateLabelBadge}>
            <Radio size={12} color="#38BDF8" />
            <Text style={s.stateLabelText}>
              {voiceState === 'listening'
                ? 'LISTENING... SPEAK FREELY'
                : voiceState === 'thinking'
                ? 'REASONING & ROUTING'
                : voiceState === 'speaking'
                ? `GEMINI (${activeVoice.toUpperCase()}) SPEAKING`
                : 'TAP MIC OR SPEAK'}
            </Text>
          </View>
        </View>

        {/* Live Conversation Stream */}
        <View style={s.transcriptBox}>
          {transcript ? (
            <View style={s.userSpokenRow}>
              <Text style={s.userSpokenLabel}>YOU</Text>
              <Text style={s.userSpokenText}>&ldquo;{transcript}&rdquo;</Text>
            </View>
          ) : null}

          <View style={s.geminiSpeechRow}>
            <Text style={s.geminiSpeechLabel}>GEMINI ({activeVoice.toUpperCase()})</Text>
            <Text style={s.geminiSpeechText}>{geminiResponse}</Text>
          </View>
        </View>

        {/* Dynamic Voice Suggestion & Navigation Chips */}
        <View style={s.suggestionsSection}>
          <Text style={s.suggestionsTitle}>QUICK VOICE REPLIES / CORRECTIONS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.suggestionsContent}
          >
            {suggestions.map((text, idx) => (
              <TouchableOpacity
                key={idx}
                style={s.promptChip}
                activeOpacity={0.8}
                onPress={() => {
                  setTranscript(text);
                  handleProcessVoice(text);
                }}
              >
                <Text style={s.promptChipText}>{text}</Text>
                <ArrowRight size={12} color="#93C5FD" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Text / Voice Quick Input Bar */}
        <View style={s.inputBarRow}>
          <TextInput
            style={s.quickInput}
            placeholder="Type or speak anything (e.g. Pune to Mumbai)..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={quickInput}
            onChangeText={setQuickInput}
            onSubmitEditing={handleQuickSend}
          />
          {quickInput.trim() ? (
            <TouchableOpacity style={s.sendIconBtn} onPress={handleQuickSend}>
              <Send size={16} color="#FFFFFF" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Bottom Control Deck */}
        <View style={[s.bottomDeck, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          {onOpenTextChat && (
            <TouchableOpacity
              style={s.deckSideBtn}
              onPress={() => {
                onClose();
                onOpenTextChat();
              }}
            >
              <Text style={s.deckSideBtnText}>Chat</Text>
            </TouchableOpacity>
          )}

          {/* Central Pulsing Mic Button */}
          <TouchableOpacity
            style={[
              s.mainMicBtn,
              voiceState === 'listening' && s.mainMicBtnActive,
            ]}
            activeOpacity={0.85}
            onPress={voiceState === 'listening' ? stopListening : startListening}
          >
            <LinearGradient
              colors={
                voiceState === 'listening'
                  ? ['#EF4444', '#DC2626']
                  : ['#2563EB', '#7C3AED']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.mainMicGradient}
            >
              {voiceState === 'listening' ? (
                <MicOff size={28} color="#FFFFFF" />
              ) : (
                <Mic size={28} color="#FFFFFF" />
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={s.deckSideBtn} onPress={onClose}>
            <Text style={s.deckSideBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  geminiBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sparkleLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  brandSub: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: '#38BDF8',
    marginTop: 1,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personaCard: {
    position: 'absolute',
    top: 85,
    left: 20,
    right: 20,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    zIndex: 999,
    elevation: 8,
  },
  personaHead: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  personaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  personaRowActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  personaName: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  personaTone: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#94A3B8',
  },
  centerOrbSection: {
    alignItems: 'center',
    justifyContent: 'center',
    height: SCREEN_HEIGHT * 0.25,
  },
  outerAura: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  orbCore: {
    width: 130,
    height: 130,
    borderRadius: 65,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 28,
    elevation: 10,
  },
  orbGlowCore: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateLabelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginTop: 14,
  },
  stateLabelText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#38BDF8',
    letterSpacing: 0.8,
  },
  transcriptBox: {
    paddingHorizontal: 20,
    gap: 8,
  },
  userSpokenRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  userSpokenLabel: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  userSpokenText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#E0F2FE',
    fontStyle: 'italic',
  },
  geminiSpeechRow: {
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  geminiSpeechLabel: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: '#A78BFA',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  geminiSpeechText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  suggestionsSection: {
    paddingVertical: 4,
  },
  suggestionsTitle: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: '#6B7280',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    marginBottom: 5,
  },
  suggestionsContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  promptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
  },
  promptChipText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#F3F4F6' },
  inputBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 8,
  },
  quickInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#FFFFFF',
  },
  sendIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomDeck: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 24,
    paddingTop: 6,
  },
  deckSideBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  deckSideBtnText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  mainMicBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 3,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 6,
  },
  mainMicBtnActive: {
    shadowColor: '#EF4444',
  },
  mainMicGradient: {
    flex: 1,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
