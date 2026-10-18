import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, PanResponder, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Icon } from '@/components/Icon';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { NeonHeader } from '@/components/neon/NeonHeader';
import { StoryImage } from '@/components/news/StoryHero';
import { useTheme } from '@/context/ThemeContext';
import { ago } from '@/services/home/news';
import { asCard, enrichAll, fetchHeadlines, fetchMore, isFresh, NEWS_TABS, readCache, titleKey, writeCache, type NewsCard } from '@/services/home/newsFeed';

const FLY_MS = 240;

/**
 * NEWS: category chips over a bundle of story cards. The front card flies off to the left (by swipe or the arrows) and the
 * next one rises into its place. Near the end of the bundle the next batch is fetched, so there is no last page.
 * Pictures and summaries fill in as each publisher's page is read on the phone.
 */
export default function NewsScreen() {
  const { neon } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState(NEWS_TABS[0].id);
  const [cards, setCards] = useState<NewsCard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const run = useRef(0);
  const known = useRef(new Set<string>());
  const cursor = useRef(0);
  const exhausted = useRef(false);
  const moreBusy = useRef(false);
  const x = useRef(new Animated.Value(0)).current;
  const busy = useRef(false);
  const state = useRef({ index: 0, count: 0 });
  state.current = { index, count: cards?.length ?? 0 };
  const tabRef = useRef(tab);
  tabRef.current = tab;

  const load = useCallback(async (id: string, force: boolean) => {
    const mine = ++run.current;
    const cancelled = () => run.current !== mine;
    const t = NEWS_TABS.find((v) => v.id === id) ?? NEWS_TABS[0];
    setIndex(0);
    x.setValue(0);
    known.current = new Set();
    cursor.current = 0;
    exhausted.current = false;
    const cached = await readCache(t);
    if (cancelled()) return;
    if (cached && !force && isFresh(cached.at)) {
      cached.cards.forEach((c) => known.current.add(titleKey(c.title)));
      setCards(cached.cards);
      return;
    }
    setCards(cached ? cached.cards : null);
    const heads = await fetchHeadlines(t, 30);
    if (cancelled()) return;
    if (!heads.length) {
      setCards((cur) => cur ?? []);
      return;
    }
    const byTitle = new Map((cached?.cards ?? []).map((c) => [c.title, c] as const));
    let list = heads.map((h) => byTitle.get(h.title) ?? asCard(h));
    list.forEach((c) => known.current.add(titleKey(c.title)));
    setCards(list);
    await enrichAll(list, (i, card) => {
      list = list.map((c, k) => (k === i ? card : c));
      setCards((cur) => (cur ? cur.map((c) => (c.title === card.title ? card : c)) : cur));
    }, cancelled);
    if (!cancelled()) void writeCache(t, list);
  }, [x]);

  useEffect(() => { void load(tab, false); return () => { run.current++; }; }, [tab, load]);

  /** Fetches the next batch when the user is a few cards from the end. */
  const loadMore = useCallback(async () => {
    if (moreBusy.current || exhausted.current) return;
    const t = NEWS_TABS.find((v) => v.id === tabRef.current) ?? NEWS_TABS[0];
    const mine = run.current;
    moreBusy.current = true;
    setMoreLoading(true);
    try {
      const { stories, cursor: next } = await fetchMore(t, known.current, cursor.current);
      cursor.current = next;
      if (run.current !== mine) return;
      if (!stories.length) {
        exhausted.current = true;
        return;
      }
      const fresh = stories.map(asCard);
      setCards((cur) => (cur ? [...cur, ...fresh] : fresh));
      await enrichAll(fresh, (_i, card) => {
        setCards((cur) => (cur ? cur.map((c) => (c.title === card.title ? card : c)) : cur));
      }, () => run.current !== mine);
    } finally {
      moreBusy.current = false;
      setMoreLoading(false);
    }
  }, []);

  useEffect(() => {
    if (cards && cards.length && index >= cards.length - 4) void loadMore();
  }, [index, cards, loadMore]);

  const next = useCallback(() => {
    const { index: i, count } = state.current;
    if (busy.current || i >= count - 1) return;
    busy.current = true;
    Animated.timing(x, { toValue: -width * 1.2, duration: FLY_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
      setIndex(i + 1);
      x.setValue(0);
      busy.current = false;
    });
  }, [x, width]);

  const prev = useCallback(() => {
    const { index: i } = state.current;
    if (busy.current || i <= 0) return;
    busy.current = true;
    // The previous card comes back in from the left.
    setIndex(i - 1);
    x.setValue(-width * 1.2);
    Animated.timing(x, { toValue: 0, duration: FLY_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => { busy.current = false; });
  }, [x, width]);

  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => !busy.current && Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.3,
        onPanResponderMove: (_, g) => {
          const { index: i, count } = state.current;
          // Dragging left needs a card behind; dragging right only nudges the card.
          if (g.dx < 0 && i < count - 1) x.setValue(g.dx);
          else if (g.dx >= 0) x.setValue(Math.min(g.dx, 40) * 0.4);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dx < -80 || g.vx < -0.7) next();
          else if (g.dx > 80 || g.vx > 0.7) {
            x.setValue(0);
            prev();
          } else Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
        },
        onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(),
      }),
    [x, next, prev],
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

  const count = cards?.length ?? 0;
  const progress = x.interpolate({ inputRange: [-width, 0, width], outputRange: [1, 0, 0], extrapolate: 'clamp' });

  const cardView = (c: NewsCard) => (
    <View style={[styles.card, { backgroundColor: neon.bg, borderColor: neon.cardBorder }]}>
      <StoryImage uri={c.image} loading={!c.enriched} style={styles.photo} />
      <View style={styles.cardBody}>
        <View style={styles.meta}>
          <Image source={{ uri: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(c.source)}&sz=64` }} style={styles.favicon} contentFit="cover" />
          <Text style={[styles.metaText, { color: neon.textLo }]} numberOfLines={1}>{c.source} · {ago(c.at)}</Text>
        </View>
        <Text style={[styles.title, { color: neon.textHi }]} numberOfLines={4}>{c.title}</Text>
        {c.snippet ? <Text style={[styles.snippet, { color: neon.textLo }]} numberOfLines={4}>{c.snippet}</Text> : null}
      </View>
      <LinearGradient colors={neon.gVioletCyan as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.stripe} />
    </View>
  );

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
        ) : !cards[index] ? (
          <Text style={[styles.empty, { color: neon.textLo }]}>No stories right now. Tap the refresh icon to try again.</Text>
        ) : (
          <>
            <View style={styles.deck}>
              {/* The cards behind rise one step as the front card leaves. */}
              {[2, 1].map((n) => {
                const c = cards[index + n];
                if (!c) return null;
                const scaleFrom = 1 - n * 0.05;
                const scaleTo = 1 - (n - 1) * 0.05;
                return (
                  <Animated.View
                    key={c.title}
                    pointerEvents="none"
                    style={[
                      styles.stacked,
                      {
                        transform: [
                          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [n * 14, (n - 1) * 14] }) },
                          { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [scaleFrom, scaleTo] }) },
                        ],
                        opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1 - n * 0.2, 1 - (n - 1) * 0.2] }),
                      },
                    ]}
                  >
                    {n === 1 ? cardView(c) : <View style={[styles.card, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]} />}
                  </Animated.View>
                );
              })}
              <Animated.View
                style={[
                  styles.stacked,
                  { transform: [{ translateX: x }, { rotate: x.interpolate({ inputRange: [-width, 0, width], outputRange: ['-9deg', '0deg', '9deg'] }) }] },
                ]}
              >
                <Pressable onPress={() => open(cards[index])} accessibilityRole="link" accessibilityLabel={cards[index].title} style={{ flex: 1 }}>
                  {cardView(cards[index])}
                </Pressable>
              </Animated.View>
            </View>

            <View style={styles.pager}>
              <Pressable onPress={prev} disabled={index === 0} accessibilityRole="button" accessibilityLabel="Previous story" hitSlop={10} style={[styles.arrow, { borderColor: neon.cardBorder, opacity: index === 0 ? 0.35 : 1 }]}>
                <Icon name="chevron-left" size={22} color={neon.textHi} />
              </Pressable>
              <View style={styles.countBox}>
                {moreLoading && index >= count - 1 ? <ActivityIndicator size="small" color={neon.cyan} /> : <Text style={[styles.count, { color: neon.textHi }]}>{index + 1}</Text>}
              </View>
              <Pressable onPress={next} disabled={index >= count - 1} accessibilityRole="button" accessibilityLabel="Next story" hitSlop={10} style={[styles.arrow, { borderColor: neon.cardBorder, opacity: index >= count - 1 ? 0.35 : 1 }]}>
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
  stacked: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 30 },
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
  countBox: { minWidth: 60, height: 24, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 15, textAlign: 'center', fontFamily: 'Inter_600SemiBold' },
  empty: { fontSize: 14, textAlign: 'center', marginTop: 80, fontFamily: 'Inter_400Regular' },
});
