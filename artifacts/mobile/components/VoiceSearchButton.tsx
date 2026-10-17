/** The mic in a search box: tap to search by voice, tap again to stop. Glows on the brand gradient while listening. */
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { BRAND } from '@/constants/neon';

export function VoiceSearchButton({ listening, onPress, idleColor, size = 30 }: { listening: boolean; onPress: () => void; idleColor: string; size?: number }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={listening ? 'Stop voice search' : 'Search by voice'}
      style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}
    >
      {listening ? (
        <LinearGradient colors={[BRAND.pink, BRAND.purple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, styles.center]}>
          <ActivityIndicator size="small" color="#fff" />
        </LinearGradient>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Icon name="mic" size={Math.round(size * 0.6)} color={idleColor} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });
