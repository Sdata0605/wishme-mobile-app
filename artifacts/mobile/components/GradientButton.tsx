import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  colors?: string[];
  style?: ViewStyle;
  textStyle?: object;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  height?: number;
}

export function GradientButton({
  title,
  onPress,
  colors = ['#FF6B33', '#B44CFF'],
  style,
  textStyle,
  disabled,
  loading,
  icon,
  height = 52,
}: GradientButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [{ opacity: pressed || disabled ? 0.65 : 1 }, style]}
    >
      <LinearGradient
        colors={colors as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.gradient, { height }]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            {icon}
            <Text style={[styles.text, textStyle]}>{title}</Text>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gradient: {
    borderRadius: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.2,
  },
});
