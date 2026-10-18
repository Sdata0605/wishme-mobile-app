import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { SettingsHeader } from '@/components/settings/SettingsUI';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { deleteMemory, listMemories, type Memory, type MemoryCategory } from '@/services/assistant/memory';
import { deleteAllConversations, getMemorySettings, searchMemory, setMemorySettings, type MemorySettings, type RecallHit } from '@/services/assistant/recall';

const CATEGORY_TITLES: Record<MemoryCategory, { chip: string; title: string }> = {
  about_me: { chip: 'About me', title: 'About you' },
  people: { chip: 'People', title: 'People in your life' },
  goals: { chip: 'Goals', title: 'Goals and dreams' },
  events: { chip: 'Events', title: 'Dates and plans' },
  preferences: { chip: 'Likes', title: 'Likes and dislikes' },
  follow_up: { chip: 'Follow-ups', title: 'To follow up' },
  work: { chip: 'Work', title: 'Work and studies' },
  feelings: { chip: 'Feelings', title: 'On your mind' },
  places: { chip: 'Places', title: 'Places' },
  calls: { chip: 'Calls', title: 'From phone calls' },
  other: { chip: 'Other', title: 'Other' },
};
const ORDER = Object.keys(CATEGORY_TITLES) as MemoryCategory[];
const SOURCE_WORD = { user: 'You said', chat: 'From a chat', call: 'From a call' } as const;

const shortDate = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
};

/**
 * Everything the assistant remembers (Settings > AI Assistant > What I remember): saved facts by category, a search over past
 * conversations and calls (by person, date, words and meaning, with the closeness of each meaning match shown), the two switches
 * for saving conversations and learning facts, and the ways to delete it all.
 */
export default function MemoryScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { getValidSession, user } = useAuth();
  const [rows, setRows] = useState<Memory[] | null>(null);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<MemorySettings>({ save_chats: true, learn_facts: true });
  const [filter, setFilter] = useState<MemoryCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<RecallHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState<'facts' | 'chats' | ''>('');
  const run = useRef(0);

  const tokenOf = useCallback(async () => (await getValidSession())?.access_token, [getValidSession]);

  const load = useCallback(async () => {
    try {
      const token = await tokenOf();
      if (!token) return setError('Please log in again.');
      const [list, prefs] = await Promise.all([listMemories(token), getMemorySettings(token)]);
      setRows(list);
      setSettings(prefs);
      setError('');
    } catch {
      setError('Could not load what I remember.');
      setRows((r) => r ?? []);
    }
  }, [tokenOf]);

  useEffect(() => { void load(); }, [load]);

  // Search as the user types, after a short pause.
  useEffect(() => {
    const q = query.trim();
    const mine = ++run.current;
    if (q.length < 2) {
      setHits(null);
      setSearching(false);
      setSearchError('');
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const token = await tokenOf();
        if (!token) throw new Error('login');
        const found = await searchMemory(token, { query: q, limit: 10 });
        if (run.current !== mine) return;
        setHits(found.results);
        setSearchError('');
      } catch {
        if (run.current !== mine) return;
        setSearchError('The search could not run. Check your connection and try again.');
        setHits(null);
      } finally {
        if (run.current === mine) setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query, tokenOf]);

  const remove = async (m: Memory) => {
    try {
      const token = await tokenOf();
      if (!token) return;
      await deleteMemory(token, m.id);
      setRows((r) => (r ?? []).filter((x) => x.id !== m.id));
    } catch {
      Alert.alert('Not removed', 'That could not be removed. Please try again.');
    }
  };

  const removeAll = () =>
    Alert.alert('Forget all facts?', 'The assistant will forget every fact it has saved about you. Your saved conversations stay. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Forget all',
        style: 'destructive',
        onPress: async () => {
          setBusy('facts');
          for (const m of rows ?? []) await remove(m);
          setBusy('');
        },
      },
    ]);

  const deleteChats = () =>
    Alert.alert('Delete all saved conversations?', 'Every saved chat and phone call transcript is removed for good, so the assistant can no longer look back at them. Saved facts stay.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete all',
        style: 'destructive',
        onPress: async () => {
          setBusy('chats');
          try {
            const token = await tokenOf();
            if (token) await deleteAllConversations(token);
            setHits(null);
            setQuery('');
          } catch {
            Alert.alert('Not deleted', 'The conversations could not be deleted. Please try again.');
          } finally {
            setBusy('');
          }
        },
      },
    ]);

  const toggle = async (key: keyof MemorySettings, value: boolean) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    try {
      const token = await tokenOf();
      if (!token || !user?.id) throw new Error('login');
      await setMemorySettings(token, user.id, next);
    } catch {
      setSettings(settings);
      Alert.alert('Not saved', 'That setting could not be saved. Please try again.');
    }
  };

  const counts = useMemo(() => {
    const c: Partial<Record<MemoryCategory, number>> = {};
    for (const m of rows ?? []) c[m.category] = (c[m.category] ?? 0) + 1;
    return c;
  }, [rows]);
  const visible = useMemo(() => (rows ?? []).filter((m) => filter === 'all' || m.category === filter), [rows, filter]);
  const searchingNow = query.trim().length >= 2;
  const total = rows?.length ?? 0;

  const badge = (h: RecallHit) => {
    const parts = h.via.split(' + ');
    return parts.map((p) => (p === 'meaning' && h.distance !== null ? `meaning · ${h.distance.toFixed(2)}` : p === 'keyword' ? 'words' : p));
  };

  const switchRow = (label: string, hint: string, key: keyof MemorySettings) => (
    <View style={s.switchRow}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.foreground, fontSize: 15, fontFamily: 'Inter_600SemiBold' }}>{label}</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 12.5, lineHeight: 17, fontFamily: 'Inter_400Regular', marginTop: 2 }}>{hint}</Text>
      </View>
      <Switch
        value={settings[key]}
        onValueChange={(v) => void toggle(key, v)}
        trackColor={{ true: colors.primary, false: colors.border }}
        accessibilityRole="switch"
        accessibilityLabel={`${label}. ${hint}`}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SettingsHeader title="What I remember" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={[s.lead, { color: colors.mutedForeground }]}>
          What you told the assistant to remember, what it noted about you and the people in your life, and your past conversations and calls. Search them, or remove anything whenever you like.
        </Text>

        <View style={[s.search, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Icon name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search my memory"
            placeholderTextColor={colors.mutedForeground}
            style={{ flex: 1, color: colors.foreground, fontSize: 15, fontFamily: 'Inter_400Regular', paddingVertical: 0 }}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search my memory"
          />
          {searching ? <ActivityIndicator size="small" color={colors.primary} /> : query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Clear search">
              <Icon name="x" size={18} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
        {!settings.save_chats && !searchingNow ? (
          <Text style={[s.note, { color: colors.mutedForeground }]}>Saving conversations is off, so only saved facts are searched.</Text>
        ) : null}

        {searchingNow ? (
          <View style={{ marginTop: 14 }}>
            {searchError ? (
              <View style={[s.errorCard, { borderColor: colors.destructive }]}>
                <Text style={{ color: colors.destructive, fontSize: 13.5, fontFamily: 'Inter_400Regular' }}>{searchError}</Text>
              </View>
            ) : null}
            {hits && hits.length === 0 && !searching ? (
              <Text style={[s.empty, { color: colors.mutedForeground }]}>Nothing matched “{query.trim()}”. Try other words or a name.</Text>
            ) : null}
            {hits && hits.length > 0 ? <Text style={[s.count, { color: colors.mutedForeground }]}>{hits.length} result{hits.length === 1 ? '' : 's'}</Text> : null}
            {(hits ?? []).map((h, i) => {
              const long = h.content.length > 220;
              const open = !!expanded[i];
              const sourceLabel = h.kind === 'fact' ? 'Saved fact' : h.source === 'call' ? 'Phone call' : 'Conversation';
              return (
                <View
                  key={`${h.kind}-${i}`}
                  style={[s.hit, { borderColor: colors.border, backgroundColor: colors.card }]}
                  accessible
                  accessibilityLabel={`${sourceLabel}${h.person ? ` with ${h.person}` : ''}, ${shortDate(h.at)}. Found by ${h.via}${h.distance !== null ? `, closeness ${h.distance.toFixed(2)}` : ''}. ${h.content}`}
                >
                  <View style={s.hitTop}>
                    <Icon name={h.source === 'call' ? 'phone' : 'message-circle'} size={14} color={colors.mutedForeground} />
                    <Text style={[s.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {[h.person, shortDate(h.at)].filter(Boolean).join(' · ') || sourceLabel}
                    </Text>
                  </View>
                  <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular', marginTop: 6 }} numberOfLines={open ? undefined : 4}>
                    {h.content}
                  </Text>
                  {long ? (
                    <Pressable onPress={() => setExpanded((e) => ({ ...e, [i]: !open }))} hitSlop={8} accessibilityRole="button">
                      <Text style={{ color: colors.primary, fontSize: 13, fontFamily: 'Inter_600SemiBold', marginTop: 4 }}>{open ? 'Show less' : 'Show more'}</Text>
                    </Pressable>
                  ) : null}
                  <View style={s.hitBottom}>
                    <Text style={[s.meta, { color: colors.mutedForeground }]}>{sourceLabel}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', flex: 1 }}>
                      {badge(h).map((b) => (
                        <View key={b} style={[s.badge, b.startsWith('meaning') ? { borderColor: colors.primary, backgroundColor: `${colors.primary}26` } : { borderColor: b === 'words' ? colors.primary : colors.border }]}>
                          <Text style={{ color: colors.foreground, fontSize: 11, fontFamily: 'Inter_500Medium' }}>{b}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <>
            <View style={[s.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
              {switchRow('Save my conversations', 'Keeps chats and calls word for word so I can look things up later.', 'save_chats')}
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 10 }} />
              {switchRow('Learn facts about me', 'Lets me note useful details from what you say.', 'learn_facts')}
            </View>

            {rows === null ? (
              <View style={{ marginTop: 16, gap: 10 }}>
                {[0, 1, 2].map((i) => <View key={i} style={[s.skeleton, { backgroundColor: colors.card, borderColor: colors.border }]} />)}
              </View>
            ) : null}
            {error ? (
              <View style={[s.errorCard, { borderColor: colors.destructive, marginTop: 16 }]}>
                <Text style={{ color: colors.destructive, fontSize: 13.5, fontFamily: 'Inter_400Regular' }}>{error}</Text>
                <Pressable onPress={() => void load()} accessibilityRole="button" hitSlop={8}>
                  <Text style={{ color: colors.primary, fontSize: 13.5, fontFamily: 'Inter_600SemiBold', marginTop: 6 }}>Try again</Text>
                </Pressable>
              </View>
            ) : null}

            {rows && rows.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 16 }}>
                {(['all', ...ORDER.filter((c) => (counts[c] ?? 0) > 0)] as (MemoryCategory | 'all')[]).map((c) => {
                  const on = filter === c;
                  const label = c === 'all' ? 'All' : CATEGORY_TITLES[c].chip;
                  const n = c === 'all' ? total : counts[c] ?? 0;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setFilter(c)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${label}, ${n} fact${n === 1 ? '' : 's'}`}
                      style={[s.chip, on ? { backgroundColor: colors.primary, borderColor: colors.primary } : { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <Text style={{ color: on ? colors.background : colors.foreground, fontSize: 13.5, fontFamily: 'Inter_600SemiBold' }}>{label} {n}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            {rows && rows.length === 0 && !error ? (
              <Text style={[s.empty, { color: colors.mutedForeground }]}>Nothing yet. Try saying: “Remember that my sister is Anita.” Facts from your conversations will appear here too.</Text>
            ) : null}

            {ORDER.filter((c) => visible.some((m) => m.category === c)).map((c) => (
              <View key={c}>
                <Text style={[s.section, { color: colors.mutedForeground }]}>{CATEGORY_TITLES[c].title.toUpperCase()}</Text>
                {visible.filter((m) => m.category === c).map((m) => (
                  <View key={m.id} style={[s.row, { borderColor: colors.border, backgroundColor: colors.card }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontSize: 15, fontFamily: 'Inter_600SemiBold' }}>{m.subject}</Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 13.5, fontFamily: 'Inter_400Regular', marginTop: 2, lineHeight: 19 }}>{m.fact}</Text>
                      <Text style={[s.meta, { color: colors.mutedForeground, marginTop: 6 }]}>
                        {[SOURCE_WORD[m.source] ?? 'Saved', shortDate(m.created_at), m.event_date ? `date ${shortDate(m.event_date)}` : ''].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Pressable onPress={() => void remove(m)} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Forget: ${m.subject}`}>
                      <Icon name="trash-2" size={18} color={colors.destructive} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ))}

            <View style={[s.card, { borderColor: colors.border, backgroundColor: colors.card, marginTop: 22, gap: 12 }]}>
              <Text style={[s.section, { color: colors.mutedForeground, marginTop: 0, marginBottom: 0 }]}>DELETE</Text>
              {rows && rows.length > 0 ? (
                <Pressable onPress={removeAll} disabled={!!busy} style={[s.danger, { borderColor: colors.destructive }]} accessibilityRole="button" accessibilityLabel="Forget all facts" accessibilityHint="Asks before deleting">
                  {busy === 'facts' ? <ActivityIndicator size="small" color={colors.destructive} /> : <Text style={{ color: colors.destructive, fontSize: 14.5, fontFamily: 'Inter_600SemiBold' }}>Forget all facts</Text>}
                </Pressable>
              ) : null}
              <Pressable onPress={deleteChats} disabled={!!busy} style={[s.danger, { borderColor: colors.destructive }]} accessibilityRole="button" accessibilityLabel="Delete all saved conversations" accessibilityHint="Asks before deleting">
                {busy === 'chats' ? <ActivityIndicator size="small" color={colors.destructive} /> : <Text style={{ color: colors.destructive, fontSize: 14.5, fontFamily: 'Inter_600SemiBold' }}>Delete all saved conversations</Text>}
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  lead: { fontSize: 13.5, lineHeight: 19, fontFamily: 'Inter_400Regular', marginBottom: 16 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, borderWidth: 1, borderRadius: 24, paddingHorizontal: 16 },
  note: { fontSize: 12.5, marginTop: 8, fontFamily: 'Inter_400Regular' },
  card: { borderWidth: 1, borderRadius: 18, padding: 14, marginTop: 14 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chip: { height: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1.2, alignItems: 'center', justifyContent: 'center' },
  section: { fontSize: 12.5, letterSpacing: 1, marginTop: 14, marginBottom: 8, fontFamily: 'PlayfairDisplay_700Bold' },
  empty: { fontSize: 14, textAlign: 'center', marginTop: 30, lineHeight: 20, fontFamily: 'Inter_400Regular' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10 },
  meta: { fontSize: 12.5, fontFamily: 'Inter_400Regular' },
  count: { fontSize: 13, marginBottom: 8, fontFamily: 'Inter_500Medium' },
  hit: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10 },
  hitTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hitBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 },
  badge: { height: 22, borderRadius: 11, borderWidth: 1, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center' },
  skeleton: { height: 70, borderRadius: 16, borderWidth: 1, opacity: 0.6 },
  errorCard: { borderWidth: 1, borderRadius: 14, padding: 14 },
  danger: { borderWidth: 1.2, borderRadius: 24, height: 46, alignItems: 'center', justifyContent: 'center' },
});
