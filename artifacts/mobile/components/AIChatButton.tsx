import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { useAIAssistant } from '@/context/AIAssistantContext';

export function AIChatButton() {
  const { openChat, messages, isOpen } = useAIAssistant();
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.5],
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.15, 0],
  });

  const hasUnread = messages.length > 0 && !isOpen;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Pulse ring */}
      <Animated.View
        style={[
          styles.pulse,
          {
            transform: [{ scale: pulseScale }],
            opacity: pulseOpacity,
          },
        ]}
      >
        <LinearGradient
          colors={['#FF6B33', '#EC4899', '#B44CFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.pulseGradient}
        />
      </Animated.View>

      {/* Button */}
      <TouchableOpacity
        onPress={openChat}
        activeOpacity={0.85}
        style={styles.buttonWrap}
      >
        <LinearGradient
          colors={['#FF6B33', '#EC4899', '#B44CFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.button}
        >
          <Icon name="sparkles" size={22} color="#fff" />
        </LinearGradient>

        {hasUnread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    </View>
  );
}

const BTN = 56;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90,
    right: 16,
    width: BTN,
    height: BTN,
    zIndex: 9998,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    overflow: 'hidden',
  },
  pulseGradient: {
    flex: 1,
    borderRadius: BTN / 2,
  },
  buttonWrap: {
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    shadowColor: '#FF6B33',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  button: {
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#0A0D14',
  },
});
