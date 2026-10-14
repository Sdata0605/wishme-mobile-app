import { endOfDay, formatDistanceToNow, startOfDay } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/Icon';
import { ErrorBanner } from '@/components/hub/StateViews';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { GradientText } from '@/components/neon/GradientText';
import { PressScale, Reveal } from '@/components/neon/Motion';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { listAiCalls, whoLabel } from '@/services/assistant/aiCalls';
import { listDocuments } from '@/services/documents/store';
import { expandEvents, listEvents } from '@/services/hub/calendar';
import { listReminders } from '@/services/hub/reminders';

/** The one live line each card shows, so the Hub is worth opening rather than just a menu. */
interface HubContext {
  eventsToday: number;
  remindersDue: number;
  someday: number;
  lastCall: string | null;
  documents: number;
}

interface HubRow {
  icon: IconName;
  title: string;
  blurb: string;
  context: string | null;
  accent: string;
  route: string;
  /** Has a live line that is still loading. */
  live: boolean;
}

/** One tappable line of a group: a gradient icon tile, the name, what it is, and the live line under it. */
function HubRowTile({ row, loading, last }: { row: HubRow; loading: boolean; last: boolean }) {
  const { neon } = useTheme();
  return (
    <>
      <PressScale
        onPress={() => router.push(row.route as never)}
        accessibilityRole="button"
        accessibilityLabel={row.context ? `${row.title}. ${row.context}` : row.title}
      >
        <View style={s.row}>
          <LinearGradient colors={neon.tile(row.accent) as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tile}>
            <Icon name={row.icon} size={23} color="#fff" />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={[s.rowTitle, { color: neon.textHi }]}>{row.title}</Text>
            <Text style={[s.rowBlurb, { color: neon.textLo }]} numberOfLines={2}>{row.blurb}</Text>
            {loading ? (
              <ActivityIndicator size="small" color={neon.textDim} style={s.spinner} />
            ) : row.context ? (
              <Text style={[s.rowContext, { color: neon.violet }]} numberOfLines={1}>{row.context}</Text>
            ) : null}
          </View>
          <Icon name="chevron-right" size={20} color={neon.textDim} />
        </View>
      </PressScale>
      {last ? null : <View style={[s.hairline, { backgroundColor: neon.line }]} />}
    </>
  );
}

function HubGroup({ title, rows, loading }: { title: string; rows: HubRow[]; loading: boolean }) {
  const { neon } = useTheme();
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={[s.groupTitle, { color: neon.textLo }]}>{title.toUpperCase()}</Text>
      <View style={[s.group, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}>
        {rows.map((r, i) => <HubRowTile key={r.title} row={r} loading={loading && r.live} last={i === rows.length - 1} />)}
      </View>
    </View>
  );
}

export default function HubScreen() {
  const { neon } = useTheme();
  const insets = useSafeAreaInsets();
  const { getValidSession } = useAuth();

  const [context, setContext] = useState<HubContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setError(null);
    // Documents are kept on the phone, so their count is available with or without a session.
    const documents = await listDocuments()
      .then((rows) => rows.length)
      .catch(() => 0);

    const session = await getValidSession();
    if (!session?.access_token) {
      setError('Please sign in again to see your Hub.');
      setContext({ eventsToday: 0, remindersDue: 0, someday: 0, lastCall: null, documents });
      return;
    }
    const token = session.access_token;
    const now = new Date();

    try {
      const [events, reminders, calls] = await Promise.all([
        listEvents(token, startOfDay(now), endOfDay(now)),
        listReminders(token),
        listAiCalls(token, 1),
      ]);

      const today = expandEvents(events, startOfDay(now), endOfDay(now));
      const pending = reminders.filter((r) => r.status === 'pending');
      const latest = calls[0] ?? null;

      setContext({
        eventsToday: today.length,
        // Anything already due counts, including things that slipped past.
        remindersDue: pending.filter((r) => r.due_at !== null && new Date(r.due_at) <= endOfDay(now)).length,
        someday: pending.filter((r) => r.due_at === null).length,
        lastCall: latest
          ? `${whoLabel(latest)}, ${formatDistanceToNow(new Date(latest.created_at), { addSuffix: true })}`
          : null,
        documents,
      });
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Your Hub could not be loaded.');
      setContext((prev) => prev ?? { eventsToday: 0, remindersDue: 0, someday: 0, lastCall: null, documents });
    }
  }, [getValidSession]);

  useEffect(() => {
    void load();
  }, [load]);

  const loading = context === null;

  const reminderContext = (() => {
    if (!context) return null;
    const parts: string[] = [];
    if (context.remindersDue > 0) {
      parts.push(`${context.remindersDue} ${context.remindersDue === 1 ? 'reminder' : 'reminders'} due`);
    }
    if (context.someday > 0) parts.push(`${context.someday} on Someday`);
    return parts.length > 0 ? parts.join(' · ') : 'Nothing waiting';
  })();

  const groups: { title: string; rows: HubRow[] }[] = [
    {
      title: 'Your day',
      rows: [
        {
          icon: 'calendar', title: 'Calendar', blurb: 'Meetings, appointments and anything that takes up time.', accent: neon.accentA, route: '/calendar', live: true,
          context: context ? (context.eventsToday === 0 ? 'Nothing on today' : `${context.eventsToday} ${context.eventsToday === 1 ? 'event' : 'events'} today`) : null,
        },
        { icon: 'bell', title: 'Reminders', blurb: 'Nudges at a moment, or notes with no date at all.', accent: neon.accentE, route: '/reminders', live: true, context: reminderContext },
      ],
    },
    {
      title: 'Phone',
      rows: [
        {
          icon: 'phone', title: 'Calls', blurb: 'Calls the assistant made for you, and what they said back.', accent: neon.accentD, route: '/call-logs', live: true,
          context: context ? (context.lastCall ? `Last call: ${context.lastCall}` : 'No calls yet') : null,
        },
      ],
    },
    {
      title: 'Practice',
      rows: [
        {
          icon: 'copy', title: 'My documents', blurb: 'Reports, letters and spreadsheets the assistant has written.', accent: neon.accentC, route: '/documents', live: true,
          context: context ? (context.documents === 0 ? 'Nothing written yet' : `${context.documents} ${context.documents === 1 ? 'document' : 'documents'}`) : null,
        },
      ],
    },
    {
      title: 'Money',
      rows: [{ icon: 'wallet', title: 'Finance', blurb: 'EMIs, incomes and payoff plans.', accent: neon.accentB, route: '/finance', live: false, context: null }],
    },
    {
      title: 'App',
      rows: [{ icon: 'layers', title: 'Features', blurb: 'What’s live, what’s being built, what’s next.', accent: neon.accentC, route: '/features', live: false, context: null }],
    },
  ];

  const q = query.trim().toLowerCase();
  const visibleGroups = groups
    .map((g) => ({ ...g, rows: q ? g.rows.filter((r) => (r.title + ' ' + r.blurb).toLowerCase().includes(q)) : g.rows }))
    .filter((g) => g.rows.length > 0);

  return (
    <AmbientBackground>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={neon.violet}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <View style={s.titleRow}>
          <GradientText colors={neon.isDark ? ['#25DFFF', '#3FA0FF'] : [neon.violet, neon.pink]} fontSize={40} fontFamily="PlayfairDisplay_700Bold" letterSpacing={-0.6}>Hub</GradientText>
          <TouchableOpacity onPress={() => void load()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Refresh">
            <Icon name="refresh-cw" size={18} color={neon.textLo} />
          </TouchableOpacity>
        </View>

        <View style={[s.search, { backgroundColor: neon.isDark ? 'rgba(6,18,70,0.8)' : neon.surfaceHigh, borderColor: neon.cardBorder }]}>
          <Icon name="search" size={22} color={neon.textHi} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Find a feature"
            placeholderTextColor={neon.textLo}
            style={[s.searchInput, { color: neon.textHi }]}
            autoCorrect={false}
          />
        </View>

        {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

        <View style={s.body}>
          {visibleGroups.map((g, i) => (
            <Reveal key={g.title} delayMs={i * 50}>
              <HubGroup title={g.title} rows={g.rows} loading={loading} />
            </Reveal>
          ))}
        </View>
      </ScrollView>
    </AmbientBackground>
  );
}

const s = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 16, marginBottom: 22, height: 54, paddingHorizontal: 18, borderRadius: 22, borderWidth: 1.4 },
  searchInput: { flex: 1, fontSize: 17, fontFamily: 'Inter_400Regular', height: 54 },
  title: { fontSize: 32, fontFamily: 'PlayfairDisplay_700Bold', letterSpacing: -0.6 },
  body: { paddingHorizontal: 16 },
  groupTitle: { fontSize: 13.5, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.9, marginLeft: 16, marginBottom: 9 },
  group: { borderRadius: 22, borderWidth: 1.5, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingLeft: 18, paddingRight: 14, paddingVertical: 14 },
  tile: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 18, fontFamily: 'Inter_500Medium', letterSpacing: -0.2 },
  rowBlurb: { fontSize: 14.5, lineHeight: 20, fontFamily: 'Inter_400Regular', marginTop: 2 },
  rowContext: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', marginTop: 4 },
  spinner: { alignSelf: 'flex-start', marginTop: 6 },
  hairline: { height: 1, marginLeft: 80, marginRight: 0 },
});
