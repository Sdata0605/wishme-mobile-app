import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Icon } from '@/components/Icon';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { NeonHeader } from '@/components/neon/NeonHeader';
import { StoryImage } from '@/components/news/StoryHero';
import { useTheme } from '@/context/ThemeContext';
import { ago } from '@/services/home/news';
import { asCard, enrichAll, fetchHeadlines, isFresh, NEWS_TABS, readCache, writeCache, type NewsCard } from '@/services/home/newsFeed';

/**
 * NEWS: category chips over a deck of story cards (picture, source, headline, summary) with an "n of N" pager. Headlines show
 * at once; the pictures and summaries fill in as each publisher's page is read on the phone. Tap a card to open the story.
 */
export default function NewsScreen() {
  const { neon } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState(NEWS_TABS[0].id);
  const [cards, setCards] = useState<NewsCard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const run = useRef(0);

  const load = useCallback(async (id: string, force: boolean) => {
    const mine = ++run.current;
    const cancelled = () => run.current !== mine;
    const t = NEWS_TABS.find((x) => x.id === id) ?? NEWS_TABS[0];
    setIndex(0);
    const cached = await readCache(t);
    if (cancelled()) return;
    if (cached && !force && isFresh(cached.at)) {
      setCards(cached.cards);
      return;
    }
    setCards(cached ? cached.cards : null);
    const heads = await fetchHeadlines(t);
    if (cancelled()) return;
    if (!heads.length) {
      setCards((cur) => cur ?? []);
      return;
    }
    // Keep what a previous visit already found for the same story.
    const known = new Map((cached?.cards ?? []).map((c) => [c.title, c] as const));
    let list = heads.map((h) => known.get(h.title) ?? asCard(h));
    setCards(list);
    await enrichAll(list, (i, card) => {
      list = list.map((c, k) => (k === i ? card : c));
      setCards(list);
    }, cancelled);
    if (!cancelled()) void writeCache(t, list);
  }, []);

  useEffect(() => { void load(tab, false); return () => { run.current++; }; }, [tab, load]);

  const count = cards?.length ?? 0;
  const go = useCallback((delta: number) => setIndex((i) => Math.max(0, Math.min(count - 1, i + delta))), [count]);

  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderRelease: (_, g) => {
          if (g.dx < -50) go(1);
          else if (g.dx > 50) go(-1);
        },
      }),
    [go],
  );

  const open = (c: NewsCard) =>
    router.push({
      pathname: '/news-story',
      params: { title: c.title, source: c.source, url: c.url, at: c.at, image: c.image ?? '', snippet: c.snippet, articleUrl: c.articleUrl ?? '' },
    } as never);

  const refresh = async () => {
    setRefreshing(true);
    await load(tab, true);
    setRefreshing(false);
  };

  const current = cards && cards[index];

  return (
    <AmbientBackground>
      <NeonHeader
        title="News"
        right={
          <Pressable onPress={() => void refresh()} accessibilityRole="button" accessibilityLabel="Refresh news" hitSlop={10} style={styles.refresh}>
            {refreshing ? <ActivityIndicator size="small" color={neon.cyan} /> : <Icon name="refresh-cw" size={20} color={neon.textHi} />}
          </Pressable>
        }
      />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {NEWS_TABS.map((t) => {
            const on = t.id === tab;
            return (
              <Pressable
                key={t.id}
                onPress={() => setTab(t.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.chip, on ? { backgroundColor: neon.violet, borderColor: neon.violet } : { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}
              >
                <Text style={[styles.chipText, { color: on ? '#fff' : neon.textHi }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={[styles.deckArea, { paddingBottom: insets.bottom + 16 }]} {...swipe.panHandlers}>
        {cards === null ? (
          <ActivityIndicator color={neon.cyan} style={{ marginTop: 80 }} />
        ) : !current ? (
          <Text style={[styles.empty, { color: neon.textLo }]}>No stories right now. Tap the refresh icon to try again.</Text>
        ) : (
          <>
            <View style={styles.deck}>
              {/* The next two cards peek out from behind the front one. */}
              {[2, 1].map((n) =>
                cards[index + n] ? (
                  <View
                    key={cards[index + n].title}
                    style={[styles.card, styles.behind, { backgroundColor: neon.glass, borderColor: neon.cardBorder, top: n * 10, transform: [{ scale: 1 - n * 0.045 }], opacity: 1 - n * 0.25 }]}
                  />
                ) : null,
              )}
              <Pressable onPress={() => open(current)} accessibilityRole="link" accessibilityLabel={current.title} style={styles.front}>
                <View style={[styles.card, { backgroundColor: neon.bg, borderColor: neon.cardBorder }]}>
                  <StoryImage uri={current.image} loading={!current.enriched} style={styles.photo} />
                  <View style={styles.cardBody}>
                    <View style={styles.meta}>
                      <Image source={{ uri: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(current.source)}&sz=64` }} style={styles.favicon} contentFit="cover" />
                      <Text style={[styles.metaText, { color: neon.textLo }]} numberOfLines={1}>{current.source} · {ago(current.at)}</Text>
                    </View>
                    <Text style={[styles.title, { color: neon.textHi }]} numberOfLines={4}>{current.title}</Text>
                    {current.snippet ? <Text style={[styles.snippet, { color: neon.textLo }]} numberOfLines={4}>{current.snippet}</Text> : null}
                  </View>
                  <LinearGradient colors={neon.gVioletCyan as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.stripe} />
                </View>
              </Pressable>
            </View>

            <View style={styles.pager}>
              <Pressable onPress={() => go(-1)} disabled={index === 0} accessibilityRole="button" accessibilityLabel="Previous story" hitSlop={10} style={[styles.arrow, { borderColor: neon.cardBorder, opacity: index === 0 ? 0.35 : 1 }]}>
                <Icon name="chevron-left" size={22} color={neon.textHi} />
              </Pressable>
              <Text style={[styles.count, { color: neon.textHi }]}>{index + 1} of {count}</Text>
              <Pressable onPress={() => go(1)} disabled={index >= count - 1} accessibilityRole="button" accessibilityLabel="Next story" hitSlop={10} style={[styles.arrow, { borderColor: neon.cardBorder, opacity: index >= count - 1 ? 0.35 : 1 }]}>
                <Icon name="chevron-right" size={22} color={neon.textHi} />
              </Pressable>
            </View>
          </>
        )}
      </View>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  refresh: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  chips: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip: { height: 38, paddingHorizontal: 16, borderRadius: 19, borderWidth: 1.2, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  deckArea: { flex: 1, paddingHorizontal: 18, paddingTop: 8 },
  deck: { flex: 1, marginBottom: 14 },
  front: { flex: 1, marginBottom: 22 },
  behind: { position: 'absolute', left: 0, right: 0, height: '94%' },
  card: { flex: 1, borderRadius: 26, borderWidth: 1.2, overflow: 'hidden' },
  photo: { height: '46%' },
  cardBody: { flex: 1, padding: 16, gap: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  favicon: { width: 18, height: 18, borderRadius: 9 },
  metaText: { fontSize: 12.5, flexShrink: 1, fontFamily: 'Inter_500Medium' },
  title: { fontSize: 21, lineHeight: 28, fontFamily: 'PlayfairDisplay_700Bold' },
  snippet: { fontSize: 14.5, lineHeight: 21, fontFamily: 'Inter_400Regular' },
  stripe: { height: 4 },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22 },
  arrow: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.2, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 15, minWidth: 70, textAlign: 'center', fontFamily: 'Inter_600SemiBold' },
  empty: { fontSize: 14, textAlign: 'center', marginTop: 80, fontFamily: 'Inter_400Regular' },
});
