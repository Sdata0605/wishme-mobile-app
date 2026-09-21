import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '@/components/Icon';

export type GeminiVoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

const VOICE_CHIPS = [
  { label: '🏨 Book a Hotel', query: 'Book a hotel for me' },
  { label: '✈️ Book a Flight', query: 'Book a flight for me' },
  { label: '🚌 Book a Bus', query: 'Book a bus ticket' },
  { label: '💡 Pay Bill', query: 'Pay my electricity bill' },
  { label: '🎬 Celebrity Wish', query: 'Book a celebrity video wish' },
  { label: '💳 Check Wallet', query: 'Check my wallet balance' },
];

interface GeminiVoiceVisualizerProps {
  state: GeminiVoiceState;
  transcript: string;
  onStop: () => void;
  onSend?: () => void;
  onSelectSuggestion?: (query: string) => void;
}

export function GeminiVoiceVisualizer({
  state,
  transcript,
  onStop,
  onSend,
  onSelectSuggestion,
}: GeminiVoiceVisualizerProps) {
  // 5 animated sound bars for the visualizer
  const bar1 = useRef(new Animated.Value(0.3)).current;
  const bar2 = useRef(new Animated.Value(0.5)).current;
  const bar3 = useRef(new Animated.Value(0.8)).current;
  const bar4 = useRef(new Animated.Value(0.4)).current;
  const bar5 = useRef(new Animated.Value(0.6)).current;

  // Pulse & glow aura
  const pulse = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (state === 'listening' || state === 'speaking') {
      const createOscillation = (val: Animated.Value, minH: number, maxH: number, duration: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(val, {
              toValue: maxH,
              duration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(val, {
              toValue: minH,
              duration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ])
        );
      };

      const anim1 = createOscillation(bar1, 0.2, 1.2, 420);
      const anim2 = createOscillation(bar2, 0.3, 1.5, 310);
      const anim3 = createOscillation(bar3, 0.4, 1.8, 480);
      const anim4 = createOscillation(bar4, 0.25, 1.4, 360);
      const anim5 = createOscillation(bar5, 0.3, 1.3, 440);

      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.08, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );

      anim1.start();
      anim2.start();
      anim3.start();
      anim4.start();
      anim5.start();
      pulseLoop.start();

      return () => {
        anim1.stop();
        anim2.stop();
        anim3.stop();
        anim4.stop();
        anim5.stop();
        pulseLoop.stop();
      };
    } else if (state === 'thinking') {
      const spin = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      spin.start();
      return () => spin.stop();
    } else {
      bar1.setValue(0.3);
      bar2.setValue(0.5);
      bar3.setValue(0.7);
      bar4.setValue(0.4);
      bar5.setValue(0.5);
      pulse.setValue(1);
    }
  }, [state]);

  const spinInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const getStatusText = () => {
    switch (state) {
      case 'listening':
        return 'Listening... Speak your request';
      case 'thinking':
        return 'Gemini is thinking...';
      case 'speaking':
        return 'Gemini speaking (Glow voice)...';
      default:
        return 'Tap mic to speak';
    }
  };

  const getStatusColor = () => {
    switch (state) {
      case 'listening':
        return '#38BDF8';
      case 'thinking':
        return '#C084FC';
      case 'speaking':
        return '#34D399';
      default:
        return '#94A3B8';
    }
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: pulse }] }]}>
      <LinearGradient
        colors={['#1E293B', '#0F172A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.innerBox}
      >
        {/* Glow border ring */}
        <LinearGradient
          colors={['#38BDF8', '#818CF8', '#C084FC', '#F472B6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.topGlowBorder}
        />

        <View style={styles.topRow}>
          {/* Status Indicator & Animated Bars */}
          <View style={styles.leftRow}>
            {state === 'thinking' ? (
              <Animated.View style={[styles.iconWrap, { transform: [{ rotate: spinInterpolate }] }]}>
                <Icon name="loader" size={18} color="#C084FC" />
              </Animated.View>
            ) : (
              <View style={styles.waveBarsRow}>
                <Animated.View style={[styles.waveBar, { transform: [{ scaleY: bar1 }] }]} />
                <Animated.View style={[styles.waveBar, { transform: [{ scaleY: bar2 }], backgroundColor: '#818CF8' }]} />
                <Animated.View style={[styles.waveBar, { transform: [{ scaleY: bar3 }], backgroundColor: '#C084FC' }]} />
                <Animated.View style={[styles.waveBar, { transform: [{ scaleY: bar4 }], backgroundColor: '#F472B6' }]} />
                <Animated.View style={[styles.waveBar, { transform: [{ scaleY: bar5 }] }]} />
              </View>
            )}

            <View style={{ marginLeft: 10, flex: 1 }}>
              <View style={styles.badgeRow}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
                <Text style={[styles.statusLabel, { color: getStatusColor() }]}>
                  {getStatusText()}
                </Text>
              </View>
              <Text style={styles.transcriptText} numberOfLines={2}>
                {transcript ? `"${transcript}"` : 'Listening... Say e.g. "Book a flight for me"'}
              </Text>
            </View>
          </View>

          {/* Action controls */}
          <View style={styles.actionBtns}>
            {transcript && state === 'listening' && onSend ? (
              <TouchableOpacity style={styles.sendChip} onPress={onSend} activeOpacity={0.8}>
                <LinearGradient
                  colors={['#38BDF8', '#818CF8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.sendChipGrad}
                >
                  <Icon name="send" size={13} color="#fff" />
                  <Text style={styles.sendChipText}>Send</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity style={styles.stopBtn} onPress={onStop} activeOpacity={0.8}>
              <Icon name="x" size={15} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Voice Chips */}
        {state === 'listening' && onSelectSuggestion ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
            style={styles.chipsScroll}
          >
            {VOICE_CHIPS.map((chip, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.chipBtn}
                onPress={() => onSelectSuggestion(chip.query)}
                activeOpacity={0.75}
              >
                <Text style={styles.chipText}>{chip.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chipsScroll: {
    marginTop: 10,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  chipsRow: {
    gap: 8,
    paddingRight: 8,
  },
  chipBtn: {
    backgroundColor: 'rgba(56,189,248,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  chipText: {
    color: '#38BDF8',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  container: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  innerBox: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.3)',
    position: 'relative',
  },
  topGlowBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  waveBarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 26,
    paddingHorizontal: 4,
  },
  waveBar: {
    width: 3.5,
    height: 18,
    borderRadius: 2,
    backgroundColor: '#38BDF8',
  },
  iconWrap: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.2,
  },
  transcriptText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#F8FAFC',
    marginTop: 2,
  },
  actionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  sendChip: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  sendChipGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sendChipText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  stopBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
