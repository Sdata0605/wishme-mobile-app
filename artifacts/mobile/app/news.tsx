import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { NeonCard } from '@/components/neon/NeonCard';
import { NeonHeader } from '@/components/neon/NeonHeader';
import { PressScale, Reveal } from '@/components/neon/Motion';
import { useTheme } from '@/context/ThemeContext';
import { ago, topStories, type Story } from '@/services/home/news';

/** NEWS: today's stories as cards. Tap one to read it in the in-app browser. */
export default function NewsScreen() {
  const { neon } = useTheme();
  const insets = useSafeAreaInsets();
  const [stories, setStories] = useState<Story[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => setStories(await topStories(12)), []);
  useEffect(() => { void load(); }, [load]);

  return (
    <AmbientBackground>
      <NeonHeader title="News" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 12 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={neon.cyan}
            onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
          />
        }
      >
        {stories === null ? (
          <ActivityIndicator color={neon.cyan} style={{ marginTop: 60 }} />
        ) : stories.length === 0 ? (
          <Text style={[styles.empty, { color: neon.textLo }]}>No stories right now. Pull down to try again.</Text>
        ) : (
          stories.map((s, i) => (
            <Reveal key={s.url || s.title} delayMs={Math.min(i, 6) * 40}>
              <PressScale onPress={() => void WebBrowser.openBrowserAsync(s.url)} accessibilityRole="link" accessibilityLabel={s.title}>
                <NeonCard style={{ padding: 16 }}>
                  <Text style={[styles.title, { color: neon.textHi }]}>{s.title}</Text>
                  <View style={styles.meta}>
                    <Icon name="globe" size={13} color={neon.textDim} />
                    <Text style={[styles.metaText, { color: neon.textDim }]}>{s.source} · {ago(s.at)}</Text>
                  </View>
                </NeonCard>
              </PressScale>
            </Reveal>
          ))
        )}
      </ScrollView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, lineHeight: 22, fontFamily: 'Inter_600SemiBold' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  metaText: { fontSize: 12.5, fontFamily: 'Inter_400Regular' },
  empty: { fontSize: 14, textAlign: 'center', marginTop: 60, fontFamily: 'Inter_400Regular' },
});
