import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';

/** MyAssistant's screen bar: a back arrow, a Space Grotesk title, an optional action on the right. No divider. */
export function NeonHeader({ title, right, onBack, hideBack }: { title: string; right?: React.ReactNode; onBack?: () => void; hideBack?: boolean }) {
  const { neon } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
      {hideBack ? null : (
        <Pressable
          onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/(tabs)' as never)))}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.back}
        >
          <Icon name="arrow-left" size={22} color={neon.textHi} />
        </Pressable>
      )}
      <Text style={[styles.title, { color: neon.textHi }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{title}</Text>
      <View>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 10 },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 22, fontFamily: 'PlayfairDisplay_700Bold', letterSpacing: -0.4 },
});
