import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { PressScale } from '@/components/neon/Motion';
import { NeonCard } from '@/components/neon/NeonCard';
import { NeonHeader } from '@/components/neon/NeonHeader';
import { useTheme } from '@/context/ThemeContext';
import { useVoiceAssistant } from '@/context/VoiceAssistantContext';
import { ago } from '@/services/home/news';

/**
 * One news story. Every news tap in the app (the Home card, the News list, the assistant's headlines pop-up) lands here.
 * "Read it to me" asks the assistant to find and read out what the story says.
 */
export default function NewsStoryScreen() {
  const { neon } = useTheme();
  const insets = useSafeAreaInsets();
  const { ask } = useVoiceAssistant();
  const { title = '', source = '', url = '', at = '' } = useLocalSearchParams<{ title?: string; source?: string; url?: string; at?: string }>();
  const when = at ? ago(at) : '';

  const action = (icon: 'globe' | 'audio-lines' | 'share-2', label: string, onPress: () => void, primary = false) => (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[styles.btn, primary ? { backgroundColor: neon.cyan, borderColor: neon.cyan } : { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}>
        <Icon name={icon} size={18} color={primary ? '#04122E' : neon.textHi} />
        <Text style={[styles.btnText, { color: primary ? '#04122E' : neon.textHi }]}>{label}</Text>
      </View>
    </PressScale>
  );

  return (
    <AmbientBackground>
      <NeonHeader title="News" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
        <NeonCard style={{ padding: 20 }} radius={28}>
          <View style={styles.meta}>
            <Icon name="globe" size={14} color={neon.cyan} />
            <Text style={[styles.metaText, { color: neon.cyan }]}>{[source, when].filter(Boolean).join(' · ')}</Text>
          </View>
          <Text style={[styles.title, { color: neon.textHi }]}>{title}</Text>
        </NeonCard>
        <View style={{ gap: 12, marginTop: 18 }}>
          {url ? action('globe', 'Read full story', () => void WebBrowser.openBrowserAsync(String(url)), true) : null}
          {action('audio-lines', 'Read it to me', () => ask(`Tell me what this news story says, in a few sentences: "${title}" from ${source}.`))}
          {url ? action('share-2', 'Share', () => void Share.share({ message: `${title}\n${url}` })) : null}
        </View>
      </ScrollView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  meta: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  metaText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  title: { fontSize: 23, lineHeight: 31, fontFamily: 'PlayfairDisplay_700Bold' },
  btn: { height: 52, borderRadius: 26, borderWidth: 1.3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  btnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
