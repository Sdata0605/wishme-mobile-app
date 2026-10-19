import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AppState, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddressCard, GetStartedCard, NewsCard, PlayMyDay, PromptChips, ToolChips, WeatherCard, type ToolChip } from '@/components/home/HomeBlocks';
import { CallLed } from '@/components/home/HomeSections';
import { QuoteCardsSheet } from '@/components/home/QuoteCardsSheet';
import { Icon } from '@/components/Icon';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { GradientText } from '@/components/neon/GradientText';
import { Reveal } from '@/components/neon/Motion';
import { useAuth } from '@/context/AuthContext';
import { useDrawer } from '@/context/DrawerContext';
import { useTheme } from '@/context/ThemeContext';
import { useVoiceAssistant } from '@/context/VoiceAssistantContext';
import { savedMessage } from '@/services/assistant/addressModes';
import { listAiCalls, whoLabel, type AiCall } from '@/services/assistant/aiCalls';
import { tryAsking } from '@/services/home/dailyQuote';
import { touchStreak } from '@/services/home/dayStreak';
import { topStories, type Story } from '@/services/home/news';
import { cachedQuoteDay, fetchQuoteDay, lineFor, type QuoteDay } from '@/services/home/quoteOfDay';
import { currentWeather, type Weather } from '@/services/home/weather';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const GS_KEY = 'home_get_started_dismissed_v1';
const NEWS_KEY = 'home_news_hidden_on_v1';

const TOOLS: ToolChip[] = [
  { label: 'Calendar', icon: 'calendar', route: '/calendar' },
  { label: 'Reminders', icon: 'bell', route: '/reminders' },
  { label: 'Documents', icon: 'copy', route: '/documents' },
  { label: 'Finance', icon: 'wallet', route: '/finance' },
  { label: 'News', icon: 'newspaper', route: '/news' },
  { label: 'Calls', icon: 'phone', route: '/call-logs' },
];

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning,' : h < 17 ? 'Good afternoon,' : 'Good evening,';
}

function callText(c: AiCall): string {
  const who = whoLabel(c);
  if (c.status === 'in-progress') return `Talking to ${who}`;
  return `Calling ${who}`;
}

const dayStamp = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/**
 * THE AI HOME: where the app opens. Mirrors MyAssistant's Home: the greeting, the day's line, Play my day, the weather,
 * the news, ideas to say out loud and the tools. The assistant's mic is docked in the tab bar. The WishMe home is the
 * Home tab.
 */
export default function AssistantHome() {
  const { neon } = useTheme();
  const { user, getValidSession, setAddressMode } = useAuth();
  const insets = useSafeAreaInsets();
  const { ask, toggle } = useVoiceAssistant();
  const drawer = useDrawer();

  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<Weather | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [newsHidden, setNewsHidden] = useState(false);
  const [showStart, setShowStart] = useState(false);
  const [call, setCall] = useState<AiCall | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [quoteDay, setQuoteDay] = useState<QuoteDay | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);

  const first = (user?.firstName ?? '').trim().split(/\s+/)[0];
  // The server's line for today (new every day, the same for everyone); the app's own until it answers.
  const quote = useMemo(() => lineFor(quoteDay, now), [quoteDay, now]);
  const ideas = useMemo(() => tryAsking(now), [now]);
  // The tab bar is absolute and the raised mic sits over the last row.
  const bottomPad = 66 + insets.bottom + 56;
  const night = now.getHours() >= 19 || now.getHours() < 6;

  useEffect(() => {
    void cachedQuoteDay().then((d) => { if (d) setQuoteDay(d); });
    void AsyncStorage.multiGet([GS_KEY, NEWS_KEY]).then(([gs, nw]) => {
      setShowStart(gs[1] !== '1');
      setNewsHidden(nw[1] === dayStamp(new Date()));
    });
  }, []);

  const refresh = useCallback(async () => {
    setNow(new Date());
    void touchStreak();
    void getValidSession().then((sess) => currentWeather(sess?.access_token).then(setWeather)).catch(() => {});
    void fetchQuoteDay().then((d) => { if (d) setQuoteDay(d); });
    void topStories(6).then(setStories);
  }, [getValidSession]);

  // Refresh on focus (greeting, weather, news) and when the app comes back to the foreground.
  useFocusEffect(
    useCallback(() => {
      void refresh();
      const sub = AppState.addEventListener('change', (st) => { if (st === 'active') void refresh(); });
      return () => sub.remove();
    }, [refresh]),
  );

  // The call LED: only while the assistant is actually on a call, polled every 10s while this screen is focused.
  useFocusEffect(
    useCallback(() => {
      let stop = false;
      const poll = async () => {
        try {
          const token = (await getValidSession())?.access_token;
          if (!token || stop) return;
          const latest = (await listAiCalls(token, 1))[0];
          if (!stop) setCall(latest && ['queued', 'ringing', 'in-progress'].includes(latest.status) ? latest : null);
        } catch {
          // keep whatever is showing
        }
      };
      void poll();
      const t = setInterval(poll, 10_000);
      return () => { stop = true; clearInterval(t); };
    }, [getValidSession]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await AsyncStorage.removeItem('home_weather_v2');
    await refresh();
    setRefreshing(false);
  };

  const dismissStart = () => { setShowStart(false); void AsyncStorage.setItem(GS_KEY, '1'); };
  const hideNews = () => { setNewsHidden(true); void AsyncStorage.setItem(NEWS_KEY, dayStamp(new Date())); };

  return (
    <AmbientBackground>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: bottomPad }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={neon.cyan} />}
      >
        {call && <CallLed text={callText(call)} onPress={() => router.push('/call-logs' as never)} />}

        {/* Greeting, date and the day's line */}
        <View style={styles.header}>
          <Reveal>
            <Pressable
              onPress={drawer.toggle}
              accessibilityRole="button"
              accessibilityLabel="Open menu"
              hitSlop={8}
              style={[styles.menu, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}
            >
              <Icon name="menu" size={22} color={neon.textHi} />
            </Pressable>
            <View style={styles.greetRow}>
              <View style={styles.sun}>
                <Icon name={night ? 'moon' : 'sun'} size={38} color={night ? neon.cyan : '#FFC93C'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.greeting, { color: neon.textHi }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{greeting(now)}</Text>
                {first ? (
                  <GradientText colors={neon.isDark ? ['#1F7BFF', '#D23FE0', '#7B5CFA'] : [neon.violet, neon.pink]} fontSize={44} fontFamily="PlayfairDisplay_700Bold" letterSpacing={-0.5}>
                    {first}
                  </GradientText>
                ) : null}
              </View>
              <Pressable
                onPress={() => router.push('/(tabs)/hub' as never)}
                accessibilityRole="button"
                accessibilityLabel="Search features"
                style={[styles.search, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}
              >
                <Icon name="search" size={22} color={neon.textHi} />
              </Pressable>
            </View>
            <Text style={[styles.date, { color: neon.textLo }]}>
              {DAYS[now.getDay()]}, {now.getDate()} {MONTHS[now.getMonth()]}
            </Text>

            <Pressable
              onPress={() => setQuoteOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Today's quote. Open to share it as a picture"
              style={({ pressed }) => [styles.quoteRow, { opacity: pressed ? 0.7 : 1 }]}
            >
              <LinearGradient colors={[neon.blue, neon.pink]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.quoteBar} />
              <Text style={[styles.quote, { color: neon.textHi }]}>{quote}</Text>
            </Pressable>
          </Reveal>
        </View>

        <View style={styles.body}>
          <Reveal delayMs={40}>
            <PlayMyDay onPress={() => void ask('Play my day: give me a short spoken brief of my day, covering what is on my calendar, my reminders, the weather and the top news.')} />
          </Reveal>

          {user && !user.addressMode ? (
            <Reveal delayMs={70} style={{ marginBottom: 20 }}>
              <AddressCard
                onPick={(mode) => {
                  setAddressMode(mode);
                  Alert.alert('Saved', savedMessage(mode), [{ text: 'OK' }]);
                }}
              />
            </Reveal>
          ) : null}

          {showStart ? (
            <Reveal delayMs={90} style={{ marginTop: 20 }}>
              <GetStartedCard
                idea="Remind me to call Amma at 6"
                onTalk={() => { dismissStart(); toggle(); }}
                onDismiss={dismissStart}
              />
            </Reveal>
          ) : null}

          {weather ? (
            <Reveal delayMs={140} style={{ marginTop: 20 }}>
              <WeatherCard w={weather} />
            </Reveal>
          ) : null}

          {stories.length > 0 && !newsHidden ? (
            <Reveal delayMs={190} style={{ marginTop: 20 }}>
              <NewsCard
                stories={stories}
                onMore={() => router.push('/news' as never)}
                onDismiss={hideNews}
                onOpen={(s) => router.push({ pathname: '/news-story', params: { title: s.title, source: s.source, url: s.url, at: s.at } } as never)}
              />
            </Reveal>
          ) : null}
        </View>

        <Reveal delayMs={240} style={{ marginTop: 28 }}>
          <PromptChips ideas={ideas} onAsk={(p) => void ask(p)} />
        </Reveal>

        <Reveal delayMs={290} style={{ marginTop: 22 }}>
          <Text style={[styles.toolsLabel, { color: neon.textLo }]}>Open a tool</Text>
          <ToolChips tools={TOOLS} onOpen={(r) => router.push(r as never)} />
        </Reveal>
      </ScrollView>
      <QuoteCardsSheet
        visible={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        text={quote}
        day={quoteDay}
        onDay={setQuoteDay}
      />
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 22 },
  menu: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.4, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  greetRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  sun: { width: 50, height: 50, marginTop: 2, alignItems: 'center', justifyContent: 'center' },
  greeting: { fontSize: 31, lineHeight: 40, fontFamily: 'PlayfairDisplay_700Bold', letterSpacing: -0.4 },
  search: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.4, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  date: { fontSize: 16, fontFamily: 'Inter_400Regular', marginTop: 10 },
  quoteRow: { flexDirection: 'row', alignItems: 'stretch', gap: 12, marginTop: 18 },
  quoteBar: { width: 3, borderRadius: 2 },
  quote: { flex: 1, fontSize: 17.5, lineHeight: 25, fontFamily: 'Inter_500Medium' },
  body: { paddingHorizontal: 20, paddingTop: 22 },
  toolsLabel: { fontSize: 16, fontFamily: 'Inter_500Medium', marginLeft: 20, marginBottom: 12 },
});
