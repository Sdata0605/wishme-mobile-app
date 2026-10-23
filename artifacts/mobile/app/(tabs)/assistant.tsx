import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AppState, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddressCard, GetStartedCard, NewsCard, PlayMyDay, PromptChips, ToolChips, type ToolChip } from '@/components/home/HomeBlocks';
import { CallLed } from '@/components/home/HomeSections';
import { MusicPlayerCard } from '@/components/home/MusicPlayerCard';
import { Icon } from '@/components/Icon';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { Reveal } from '@/components/neon/Motion';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useVoiceAssistant } from '@/context/VoiceAssistantContext';
import { savedMessage } from '@/services/assistant/addressModes';
import { listAiCalls, whoLabel, type AiCall } from '@/services/assistant/aiCalls';
import { todaysQuote, tryAsking } from '@/services/home/dailyQuote';
import { touchStreak } from '@/services/home/dayStreak';
import { topStories, type Story } from '@/services/home/news';

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
  { label: 'Translate', icon: 'globe', route: '/translate-lens' },
  { label: 'Talk', icon: 'users', route: '/talk-translate' },
  { label: 'Snap', icon: 'camera', route: '/snap-action' },
  { label: 'Scan', icon: 'layers', route: '/scan-document' },
  { label: 'Ask photo', icon: 'sparkles', route: '/ask-photo' },
];

function callText(c: AiCall): string {
  const who = whoLabel(c);
  if (c.status === 'in-progress') return `Talking to ${who}`;
  return `Calling ${who}`;
}

const dayStamp = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/**
 * THE AI HOME: where the app opens. The date, the day's line, Play my day, the news, ideas to say out loud and the
 * tools. The assistant's mic is docked in the tab bar. The WishMe home is the Home tab.
 */
export default function AssistantHome() {
  const { neon } = useTheme();
  const { user, getValidSession, setAddressMode } = useAuth();
  const insets = useSafeAreaInsets();
  const { ask, toggle } = useVoiceAssistant();

  const [now, setNow] = useState(() => new Date());
  const [stories, setStories] = useState<Story[]>([]);
  const [newsHidden, setNewsHidden] = useState(false);
  const [showStart, setShowStart] = useState(false);
  const [call, setCall] = useState<AiCall | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const quote = useMemo(() => todaysQuote(now), [now]);
  const ideas = useMemo(() => tryAsking(now), [now]);
  // The tab bar is absolute and the raised mic sits over the last row.
  const bottomPad = 66 + insets.bottom + 56;

  useEffect(() => {
    void AsyncStorage.multiGet([GS_KEY, NEWS_KEY]).then(([gs, nw]) => {
      setShowStart(gs[1] !== '1');
      setNewsHidden(nw[1] === dayStamp(new Date()));
    });
  }, []);

  const refresh = useCallback(async () => {
    setNow(new Date());
    void touchStreak();
    void topStories(6).then(setStories);
  }, []);

  // Refresh on focus (date, news) and when the app comes back to the foreground.
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

        {/* Date, search and the day's line */}
        <View style={styles.header}>
          <Reveal>
            <View style={styles.topRow}>
              <Text style={[styles.date, { color: neon.textLo }]}>
                {DAYS[now.getDay()]}, {now.getDate()} {MONTHS[now.getMonth()]}
              </Text>
              <Pressable
                onPress={() => router.push('/(tabs)/hub' as never)}
                accessibilityRole="button"
                accessibilityLabel="Search features"
                style={[styles.search, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}
              >
                <Icon name="search" size={22} color={neon.textHi} />
              </Pressable>
            </View>

            {/* The day's thought: tap it to get it as pictures to share. */}
            <Pressable
              onPress={() => router.push({ pathname: '/quote-cards', params: { q: quote } } as never)}
              accessibilityRole="button"
              accessibilityLabel="Share today's thought as a picture"
              style={({ pressed }) => [styles.quoteRow, pressed && { opacity: 0.7 }]}
            >
              <LinearGradient colors={[neon.blue, neon.pink]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.quoteBar} />
              <Text style={[styles.quote, { color: neon.textHi }]}>{quote}</Text>
              <View style={[styles.quoteShare, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}>
                <Icon name="share-2" size={16} color={neon.textLo} />
              </View>
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

        {/* Music at the bottom: free and open tracks, or AI-made ones. Keeps playing when Home scrolls away. */}
        <Reveal delayMs={340} style={{ marginTop: 26, paddingHorizontal: 20 }}>
          <MusicPlayerCard />
        </Reveal>
      </ScrollView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 22 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  search: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.4, alignItems: 'center', justifyContent: 'center' },
  date: { flex: 1, fontSize: 16, fontFamily: 'Inter_400Regular' },
  quoteRow: { flexDirection: 'row', alignItems: 'stretch', gap: 12, marginTop: 18 },
  quoteBar: { width: 3, borderRadius: 2 },
  quote: { flex: 1, fontSize: 17.5, lineHeight: 25, fontFamily: 'Inter_500Medium' },
  quoteShare: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.2, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  body: { paddingHorizontal: 20, paddingTop: 22 },
  toolsLabel: { fontSize: 16, fontFamily: 'Inter_500Medium', marginLeft: 20, marginBottom: 12 },
});
