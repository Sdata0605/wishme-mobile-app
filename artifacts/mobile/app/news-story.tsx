import { Image } from 'expo-image';
import * as Speech from 'expo-speech';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { PressScale } from '@/components/neon/Motion';
import { ListenButton } from '@/components/news/ListenButton';
import { Shimmer, StoryImage } from '@/components/news/StoryHero';
import { useTheme } from '@/context/ThemeContext';
import { ago } from '@/services/home/news';
import { fetchArticle } from '@/services/home/newsFeed';
import { resolveGoogleNews } from '@/services/home/newsExtract';

const HERO_HEIGHT = 300;
type Param = string | string[] | undefined;
const one = (p: Param) => (Array.isArray(p) ? p[0] : p) ?? '';

/**
 * One news story, laid out like a news app: the picture with a back arrow, the source and time, the headline, the first
 * paragraphs of the article, and a bar to listen to it, open it or share it. Every news tap in the app lands here; the
 * picture and text are read from the publisher's page on the phone.
 */
export default function NewsStoryScreen() {
  const { neon } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ title?: string; source?: string; url?: string; at?: string; image?: string; snippet?: string; articleUrl?: string }>();
  const title = one(params.title);
  const source = one(params.source);
  const url = one(params.url);
  const at = one(params.at);
  const when = at ? ago(at) : '';

  const [image, setImage] = useState<string | null>(one(params.image) || null);
  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [articleUrl, setArticleUrl] = useState<string>(one(params.articleUrl));
  const [loading, setLoading] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const snippet = one(params.snippet);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    (async () => {
      let target = articleUrl;
      if (!target && url) target = (await resolveGoogleNews(url, 7000)) ?? '';
      if (!alive.current) return;
      if (target) {
        setArticleUrl(target);
        const a = await fetchArticle(target);
        if (!alive.current) return;
        if (a) {
          if (a.image) setImage((cur) => cur ?? a.image);
          setParagraphs(a.paragraphs.length ? a.paragraphs : a.description ? [a.description] : []);
        }
      }
      setLoading(false);
    })().catch(() => alive.current && setLoading(false));
    return () => {
      alive.current = false;
      Speech.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const body = useMemo(() => (paragraphs.length ? paragraphs : snippet ? [snippet] : []), [paragraphs, snippet]);
  const host = source || (articleUrl ? articleUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '') : '');

  const listen = () => {
    if (speaking) {
      Speech.stop();
      setSpeaking(false);
      return;
    }
    const text = [title, ...body].join('. ');
    setSpeaking(true);
    Speech.speak(text, { onDone: () => setSpeaking(false), onStopped: () => setSpeaking(false), onError: () => setSpeaking(false) });
  };
  const open = () => {
    const target = articleUrl || url;
    if (target) void WebBrowser.openBrowserAsync(target);
  };
  const share = () => void Share.share({ message: `${title}\n${articleUrl || url}` });

  const barPill = (icon: 'globe' | 'share-2', label: string, onPress: () => void) => (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[styles.small, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}>
        <Icon name={icon} size={17} color={neon.textHi} />
        <Text style={[styles.smallText, { color: neon.textHi }]}>{label}</Text>
      </View>
    </PressScale>
  );

  return (
    <AmbientBackground>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: HERO_HEIGHT + insets.top }}>
          <StoryImage uri={image} loading={loading && !image} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(0,0,0,0.45)', 'transparent', neon.bg]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={10}
            style={[styles.back, { top: insets.top + 10 }]}
          >
            <Icon name="arrow-left" size={22} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.meta}>
            {host ? (
              <Image source={{ uri: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64` }} style={styles.favicon} contentFit="cover" />
            ) : null}
            <Text style={[styles.metaText, { color: neon.textLo }]} numberOfLines={1}>{[host, when].filter(Boolean).join(' · ')}</Text>
          </View>
          <Text style={[styles.title, { color: neon.textHi }]}>{title}</Text>

          {body.length ? (
            body.map((p, i) => (
              <Text key={i} style={[styles.para, { color: neon.textHi }]}>{p}</Text>
            ))
          ) : loading ? (
            <View style={{ gap: 10, marginTop: 6 }}>
              <Shimmer style={styles.line} />
              <Shimmer style={styles.line} />
              <Shimmer style={[styles.line, { width: '70%' }]} />
            </View>
          ) : (
            <Text style={[styles.para, { color: neon.textLo }]}>This publisher does not let the app show the text. Tap Open article to read it.</Text>
          )}
        </View>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + 12, backgroundColor: neon.bg, borderTopColor: neon.cardBorder }]}>
        <ListenButton speaking={speaking} onPress={listen} />
        {url || articleUrl ? barPill('globe', 'Open article', open) : null}
        {url || articleUrl ? barPill('share-2', 'Share', share) : null}
      </View>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  back: { position: 'absolute', left: 16, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, marginTop: -8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  favicon: { width: 20, height: 20, borderRadius: 10 },
  metaText: { fontSize: 13, flexShrink: 1, fontFamily: 'Inter_500Medium' },
  title: { fontSize: 26, lineHeight: 33, marginBottom: 16, fontFamily: 'PlayfairDisplay_700Bold' },
  para: { fontSize: 16, lineHeight: 25, marginBottom: 14, fontFamily: 'Inter_400Regular' },
  line: { height: 14, borderRadius: 7, width: '100%' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  small: { height: 54, borderRadius: 27, borderWidth: 1.2, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 7 },
  smallText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
