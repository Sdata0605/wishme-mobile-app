import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';

export default function NotFoundScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Text style={styles.emoji}>✨</Text>
      <Text style={[styles.code, { color: colors.primary }]}>404</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>Page Not Found</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        The page you're looking for doesn't exist or has been moved.
      </Text>
      <Pressable onPress={() => router.replace('/(tabs)')} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
        <LinearGradient colors={['#7B5CFA', '#1F7BFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btn}>
          <Text style={styles.btnText}>Go Home</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emoji: { fontSize: 64, marginBottom: 16 },
  code: { fontSize: 72, fontFamily: 'Inter_700Bold', marginBottom: 8 },
  title: { fontSize: 24, fontFamily: 'PlayfairDisplay_700Bold', marginBottom: 12, textAlign: 'center' },
  subtitle: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  btn: { height: 52, borderRadius: 9999, paddingHorizontal: 48, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
