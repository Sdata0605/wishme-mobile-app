import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Entrance animation (Flutter: design/motion.dart Reveal): 380ms ease-out-cubic, fades in, rises 14px and settles
 * from 0.985 scale. Plays once when it mounts, after `delayMs`, and never again.
 */
export function Reveal({ delayMs = 0, children, style }: { delayMs?: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 380, delay: delayMs, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, delayMs]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Shrinks to 0.96 over 110ms while pressed (Flutter: PressScale). */
export function PressScale({ children, style, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.timing(scale, { toValue: v, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      <Pressable {...rest} onPressIn={() => to(0.96)} onPressOut={() => to(1)}>
        {children}
      </Pressable>
    </Animated.View>
  );
}
