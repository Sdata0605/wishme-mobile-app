import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import {
  Mic,
  MicOff,
  Radio,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react-native';
import { geminiLiveAudio } from '@/services/geminiLiveService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface FloatingVoiceAssistantProps {
  currentStepTitle?: string;
  assistantPrompt: string;
  onUserSpeech?: (speech: string) => void;
  onClose?: () => void;
}

export function FloatingVoiceAssistant({
  currentStepTitle = 'Gemini Live Assistant',
  assistantPrompt,
  onUserSpeech,
  onClose,
}: FloatingVoiceAssistantProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(geminiLiveAudio.getIsMuted());
  const [userTranscript, setUserTranscript] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [textMessage, setTextMessage] = useState('');

  // Wave & pulse animations
  const wave1 = useRef(new Animated.Value(1)).current;
  const wave2 = useRef(new Animated.Value(1)).current;
  const wave3 = useRef(new Animated.Value(1)).current;
  const wave4 = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const recordingRef = useRef<Audio.Recording | null>(null);
  const recognitionRef = useRef<any>(null);

  // Gemini speaking listener
  useEffect(() => {
    const unsub = geminiLiveAudio.addSpeakingListener((speaking) => {
      setIsSpeaking(speaking);
    });
    return () => {
      unsub();
    };
  }, []);

  // Whenever prompt updates, speak with Gemini "Glow"
  useEffect(() => {
    if (assistantPrompt) {
      geminiLiveAudio.playGeminiVoice(assistantPrompt);
    }
  }, [assistantPrompt]);

  // Audio wave equalizer animation
  useEffect(() => {
    if (isSpeaking) {
      const animateWave = (anim: Animated.Value, max: number, duration: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: max, duration, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true }),
          ])
        );
      };
      const a1 = animateWave(wave1, 2.2, 280);
      const a2 = animateWave(wave2, 3.0, 340);
      const a3 = animateWave(wave3, 2.6, 300);
      const a4 = animateWave(wave4, 1.8, 260);

      a1.start();
      a2.start();
      a3.start();
      a4.start();
      return () => {
        a1.stop();
        a2.stop();
        a3.stop();
        a4.stop();
      };
    } else {
      wave1.setValue(1);
      wave2.setValue(1);
      wave3.setValue(1);
      wave4.setValue(1);
    }
  }, [isSpeaking, wave1, wave2, wave3, wave4]);

  // Mic Pulse animation
  useEffect(() => {
    if (isListening) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 400, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 400, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1.0);
    }
  }, [isListening, pulseAnim]);

  // Start Voice Listening
  const startListening = async () => {
    try {
      await geminiLiveAudio.stopAudio();
    } catch {}

    setIsListening(true);
    setUserTranscript('Listening to your voice...');

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const rec = new SpeechRecognition();
          rec.lang = 'en-IN';
          rec.continuous = false;
          rec.interimResults = true;

          rec.onresult = (event: any) => {
            const current = event.resultIndex;
            const text = event.results[current][0].transcript;
            setUserTranscript(text);
          };

          rec.onend = () => {
            setIsListening(false);
            if (userTranscript && userTranscript !== 'Listening to your voice...') {
              onUserSpeech?.(userTranscript);
            }
          };

          rec.onerror = () => {
            setIsListening(false);
          };

          rec.start();
          recognitionRef.current = rec;
          return;
        } catch {}
      }
    } else {
      // Native audio recording (Android / iOS)
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
      } catch {}
    }
  };

  // Stop Voice Listening and Process Spoken Turn
  const stopListening = async () => {
    setIsListening(false);

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

    if (userTranscript && userTranscript !== 'Listening to your voice...') {
      onUserSpeech?.(userTranscript);
    } else {
      // If voice captured was empty, notify user to speak clearly
      setUserTranscript('Tap mic and speak your command');
    }
  };

  const handleSendText = () => {
    if (!textMessage.trim()) return;
    const spoken = textMessage.trim();
    setTextMessage('');
    setUserTranscript(spoken);
    onUserSpeech?.(spoken);
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    geminiLiveAudio.setMuted(next);
    if (!next && assistantPrompt) {
      geminiLiveAudio.playGeminiVoice(assistantPrompt);
    }
  };

  return (
    <View style={s.overlayWrap}>
      <LinearGradient
        colors={['#0F172A', '#1E1B4B', '#111827']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.container}
      >
        {/* Top Header Row */}
        <View style={s.topRow}>
          <View style={s.badge}>
            <Sparkles size={13} color="#F59E0B" />
            <Text style={s.badgeText}>{currentStepTitle.toUpperCase()}</Text>
          </View>

          {/* Voice status & frequency waves */}
          <View style={s.waveContainer}>
            <Animated.View style={[s.waveBar, { transform: [{ scaleY: wave1 }] }]} />
            <Animated.View style={[s.waveBar, { transform: [{ scaleY: wave2 }] }]} />
            <Animated.View style={[s.waveBar, { transform: [{ scaleY: wave3 }] }]} />
            <Animated.View style={[s.waveBar, { transform: [{ scaleY: wave4 }] }]} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={toggleMute} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              {isMuted ? (
                <VolumeX size={18} color="rgba(255,255,255,0.6)" />
              ) : (
                <Volume2 size={18} color="#10B981" />
              )}
            </TouchableOpacity>
            {onClose && (
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={18} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Gemini Voice Message */}
        <View style={s.messageBox}>
          <Text style={s.promptText}>{assistantPrompt}</Text>
        </View>

        {/* User Speech Transcript */}
        {userTranscript ? (
          <View style={s.userTranscriptBox}>
            <Text style={s.userTranscriptLabel}>YOU SPOKE:</Text>
            <Text style={s.userTranscriptText}>&ldquo;{userTranscript}&rdquo;</Text>
          </View>
        ) : null}

        {/* Voice Control Bar */}
        <View style={s.controlsRow}>
          {/* Status Label */}
          <View style={s.statusPill}>
            <Radio size={12} color={isListening ? '#EF4444' : isSpeaking ? '#38BDF8' : '#94A3B8'} />
            <Text style={s.statusPillText}>
              {isListening
                ? 'LISTENING TO YOU...'
                : isSpeaking
                ? 'GEMINI GLOW SPEAKING'
                : 'SPEAK OR TAP MIC'}
            </Text>
          </View>

          {/* Glowing Microphone Trigger */}
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={[s.micButton, isListening && s.micButtonActive]}
              activeOpacity={0.8}
              onPress={isListening ? stopListening : startListening}
            >
              <LinearGradient
                colors={
                  isListening
                    ? ['#EF4444', '#DC2626']
                    : ['#2563EB', '#7C3AED']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.micGradient}
              >
                {isListening ? (
                  <MicOff size={22} color="#FFFFFF" />
                ) : (
                  <Mic size={22} color="#FFFFFF" />
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Optional text input bar */}
        {showTextInput ? (
          <View style={s.textInputRow}>
            <TextInput
              style={s.inputField}
              placeholder="Or type here (e.g. Pune to Mumbai)..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={textMessage}
              onChangeText={setTextMessage}
              onSubmitEditing={handleSendText}
            />
            {textMessage.trim() ? (
              <TouchableOpacity style={s.sendBtn} onPress={handleSendText}>
                <Send size={15} color="#FFFFFF" />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <TouchableOpacity
            style={s.typeToggle}
            onPress={() => setShowTextInput(true)}
            activeOpacity={0.7}
          >
            <Text style={s.typeToggleText}>Prefer typing? Tap to enter text</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  overlayWrap: {
    position: 'absolute',
    bottom: 20,
    left: 12,
    right: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 9999,
  },
  container: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#F59E0B',
    letterSpacing: 0.6,
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 16,
  },
  waveBar: {
    width: 3,
    height: 12,
    backgroundColor: '#38BDF8',
    borderRadius: 2,
  },
  messageBox: {
    marginBottom: 6,
  },
  promptText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#F8FAFC',
    lineHeight: 19,
  },
  userTranscriptBox: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#38BDF8',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginBottom: 8,
  },
  userTranscriptLabel: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: '#38BDF8',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  userTranscriptText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#E2E8F0',
    fontStyle: 'italic',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusPillText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#CBD5E1',
    letterSpacing: 0.5,
  },
  micButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  micButtonActive: {
    shadowColor: '#EF4444',
  },
  micGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inputField: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#FFFFFF',
    paddingVertical: 4,
  },
  sendBtn: {
    backgroundColor: '#3B82F6',
    padding: 6,
    borderRadius: 8,
    marginLeft: 6,
  },
  typeToggle: {
    alignItems: 'center',
    marginTop: 8,
  },
  typeToggleText: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255, 255, 255, 0.45)',
    textDecorationLine: 'underline',
  },
});
